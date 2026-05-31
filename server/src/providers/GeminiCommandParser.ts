import {
  commandRequestSchema,
  commandResponseSchema
} from "../schemas.js";
import { DEFAULT_GEMINI_MODEL } from "../config.js";
import type { CommandRequest } from "../schemas.js";
import type { CommandParser, CommandResponse } from "./CommandParser.js";
import { requestGeminiJson } from "./geminiUtils.js";
import type { FetchLike } from "./geminiUtils.js";

type GeminiCommandParserOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

const operationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    action: {
      type: "string",
      enum: [
        "add_generated_object",
        "add_local_object",
        "remove_object",
        "move_object",
        "rotate_object",
        "scale_object",
        "update_object_physics",
        "update_object_appearance",
        "toggle_gravity",
        "toggle_collisions",
        "export_scene",
        "relabel_object",
        "generate_background_image",
        "generate_environment_scene"
      ]
    },
    prompt: {
      type: "string",
      description: "Prompt for add_generated_object or generate_background_image."
    },
    scenePrompt: {
      type: "string",
      description: "Prompt for generate_environment_scene Meshy scene GLB generation."
    },
    backgroundPrompt: {
      type: "string",
      description: "Prompt for generate_environment_scene background image generation."
    },
    fallbackAssetKey: {
      type: "string",
      enum: ["rubber_ball", "wooden_crate", "glass_vase", "metal_barrel", "duck"]
    },
    placement: {
      type: "object",
      additionalProperties: false,
      properties: {
        mode: { type: "string", enum: ["on_floor", "on_object", "at_position"] },
        target: { type: "string" },
        position: {
          type: "array",
          items: { type: "number" },
          minItems: 3,
          maxItems: 3
        }
      },
      required: ["mode"]
    },
    target: {
      type: "string",
      description: "Existing scene object ID from sceneContext."
    },
    position: {
      type: "array",
      items: { type: "number" },
      minItems: 3,
      maxItems: 3
    },
    rotation: {
      type: "array",
      items: { type: "number" },
      minItems: 3,
      maxItems: 3
    },
    scale: {
      type: "array",
      items: { type: "number" },
      minItems: 3,
      maxItems: 3
    },
    changes: {
      type: "object",
      additionalProperties: false,
      properties: {
        massKg: { type: "number" },
        restitution: { type: "number", minimum: 0, maximum: 1 },
        friction: { type: "number", minimum: 0, maximum: 1 },
        static: { type: "boolean" },
        breakable: { type: "boolean" },
        collider: { type: "string", enum: ["ball", "cuboid", "cylinder", "convex_hull"] },
        baseColor: { type: "string" },
        roughness: { type: "number", minimum: 0, maximum: 1 },
        metalness: { type: "number", minimum: 0, maximum: 1 },
        textureDescription: { type: "string" }
      }
    },
    enabled: { type: "boolean" },
    label: { type: "string" }
  },
  required: ["action"]
};

const sceneOperationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    operation: operationJsonSchema,
    operations: {
      type: "array",
      items: operationJsonSchema,
      minItems: 1,
      maxItems: 32,
      description: "Ordered editor tool calls to run for multi-step user requests."
    },
    thoughts: {
      type: "array",
      items: { type: "string" },
      maxItems: 32,
      description: "Brief user-visible plan/status lines. Do not include hidden reasoning."
    },
    message: {
      type: "string",
      description: "Conversational answer when no editor tool is needed."
    }
  },
  anyOf: [
    { required: ["operation"] },
    { required: ["operations"] },
    { required: ["message"] }
  ]
};

export class GeminiCommandParser implements CommandParser {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;

