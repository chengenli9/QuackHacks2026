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
      additionalProperties: true,
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
            "toggle_gravity",
            "export_scene",
            "relabel_object"
          ]
        }
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
                "Convert the user's editor request into one validated scene operation. Use only object IDs from sceneContext when targeting existing objects. For add requests, prefer add_generated_object with placement on the mentioned object when possible. Return only JSON.\n\n" +
                JSON.stringify(request)
            }
          ]
        }
      ],
      responseJsonSchema: sceneOperationJsonSchema
    });

    return commandResponseSchema.parse(response);
  }
}
