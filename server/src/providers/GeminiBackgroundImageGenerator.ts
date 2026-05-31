import { DEFAULT_GEMINI_IMAGE_MODEL } from "../config.js";
import { HttpError } from "../errors.js";
import {
  backgroundImageRequestSchema,
  backgroundImageResponseSchema
} from "../schemas.js";
import type { BackgroundImageRequest, BackgroundImageResponse } from "../schemas.js";
import type { BackgroundImageGenerator } from "./BackgroundImageGenerator.js";
import type { FetchLike } from "./geminiUtils.js";

type GeminiBackgroundImageGeneratorOptions = {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetch?: FetchLike;
};

type GeminiImageResponseBody = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
        inline_data?: {
          mime_type?: string;
          data?: string;
        };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export class GeminiBackgroundImageGenerator implements BackgroundImageGenerator {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly fetch: FetchLike;

  constructor(options: GeminiBackgroundImageGeneratorOptions) {
    if (!options.apiKey.trim()) {
      throw new Error("GeminiBackgroundImageGenerator requires a non-empty API key");
    }

    this.apiKey = options.apiKey;
    this.model = options.model ?? DEFAULT_GEMINI_IMAGE_MODEL;
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta";
    this.fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async generate(input: BackgroundImageRequest): Promise<BackgroundImageResponse> {
    const request = backgroundImageRequestSchema.parse(input);
    let lastError: unknown;

    for (const model of candidateModels(this.model)) {
      try {
        return await this.generateWithModel(request, model);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private async generateWithModel(
    request: BackgroundImageRequest,
    model: string
  ): Promise<BackgroundImageResponse> {
    const response = await this.fetch(
      `${this.baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: backgroundPrompt(request.prompt) }]
            }
          ],
          generationConfig: {
            responseModalities: ["TEXT", "IMAGE"]
          }
        })
      }
    );

    const body = await readGeminiImageBody(response);
    if (!response.ok) {
      throw new HttpError(
        response.status,
        "GeminiBackgroundImageFailed",
        `Gemini background image generation failed with status ${response.status}: ${body.error?.message ?? response.statusText}`,
        body
      );
    }

    const parsed = extractImagePart(body);
    return backgroundImageResponseSchema.parse({
      provider: "gemini",
      model,
      prompt: request.prompt,
      revisedPrompt: parsed.text,
      mimeType: parsed.mimeType,
      imageDataUrl: `data:${parsed.mimeType};base64,${parsed.data}`
    });
  }
}

function candidateModels(primaryModel: string): string[] {
  return Array.from(new Set([
    primaryModel,
    ...(primaryModel === DEFAULT_GEMINI_IMAGE_MODEL ? [] : [DEFAULT_GEMINI_IMAGE_MODEL])
  ]));
}

function backgroundPrompt(userPrompt: string): string {
  return [
    "Create a wide background for a 3D grid editor scene.",
    "It must sit behind editable GLB objects without looking like a foreground object.",
    "Use strong atmospheric depth, no UI, no text, no product labels, no isolated props, and no floor-breaking perspective.",
    "Keep it suitable for a grid graphics scene with clear horizon/sky/environment lighting.",
    `Requested background: ${userPrompt}`
  ].join(" ");
}

async function readGeminiImageBody(response: Response): Promise<GeminiImageResponseBody> {
  try {
    return (await response.json()) as GeminiImageResponseBody;
  } catch {
    throw new HttpError(
      502,
      "GeminiInvalidResponse",
      "Gemini returned invalid JSON for background image generation"
    );
  }
}

function extractImagePart(body: GeminiImageResponseBody): {
  data: string;
  mimeType: string;
  text?: string;
} {
  let text: string | undefined;

  for (const candidate of body.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text && !text) text = part.text;
      const inlineData = part.inlineData ?? (
        part.inline_data
          ? {
              mimeType: part.inline_data.mime_type,
              data: part.inline_data.data
            }
          : undefined
      );

      if (inlineData?.data && inlineData.mimeType) {
        return {
          data: inlineData.data,
          mimeType: inlineData.mimeType,
          text
        };
      }
    }
  }

  throw new HttpError(
    502,
    "GeminiImageMissing",
    "Gemini response did not include generated image data",
    body
  );
}
