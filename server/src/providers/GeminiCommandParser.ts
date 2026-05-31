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

const sceneOperationJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    operation: {
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
            "generate_background_image"
          ]
        },
        prompt: {
          type: "string",
          description: "Prompt for add_generated_object or generate_background_image."
        },
        fallbackAssetKey: {
          type: "string",
          enum: ["rubber_ball", "wooden_crate", "glass_vase", "metal_barrel", "duck"]
        },
        placement: {
          type: "object",
          additionalProperties: false,
          properties: {
            mode: { type: "string", enum: ["on_floor", "on_object", "absolute"] },
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
    }
  },
  required: ["operation"]
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
    const response = await requestGeminiJson<CommandResponse>({
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
                "Convert the user's editor request into one validated scene operation. Available tools: add_generated_object(prompt, placement, fallbackAssetKey?), add_local_object(fallbackAssetKey, placement), remove_object(target), move_object(target, position), rotate_object(target, rotation), scale_object(target, scale), update_object_physics(target, changes), update_object_appearance(target, changes), toggle_gravity(enabled), toggle_collisions(enabled), export_scene(), relabel_object(target, label), generate_background_image(prompt). You must include every listed argument required by the chosen tool. Use only object IDs from sceneContext when targeting existing objects. Use current object transforms, dimensions, semantic labels, material metadata, static flags, gravity/collision intent, and relative placement words to choose a target. For add requests, prefer add_generated_object with placement on the mentioned object when possible. For background/sky/horizon/backdrop requests, use generate_background_image. Return only JSON.\n\n" +
                JSON.stringify(request)
            }
          ]
        }
      ],
      responseJsonSchema: sceneOperationJsonSchema
    });

    return commandResponseSchema.parse(normalizeCommandResponse(response));
  }
}

function normalizeCommandResponse(response: CommandResponse): CommandResponse {
  if (response.operation.action !== "update_object_appearance") {
    return response;
  }

  const baseColor = response.operation.changes.baseColor;
  if (!baseColor || /^#[0-9a-fA-F]{6}$/.test(baseColor)) {
    return response;
  }

  const color = cssColorToHex(baseColor);
  if (!color) return response;

  return {
    ...response,
    operation: {
      ...response.operation,
      changes: {
        ...response.operation.changes,
        baseColor: color
      }
    }
  };
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
