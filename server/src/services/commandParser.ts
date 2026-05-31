import { HttpError } from "../errors.js";
import {
  commandRequestSchema,
  commandResponseSchema,
  fallbackAssetKeySchema,
  sceneOperationSchema
} from "../schemas.js";
import type {
  AssetPlacement,
  CommandRequest,
  FallbackAssetKey,
  SceneOperation
} from "../schemas.js";
import type { CommandParser, CommandResponse } from "../providers/CommandParser.js";

type SceneObject = CommandRequest["sceneContext"]["objects"][number];

export class RuleCommandParser implements CommandParser {
  async parse(input: CommandRequest): Promise<CommandResponse> {
    return buildCommandResponse(input);
  }
}

export const parseSceneCommand = (input: CommandRequest): SceneOperation => {
  const request = commandRequestSchema.parse(input);
  const message = request.message.trim();
  const normalized = normalize(message);
  const selectedObjectId = request.sceneContext.selectedObjectId;

  if (normalized.includes("collision")) {
    return validateOperation({
      action: "toggle_collisions",
      enabled: !/\b(off|disable|stop|without)\b/.test(normalized)
    });
  }

  if (normalized.includes("gravity")) {
    return validateOperation({
      action: "toggle_gravity",
      enabled: !/\b(off|disable|stop)\b/.test(normalized)
    });
  }

  const environmentScene = parseEnvironmentSceneCommand(message, normalized);
  if (environmentScene) {
    return environmentScene;
  }

  const background = parseBackgroundCommand(message, normalized);
  if (background) {
    return background;
  }

  if (/\b(export|download|save)\b/.test(normalized)) {
    return validateOperation({ action: "export_scene" });
  }

  const transform = parseTransformCommand(
    message,
    normalized,
    request.sceneContext.objects,
    selectedObjectId
  );
  if (transform) {
    return transform;
  }

  const relabel = parseRelabelCommand(
    message,
    normalized,
    request.sceneContext.objects,
    selectedObjectId
  );
  if (relabel) {
    return relabel;
  }

  const generated = parseGeneratedAssetCommand(message, request.sceneContext.objects);
  if (generated) {
    return generated;
  }

  const appearance = parseAppearanceCommand(
    message,
    normalized,
    request.sceneContext.objects,
    selectedObjectId
  );
  if (appearance) {
    return appearance;
  }

  const physics = parsePhysicsCommand(
    message,
    normalized,
    request.sceneContext.objects,
    selectedObjectId
  );
  if (physics) {
    return physics;
  }

  const remove = parseRemoveCommand(normalized, request.sceneContext.objects, selectedObjectId);
  if (remove) {
    return remove;
  }

  throw new HttpError(
    422,
    "UnsupportedCommand",
    "Could not convert chat message into a supported scene operation"
  );
};

export const parseSceneOperations = (input: CommandRequest): SceneOperation[] => {
  const request = commandRequestSchema.parse(input);
  const segments = splitCommandSegments(request.message);

  if (segments.length > 1) {
    return segments.map((segment) =>
      parseSceneCommand({
        ...request,
        message: segment
      })
    );
  }

  try {
    return [parseSceneCommand(request)];
  } catch (error) {
    if (!(error instanceof HttpError && error.code === "UnsupportedCommand")) {
      throw error;
    }
  }
  throw new HttpError(
    422,
    "UnsupportedCommand",
    "Could not convert chat message into supported scene operations"
  );
};

export const buildCommandResponse = async (input: CommandRequest) => {
  try {
    const operations = parseSceneOperations(input);
    const thoughts = operations.map((operation, index) =>
      `${index + 1}. ${visibleStepForOperation(operation)}`
    );

    return commandResponseSchema.parse({
      ...(operations.length === 1 ? { operation: operations[0] } : { operations }),
      thoughts,
      message:
        operations.length === 1
          ? visibleStepForOperation(operations[0])
          : `I will run ${operations.length} editor tools in order.`
    });
  } catch (error) {
    if (error instanceof HttpError && error.code === "UnsupportedCommand") {
      return commandResponseSchema.parse({
        message: conversationalFallbackMessage(input)
      });
    }
    throw error;
  }
};

