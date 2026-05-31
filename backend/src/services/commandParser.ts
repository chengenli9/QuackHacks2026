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

  if (normalized.includes("gravity")) {
    return validateOperation({
      action: "toggle_gravity",
      enabled: !/\b(off|disable|stop)\b/.test(normalized)
    });
  }

  if (/\b(export|download|save)\b/.test(normalized)) {
    return validateOperation({ action: "export_scene" });
  }

  const transform = parseTransformCommand(message, normalized, request.sceneContext.objects);
  if (transform) {
    return transform;
  }

  const relabel = parseRelabelCommand(message, normalized, request.sceneContext.objects);
  if (relabel) {
    return relabel;
  }

  const generated = parseGeneratedAssetCommand(message, request.sceneContext.objects);
  if (generated) {
    return generated;
  }

  const physics = parsePhysicsCommand(normalized, request.sceneContext.objects);
  if (physics) {
    return physics;
  }

  const remove = parseRemoveCommand(normalized, request.sceneContext.objects);
  if (remove) {
    return remove;
  }

  throw new HttpError(
    422,
    "UnsupportedCommand",
    "Could not convert chat message into a supported scene operation"
  );
};

export const buildCommandResponse = (input: CommandRequest) =>
  commandResponseSchema.parse({ operation: parseSceneCommand(input) });

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
  objects: SceneObject[]
): SceneOperation | undefined => {
  const action = normalized.includes("move")
    ? "move_object"
    : normalized.includes("rotate")
      ? "rotate_object"
      : normalized.includes("scale")
        ? "scale_object"
        : undefined;

  if (!action) return undefined;
  const target = findMentionedObject(normalized, objects);
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
  objects: SceneObject[]
): SceneOperation | undefined => {
  if (!/\b(rename|relabel|call)\b/.test(normalized)) return undefined;
  const target = findMentionedObject(normalized, objects);
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

const parsePhysicsCommand = (
  normalized: string,
  objects: SceneObject[]
): SceneOperation | undefined => {
  if (!/\b(make|set|turn)\b/.test(normalized)) {
    return undefined;
  }

  const target = findMentionedObject(normalized, objects);

  if (!target) {
    return undefined;
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
  objects: SceneObject[]
): SceneOperation | undefined => {
  if (!/\b(delete|remove)\b/.test(normalized)) {
    return undefined;
  }

  const target = findMentionedObject(normalized, objects);

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
  objects: SceneObject[]
): SceneObject | undefined =>
  objects.find((object) => {
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

const validateOperation = (operation: SceneOperation): SceneOperation =>
  sceneOperationSchema.parse(operation);

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
