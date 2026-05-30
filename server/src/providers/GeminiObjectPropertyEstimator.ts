import { HttpError, errorMessage } from "../errors.js";
import {
  estimateObjectRequestSchema,
  objectPhysicsProfileSchema
} from "../schemas.js";
import type { ObjectEstimateInput, ObjectPhysicsProfile } from "../schemas.js";
import type { ObjectPropertyEstimator } from "./ObjectPropertyEstimator.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type GeminiObjectPropertyEstimatorOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

type GeminiResponseBody = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
};

const objectPhysicsJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    objectId: {
      type: "string",
      description: "Stable app object id provided in the request."
    },
    label: {
      type: "string",
      description: "Short human-readable object label inferred from the image."
    },
    category: {
      type: "string",
      enum: ["toy", "furniture", "container", "tool", "decor", "unknown"]
    },
    material: {
      type: "string",
      enum: ["rubber", "wood", "glass", "metal", "plastic", "fabric", "unknown"]
    },
    massKg: {
      type: "number",
      minimum: 0.01,
      description: "Estimated mass in kilograms for game-like physics."
    },
    restitution: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Bounciness coefficient from 0 to 1."
    },
    friction: {
      type: "number",
      minimum: 0,
      maximum: 1,
      description: "Surface friction coefficient from 0 to 1."
    },
    static: {
      type: "boolean",
      description: "True for fixed large environment/furniture objects."
    },
    breakable: {
      type: "boolean",
      description: "True if the object is plausibly fragile."
    },
    collider: {
      type: "string",
      enum: ["ball", "cuboid", "cylinder", "convex_hull"],
      description: "Simplified collider, never a dynamic trimesh."
    },
    confidence: {
      type: "number",
      minimum: 0,
      maximum: 1
    },
    notes: {
      type: "string",
      description: "One concise sentence explaining the visual estimate."
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
    "notes"
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
    this.model = options.model ?? "gemini-3.1-flash-lite-preview";
    this.baseUrl = (options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta").replace(
      /\/+$/,
      ""
    );
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async estimate(input: ObjectEstimateInput): Promise<ObjectPhysicsProfile> {
    const request = estimateObjectRequestSchema.parse(input);
    const response = await this.requestJson<GeminiResponseBody>(
      `/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        method: "POST",
        body: JSON.stringify(this.buildRequestBody(request))
      }
    );

    return objectPhysicsProfileSchema.parse(JSON.parse(this.extractOutputText(response)));
  }

  private buildRequestBody(request: ObjectEstimateInput) {
    return {
      contents: [
        {
          parts: [
            {
              text: this.promptFor(request)
            },
            ...(request.imageBase64 && request.imageMimeType
              ? [
                  {
                    inline_data: {
                      mime_type: request.imageMimeType,
                      data: request.imageBase64
                    }
                  }
                ]
              : [])
          ]
        }
      ],
      generationConfig: {
        responseFormat: {
          text: {
            mimeType: "application/json",
            schema: objectPhysicsJsonSchema
          }
        }
      }
    };
  }

  private promptFor(request: ObjectEstimateInput): string {
    return [
      "Estimate game-ready physics metadata for the 3D scene object shown in the image.",
      "Use visual appearance first. Use the provided node label, dimensions, and mesh metadata only as supporting hints.",
      "Prefer simplified colliders: ball, cuboid, cylinder, or convex_hull. Do not choose dynamic trimesh.",
      "Return the exact request objectId unchanged.",
      `Request metadata: ${JSON.stringify({
        objectId: request.objectId,
        label: request.label,
        sourcePrompt: request.sourcePrompt,
        dimensions: request.dimensions,
        meshMetadata: request.meshMetadata
      })}`
    ].join("\n");
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "x-goog-api-key": this.apiKey,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    const body = await this.readBody(response);

    if (!response.ok) {
      const message = this.extractErrorMessage(body) ?? response.statusText;
      throw new HttpError(
        response.status,
        "GeminiRequestFailed",
        `Gemini request failed with status ${response.status}: ${message}`,
        body
      );
    }

    return body as T;
  }

  private async readBody(response: Response): Promise<unknown> {
    try {
      return await response.json();
    } catch (error) {
      throw new HttpError(
        502,
        "GeminiInvalidJson",
        `Gemini returned invalid JSON: ${errorMessage(error)}`
      );
    }
  }

  private extractOutputText(body: GeminiResponseBody): string {
    for (const candidate of body.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.text) {
          return part.text;
        }
      }
    }

    throw new HttpError(
      502,
      "GeminiInvalidResponse",
      "Gemini response did not include output text",
      body
    );
  }

  private extractErrorMessage(body: unknown): string | undefined {
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "object" &&
      body.error !== null &&
      "message" in body.error
    ) {
      return String(body.error.message);
    }

    if (typeof body === "object" && body !== null && "message" in body) {
      return String(body.message);
    }

    return undefined;
  }
}