  constructor(options: GeminiCommandParserOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("GeminiCommandParser requires a non-empty API key");
    }

    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_GEMINI_MODEL;
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async parse(input: CommandRequest): Promise<CommandResponse> {
    const request = commandRequestSchema.parse(input);
    const response = await requestGeminiJson<unknown>({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      fetch: this.fetch,
      contents: [
        {
          role: "user",
          parts: [
            {
              text:
                "You are an agentic 3D scene editor assistant. Do not rely on local keyword parsing; you are responsible for deciding from context whether the user is asking a general question or requesting scene edits. Reply conversationally when the user is asking a question or discussing options. When the user asks you to change the scene, choose one or more ordered editor tool calls. Infer the target objects and tools from the full scene context: object ids, labels, categories, materials, current object transforms, dimensions, semantic metadata, static flags, selected object, gravity/collision state, and relative placement intent. Do not assume the selected object is the target unless the user explicitly refers to the selected object with words like selected, this, it, or that, or clearly names that object. Background, backdrop, sky, horizon, and environment-image requests are scene-wide visual requests; use generate_background_image or generate_environment_scene for those, not update_object_appearance. For compound requests, return one tool call per target object and per edit category, so changing two objects' colors plus one object's physics becomes three ordered operations. If an edit applies to every relevant object, return operations for each affected object rather than a summary message. When positioning an object resting on the floor, keep its current x/z unless the user asks otherwise, and position.y should normally be half of that object's height from dimensions. Available tools: add_generated_object(prompt, placement, fallbackAssetKey?), add_local_object(fallbackAssetKey, placement), remove_object(target), move_object(target, position), rotate_object(target, rotation), scale_object(target, scale), update_object_physics(target, changes), update_object_appearance(target, changes), toggle_gravity(enabled), toggle_collisions(enabled), export_scene(), relabel_object(target, label), generate_background_image(prompt), generate_environment_scene(scenePrompt, backgroundPrompt, placement). Use generate_environment_scene when the user asks for a complete room/world/environment GLB plus matching background. You must include every listed argument required by each chosen tool. Use only object IDs from sceneContext when targeting existing objects. For add requests, prefer add_generated_object with placement on the mentioned object when possible. Return only JSON with operation for one tool, operations for multiple tools, message for general answers, and optional thoughts containing brief user-visible plan/status lines without hidden reasoning.\n\n" +
                JSON.stringify(request)
            }
          ]
        }
      ]
    });

    return commandResponseSchema.parse(normalizeCommandResponse(response, request.message));
  }
}

function normalizeCommandResponse(response: unknown, userMessage: string): unknown {
  if (!isRecord(response)) return response;

  const normalized: Record<string, unknown> = { ...response };
  if (!normalized.operation && !normalized.operations && (normalized.action || normalized.tool)) {
    normalized.operation = normalized;
  }

  normalized.thoughts = normalizeThoughts(normalized.thoughts);

  const operations = normalized.operations;
  if (Array.isArray(operations) && operations.length) {
    return {
      ...normalized,
      operations: operations.map((operation) => normalizeOperation(operation, userMessage))
    };
  }

  if (!normalized.operation) return normalized;

  return {
    ...normalized,
    operation: normalizeOperation(normalized.operation, userMessage)
  };
}

function normalizeThoughts(thoughts: unknown): unknown {
  if (typeof thoughts === "string") {
    const thought = thoughts.trim();
    return thought ? [thought] : undefined;
  }

  if (!Array.isArray(thoughts)) return thoughts;

  return thoughts
    .filter((thought): thought is string => typeof thought === "string")
    .map((thought) => thought.trim())
    .filter(Boolean)
    .slice(0, 32);
}

function normalizeOperation(operation: unknown, userMessage: string): unknown {
  if (!isRecord(operation)) return operation;

  const normalized: Record<string, unknown> = {
    ...operation,
    ...(isRecord(operation.arguments) ? operation.arguments : {})
  };
  normalized.action = normalizeAction(normalized.action ?? normalized.tool ?? normalized.name);
  delete normalized.tool;
  delete normalized.name;
  delete normalized.arguments;

  if (normalized.action === "generate_background_image") {
    normalized.prompt = stringValue(
      normalized.prompt,
      normalized.backgroundPrompt,
      normalized.scenePrompt,
      normalized.description,
      userMessage
    );
  }

  if (normalized.action === "update_object_appearance") {
    return normalizeAppearanceOperation(normalized);
  }

  return normalized;
}