function conversationalFallbackMessage(input: CommandRequest) {
  const request = commandRequestSchema.parse(input);
  const objectCount = request.sceneContext.objects.length;
  const selectedObject = request.sceneContext.objects.find(
    (object) => object.id === request.sceneContext.selectedObjectId
  );

  if (/\b(what can you do|help|capabilities|how do you work)\b/i.test(request.message)) {
    const sceneSummary = objectCount
      ? `This scene has ${objectCount} object${objectCount === 1 ? "" : "s"}${selectedObject ? `, with ${selectedObject.label} selected` : ""}.`
      : "The scene is ready for imports, generated assets, physics edits, material edits, backgrounds, and exports.";
    return `${sceneSummary} Ask for a change directly, or ask a question about the current setup.`;
  }

  if (/\b(hi|hello|hey)\b/i.test(request.message)) {
    return selectedObject
      ? `Hi. ${selectedObject.label} is selected; what should happen to it?`
      : "Hi. What would you like to build or inspect in the scene?";
  }

  return selectedObject
    ? `${selectedObject.label} is selected. Ask a follow-up question or describe the edit you want.`
    : "Ask a question, describe a scene edit, or select an object and refer to it as this or it.";
}

const parseEnvironmentSceneCommand = (
  message: string,
  normalized: string
): SceneOperation | undefined => {
  if (!/\b(add|create|generate|make|build)\b/.test(normalized)) return undefined;
  const hasEnvironmentSubject = /\b(environment|room|apartment|landscape|world)\b/.test(normalized);
  const hasSceneSubject = /\bscene\b/.test(normalized) && !/\bbackground|backdrop|sky|horizon\b/.test(normalized);
  if (!hasEnvironmentSubject && !hasSceneSubject) return undefined;

  const scenePrompt = message
    .replace(/^\s*(please\s+)?(add|create|generate|make|build)\s+/i, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  const prompts = splitEnvironmentPrompts(scenePrompt || message.trim());

  return validateOperation({
    action: "generate_environment_scene",
    scenePrompt: prompts.scenePrompt,
    backgroundPrompt: prompts.backgroundPrompt,
    placement: { mode: "on_floor" }
  });
};

function splitEnvironmentPrompts(prompt: string) {
  const match = prompt.match(/\s+with\s+(?:a|an|the)?\s*(.+?\b(?:background|backdrop|sky|horizon))$/i);
  if (!match || match.index === undefined) {
    return { scenePrompt: prompt, backgroundPrompt: prompt };
  }

  const scenePrompt = prompt.slice(0, match.index).trim();
  const backgroundPrompt = match[1].trim();
  return {
    scenePrompt: scenePrompt || prompt,
    backgroundPrompt: backgroundPrompt || scenePrompt || prompt
  };
}

const parseBackgroundCommand = (
  message: string,
  normalized: string
): SceneOperation | undefined => {
  if (!/\b(background|backdrop|sky|horizon|environment)\b/.test(normalized)) {
    return undefined;
  }

  if (!/\b(generate|create|make|set|change|paint)\b/.test(normalized)) {
    return undefined;
  }

  const prompt = message
    .replace(/^\s*(please\s+)?(generate|create|make|set|change|paint)\s+/i, "")
    .replace(/\b(?:a|an|the)\b/gi, " ")
    .replace(/\b(?:scene|canvas|viewport)?\s*(background|backdrop|sky|horizon|environment)\b/gi, " background")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.!?]+$/, "");

  return validateOperation({
    action: "generate_background_image",
    prompt: prompt || message.trim()
  });
};

