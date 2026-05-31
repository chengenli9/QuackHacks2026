import { HttpError, errorMessage } from "../errors.js";
import {
  estimateObjectRequestSchema,
  objectPhysicsProfileSchema
} from "../schemas.js";
import type { ObjectEstimateInput, ObjectPhysicsProfile } from "../schemas.js";
import type { ObjectPropertyEstimator } from "./ObjectPropertyEstimator.js";

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type OpenAIObjectPropertyEstimatorOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
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
    notes: { type: "string" }
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

export class OpenAIObjectPropertyEstimator implements ObjectPropertyEstimator {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;

  constructor(options: OpenAIObjectPropertyEstimatorOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("OpenAIObjectPropertyEstimator requires a non-empty API key");
    }

    this.apiKey = options.apiKey;
    this.model = options.model ?? "gpt-4.1-mini";
    this.baseUrl = (options.baseUrl ?? "https://api.openai.com/v1").replace(/\/+$/, "");
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async estimate(input: ObjectEstimateInput): Promise<ObjectPhysicsProfile> {
    const request = estimateObjectRequestSchema.parse(input);
    const response = await this.requestJson<OpenAIResponseBody>("/responses", {
      method: "POST",
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "system",
            content:
              "Estimate game-ready physics metadata for a 3D scene object. Return only the requested JSON object."
          },
          {
            role: "user",
            content: JSON.stringify(request)
          }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "object_physics_profile",
            strict: true,
            schema: objectPhysicsJsonSchema
          }
        }
      })
    });

    return objectPhysicsProfileSchema.parse(JSON.parse(this.extractOutputText(response)));
  }

  private async requestJson<T>(path: string, init: RequestInit): Promise<T> {
    const response = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {})
      }
    });

    const body = await this.readBody(response);

    if (!response.ok) {
      const message = this.extractErrorMessage(body) ?? response.statusText;
      throw new HttpError(
        response.status,
        "OpenAIRequestFailed",
        `OpenAI request failed with status ${response.status}: ${message}`,
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
        "OpenAIInvalidJson",
        `OpenAI returned invalid JSON: ${errorMessage(error)}`
      );
    }
  }

  private extractOutputText(body: OpenAIResponseBody): string {
    if (body.output_text) {
      return body.output_text;
    }

    for (const output of body.output ?? []) {
      for (const content of output.content ?? []) {
        if (content.type === "output_text" && content.text) {
          return content.text;
        }
      }
    }

    throw new HttpError(
      502,
      "OpenAIInvalidResponse",
      "OpenAI response did not include output text",
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