function normalizeAction(action: unknown): unknown {
  if (typeof action !== "string") return action;

  const normalized = action.trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  const aliases: Record<string, string> = {
    add_object: "add_generated_object",
    create_object: "add_generated_object",
    generate_object: "add_generated_object",
    local_object: "add_local_object",
    delete_object: "remove_object",
    move: "move_object",
    translate_object: "move_object",
    rotate: "rotate_object",
    scale: "scale_object",
    resize_object: "scale_object",
    update_physics: "update_object_physics",
    set_physics: "update_object_physics",
    change_physics: "update_object_physics",
    update_appearance: "update_object_appearance",
    update_material: "update_object_appearance",
    set_material: "update_object_appearance",
    change_material: "update_object_appearance",
    change_color: "update_object_appearance",
    set_color: "update_object_appearance",
    update_background: "generate_background_image",
    update_scene_background: "generate_background_image",
    set_background: "generate_background_image",
    change_background: "generate_background_image",
    create_background: "generate_background_image",
    create_background_image: "generate_background_image",
    generate_scene_background: "generate_background_image",
    generate_background: "generate_background_image",
    update_environment_background: "generate_background_image",
    generate_environment: "generate_environment_scene",
    create_environment: "generate_environment_scene",
    create_environment_scene: "generate_environment_scene",
    update_environment_scene: "generate_environment_scene"
  };

  return aliases[normalized] ?? action;
}

function normalizeAppearanceOperation(
  operation: Record<string, unknown>
): Record<string, unknown> {
  const changes = operation.changes;
  if (!isRecord(changes)) return operation;
  const normalizedChanges = normalizeAppearanceChanges(changes);

  return {
    ...operation,
    changes: normalizedChanges
  };
}

function normalizeAppearanceChanges(changes: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...changes };
  normalized.baseColor = stringValue(
    normalized.baseColor,
    normalized.base_color,
    normalized.color,
    normalized.colour,
    normalized.materialColor,
    normalized.material_color,
    normalized.diffuseColor,
    normalized.diffuse_color,
    normalized.albedoColor,
    normalized.albedo_color
  );
  const roughness = numberValue(normalized.roughness, normalized.rough);
  if (roughness === undefined) {
    delete normalized.roughness;
  } else {
    normalized.roughness = roughness;
  }

  const metalness = numberValue(
    normalized.metalness,
    normalized.metallic,
    normalized.metallicLevel,
    normalized.metallic_level
  );
  if (metalness === undefined) {
    delete normalized.metalness;
  } else {
    normalized.metalness = metalness;
  }

  const baseColor = normalized.baseColor;
  if (typeof baseColor !== "string") {
    delete normalized.baseColor;
    return normalized;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(baseColor)) return normalized;

  const color = cssColorToHex(baseColor);
  if (!color) {
    delete normalized.baseColor;
    return normalized;
  }

  normalized.baseColor = color;
  return normalized;
}

function stringValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return undefined;
}

function numberValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function cssColorToHex(value: string): string | undefined {
  const colors: Record<string, string> = {
    red: "#ff0000",
    crimson: "#dc143c",
    orange: "#ff8a00",
    yellow: "#ffd400",
    green: "#00a651",
    blue: "#1f6fff",
    purple: "#7c3aed",
    pink: "#ff4fa3",
    black: "#111111",
    white: "#f5f5f5",
    gray: "#808080",
    grey: "#808080",
    brown: "#8b5a2b",
    gold: "#d4af37",
    silver: "#c0c0c0"
  };

  return colors[value.trim().toLowerCase()];
}