const parseGeneratedAssetCommand = (
  message: string,
  objects: SceneObject[]
): SceneOperation | undefined => {
  const normalized = normalize(message);

  if (!/\b(add|create|generate|put|place)\b/.test(normalized)) {
    return undefined;
  }

  const withoutVerb = message
    .replace(/^\s*(please\s+)?(add|create|generate|put|place)\s+/i, "")
    .trim();
  const [assetPart, targetPart] = splitPlacement(withoutVerb);
  const prompt = cleanupAssetPrompt(assetPart);
  const placement = placementFor(targetPart, objects);
  const wantsLocalFallback = /\b(local|fallback)\b/.test(normalized);
  const fallbackAssetKey = fallbackKeyFor(prompt);

  if (wantsLocalFallback && fallbackAssetKey) {
    return validateOperation({
      action: "add_local_object",
      fallbackAssetKey,
      placement
    });
  }

  return validateOperation({
    action: "add_generated_object",
    prompt,
    placement,
    fallbackAssetKey
  });
};

const parseTransformCommand = (
  message: string,
  normalized: string,
  objects: SceneObject[],
  selectedObjectId?: string
): SceneOperation | undefined => {
  const action = normalized.includes("move")
    ? "move_object"
    : normalized.includes("rotate")
      ? "rotate_object"
      : normalized.includes("scale")
        ? "scale_object"
        : undefined;

  if (!action) return undefined;
  const target = findMentionedObject(normalized, objects, selectedObjectId);
  if (!target) return undefined;
  const vector = parseVector3(message);
  if (!vector) return undefined;

  if (action === "move_object") {
    return validateOperation({ action, target: target.id, position: vector });
  }
  if (action === "rotate_object") {
    return validateOperation({ action, target: target.id, rotation: vector });
  }
  return validateOperation({ action, target: target.id, scale: vector });
};

const parseRelabelCommand = (
  message: string,
  normalized: string,
  objects: SceneObject[],
  selectedObjectId?: string
): SceneOperation | undefined => {
  if (!/\b(rename|relabel|call)\b/.test(normalized)) return undefined;
  const target = findMentionedObject(normalized, objects, selectedObjectId);
  if (!target) return undefined;

  const labelMatch = message.match(/\b(?:to|as)\s+(.+)$/i);
  const label = labelMatch?.[1]?.trim().replace(/[.!?]+$/, "");
  if (!label) return undefined;

  return validateOperation({
    action: "relabel_object",
    target: target.id,
    label
  });
};

const parseAppearanceCommand = (
  message: string,
  normalized: string,
  objects: SceneObject[],
  selectedObjectId?: string
): SceneOperation | undefined => {
  if (!/\b(make|set|turn|change|color|paint)\b/.test(normalized)) {
    return undefined;
  }

  const target = findMentionedObject(normalized, objects, selectedObjectId);
  if (!target) return undefined;

  const changes: Record<string, string | number> = {};
  const hex = message.match(/#[0-9a-fA-F]{6}\b/)?.[0];
  const namedColor = colorFor(normalized);
  const color = hex ?? namedColor;
  if (color) {
    changes.baseColor = color;
  }

  const roughness = numericProperty(message, "roughness");
  if (roughness !== undefined) changes.roughness = roughness;
  if (/\b(matte|flat|rough)\b/.test(normalized)) changes.roughness = changes.roughness ?? 0.9;
  if (/\b(glossy|shiny|polished|smooth)\b/.test(normalized)) changes.roughness = changes.roughness ?? 0.22;

  const metalness = numericProperty(message, "metalness") ?? numericProperty(message, "metallic");
  if (metalness !== undefined) changes.metalness = metalness;
  if (/\b(nonmetal|non metallic|not metallic|plastic)\b/.test(normalized)) {
    changes.metalness = 0;
  } else if (/\b(metallic|metal|chrome|steel)\b/.test(normalized)) {
    changes.metalness = changes.metalness ?? 0.85;
  }

  if (Object.keys(changes).length === 0) {
    return undefined;
  }

  return validateOperation({
    action: "update_object_appearance",
    target: target.id,
    changes
  });
};

const parsePhysicsCommand = (
  message: string,
  normalized: string,
  objects: SceneObject[],
  selectedObjectId?: string
): SceneOperation | undefined => {
  if (!/\b(make|set|turn)\b/.test(normalized)) {
    return undefined;
  }

  const target = findMentionedObject(normalized, objects, selectedObjectId);

  if (!target) {
    return undefined;
  }

  const friction = numericProperty(message, "friction");
  if (friction !== undefined) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { friction }
    });
  }

  const restitution = numericProperty(message, "restitution") ?? numericProperty(message, "bounce");
  if (restitution !== undefined) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { restitution }
    });
  }

  const massKg = numericProperty(message, "mass");
  if (massKg !== undefined) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { massKg }
    });
  }

  const collider = colliderFor(normalized);
  if (collider) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { collider }
    });
  }

  if (/\bbouncier|bounce|springier\b/.test(normalized)) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { restitution: 0.85 }
    });
  }

  if (/\bheavier|heavy\b/.test(normalized)) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { massKg: 8 }
    });
  }

  if (/\blighter|light\b/.test(normalized)) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { massKg: 0.5 }
    });
  }

  if (/\bstatic|fixed|immovable\b/.test(normalized)) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { static: true }
    });
  }

  if (/\bdynamic|movable\b/.test(normalized)) {
    return validateOperation({
      action: "update_object_physics",
      target: target.id,
      changes: { static: false }
    });
  }

  return undefined;
};

