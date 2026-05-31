import {
  estimateObjectRequestSchema,
  objectPhysicsProfileSchema
} from "../schemas.js";
import { DEFAULT_GEMINI_MODEL } from "../config.js";
import type { ObjectEstimateInput, ObjectPhysicsProfile } from "../schemas.js";
import type { ObjectPropertyEstimator } from "./ObjectPropertyEstimator.js";
import { requestGeminiJson } from "./geminiUtils.js";
import type { FetchLike } from "./geminiUtils.js";

type GeminiObjectPropertyEstimatorOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

const objectPhysicsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    objectId: { type: "string" },
    label: { type: "string" },
    category: {
      type: "string",
      enum: ["toy", "furniture", "container", "tool", "decor", "unknown"]
    },
    material: {
      type: "string",
      enum: ["rubber", "wood", "glass", "metal", "plastic", "fabric", "unknown"]
    },
    massKg: { type: "number" },
    restitution: { type: "number", minimum: 0, maximum: 1 },
    friction: { type: "number", minimum: 0, maximum: 1 },
    static: { type: "boolean" },
    breakable: { type: "boolean" },
    collider: {
      type: "string",
      enum: ["ball", "cuboid", "cylinder", "convex_hull"]
    },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    notes: { type: "string" },
    appearance: {
      type: "object",
      additionalProperties: false,
      properties: {
        baseColor: { type: "string", description: "Hex RGB color such as #f6d334." },
        roughness: { type: "number", minimum: 0, maximum: 1 },
        metalness: { type: "number", minimum: 0, maximum: 1 },
        textureDescription: { type: "string" },
        source: { type: "string", enum: ["vlm"] }
      },
      required: ["baseColor", "roughness", "metalness", "textureDescription", "source"]
    }
  },
  required: [
    "objectId",
    "label",
    "category",
    "material",
    "massKg",
    "restitution",
    "friction",
    "static",
    "breakable",
    "collider",
    "confidence",
    "notes",
    "appearance"
  ]
};

export class GeminiObjectPropertyEstimator implements ObjectPropertyEstimator {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;

  constructor(options: GeminiObjectPropertyEstimatorOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("GeminiObjectPropertyEstimator requires a non-empty API key");
    }

    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_GEMINI_MODEL;
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async estimate(input: ObjectEstimateInput): Promise<ObjectPhysicsProfile> {
    const request = estimateObjectRequestSchema.parse(input);
    const parts: Array<unknown> = [
      {
        text:
          "Estimate game-ready semantic, material, appearance, and physics metadata for this GLB scene object. Return only JSON matching the schema. Favor simplified colliders and practical game physics over exact physical accuracy.\n\n" +
          JSON.stringify({
            objectId: request.objectId,
            label: request.label,
            sourcePrompt: request.sourcePrompt,
            dimensions: request.dimensions,
            meshMetadata: request.meshMetadata
          })
      }
    ];

    if (request.imageBase64 && request.imageMimeType) {
      parts.push({
        inlineData: {
          mimeType: request.imageMimeType,
          data: request.imageBase64
        }
      });
    }

    const profile = await requestGeminiJson<ObjectPhysicsProfile>({
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
      model: this.model,
      fetch: this.fetch,
      contents: [{ role: "user", parts }],
      responseJsonSchema: objectPhysicsJsonSchema
    });

    return objectPhysicsProfileSchema.parse(profile);
  }
}