const parseRemoveCommand = (
  normalized: string,
  objects: SceneObject[],
  selectedObjectId?: string
): SceneOperation | undefined => {
  if (!/\b(delete|remove)\b/.test(normalized)) {
    return undefined;
  }

  const target = findMentionedObject(normalized, objects, selectedObjectId);

  if (!target) {
    return undefined;
  }

  return validateOperation({ action: "remove_object", target: target.id });
};

const splitPlacement = (value: string): [string, string | undefined] => {
  const match = value.match(/\s+(on|onto|in|inside|at)\s+(.+)$/i);

  if (!match || match.index === undefined) {
    return [value, undefined];
  }

  return [value.slice(0, match.index), match[2]];
};

const cleanupAssetPrompt = (value: string): string =>
  value
    .replace(/\b(local|fallback)\b/gi, "")
    .replace(/^(a|an|the)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

const parseVector3 = (message: string): [number, number, number] | undefined => {
  const match = message.match(
    /\b(?:to|at)\s+(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)/i
  );
  if (!match) return undefined;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
};

const placementFor = (
  targetPart: string | undefined,
  objects: SceneObject[]
): AssetPlacement => {
  if (!targetPart) {
    return { mode: "on_floor" };
  }

  const normalizedTarget = normalize(targetPart).replace(/^(a|an|the)\s+/, "");
  const target = findObjectByPhrase(normalizedTarget, objects);

  if (target) {
    return { mode: "on_object", target: target.id };
  }

  if (normalizedTarget.includes("floor") || normalizedTarget.includes("ground")) {
    return { mode: "on_floor" };
  }

  return { mode: "on_floor" };
};

const fallbackKeyFor = (prompt: string): FallbackAssetKey | undefined => {
  const normalizedPrompt = normalize(prompt);

  if (/\bduck\b/.test(normalizedPrompt)) {
    return fallbackAssetKeySchema.parse("duck");
  }

  if (/\bball|sphere|marble\b/.test(normalizedPrompt)) {
    return fallbackAssetKeySchema.parse("rubber_ball");
  }

  if (/\bcrate|box\b/.test(normalizedPrompt)) {
    return fallbackAssetKeySchema.parse("wooden_crate");
  }

  if (/\bvase|bottle|glass\b/.test(normalizedPrompt)) {
    return fallbackAssetKeySchema.parse("glass_vase");
  }

  if (/\bbarrel|drum\b/.test(normalizedPrompt)) {
    return fallbackAssetKeySchema.parse("metal_barrel");
  }

  return undefined;
};

const findMentionedObject = (
  normalizedMessage: string,
  objects: SceneObject[],
  selectedObjectId?: string
): SceneObject | undefined => {
  if (selectedObjectId && /\b(it|this|that|selected|selection|object)\b/.test(normalizedMessage)) {
    const selected = objects.find((object) => object.id === selectedObjectId);
    if (selected) return selected;
  }

  return objects.find((object) => {
    const label = normalize(object.label);
    const id = normalize(object.id).replaceAll("_", " ");
    return (
      normalizedMessage.includes(label) ||
      normalizedMessage.includes(id) ||
      label
        .split(" ")
        .filter((token) => token.length > 2)
        .some((token) => normalizedMessage.includes(token))
    );
  });
};

const findObjectByPhrase = (
  normalizedPhrase: string,
  objects: SceneObject[]
): SceneObject | undefined =>
  objects.find((object) => {
    const label = normalize(object.label);
    const id = normalize(object.id).replaceAll("_", " ");
    return (
      label.includes(normalizedPhrase) ||
      normalizedPhrase.includes(label) ||
      id.includes(normalizedPhrase) ||
      normalizedPhrase.includes(id)
    );
  });

const validateOperation = (operation: unknown): SceneOperation =>
  sceneOperationSchema.parse(operation);

const splitCommandSegments = (message: string): string[] =>
  message
    .split(/(?:\s*;\s*|\s+(?:and\s+then|then)\s+|\s+and\s+(?=(?:turn|toggle|move|rotate|scale|rename|relabel|call|make|set|delete|remove|add|create|generate|export|download|save)\b))/i)
    .map((segment) => segment.trim())
    .filter(Boolean);

function visibleStepForOperation(operation: SceneOperation): string {
  switch (operation.action) {
    case "add_generated_object":
      return `Create "${operation.prompt}" and place it in the scene.`;
    case "add_local_object":
      return `Insert the local ${operation.fallbackAssetKey.replaceAll("_", " ")} asset.`;
    case "remove_object":
      return `Remove ${operation.target}.`;
    case "move_object":
      return `Move ${operation.target} to ${operation.position.join(", ")}.`;
    case "rotate_object":
      return `Rotate ${operation.target} to ${operation.rotation.join(", ")}.`;
    case "scale_object":
      return `Scale ${operation.target} to ${operation.scale.join(", ")}.`;
    case "update_object_physics":
      return `Update physics on ${operation.target}.`;
    case "update_object_appearance":
      return `Update appearance on ${operation.target}.`;
    case "toggle_gravity":
      return operation.enabled ? "Turn gravity on." : "Turn gravity off.";
    case "toggle_collisions":
      return operation.enabled ? "Turn collisions on." : "Turn collisions off.";
    case "export_scene":
      return "Export the scene and physics metadata.";
    case "relabel_object":
      return `Rename ${operation.target} to "${operation.label}".`;
    case "generate_background_image":
      return `Generate a background image for "${operation.prompt}".`;
    case "generate_environment_scene":
      return `Generate an environment scene and matching background.`;
  }
}

const numericProperty = (value: string, name: string): number | undefined => {
  const normalized = value.toLowerCase().replace(/[^\w\s.=]/g, " ").replace(/\s+/g, " ").trim();
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalized.match(new RegExp(`\\b${escaped}\\b\\s*(?:to|=|at)?\\s*(\\d+(?:\\.\\d+)?)`));
  if (!match) return undefined;
  return Number(match[1]);
};

const colorFor = (normalized: string): string | undefined => {
  const colors: Record<string, string> = {
    red: "#ff0000",
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

  return Object.entries(colors).find(([name]) =>
    new RegExp(`\\b${name}\\b`).test(normalized)
  )?.[1];
};

const colliderFor = (normalized: string): "ball" | "cuboid" | "cylinder" | "convex_hull" | undefined => {
  if (/\b(ball|sphere|round)\b/.test(normalized)) return "ball";
  if (/\b(box|cube|cuboid)\b/.test(normalized)) return "cuboid";
  if (/\b(cylinder|tube|barrel)\b/.test(normalized)) return "cylinder";
  if (/\b(convex|hull|mesh)\b/.test(normalized)) return "convex_hull";
  return undefined;
};

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
