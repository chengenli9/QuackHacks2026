import { HttpError, errorMessage } from "../errors.js";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type GeminiResponseBody = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export async function requestGeminiJson<T>({
  apiKey,
  baseUrl,
  model,
  fetch,
  contents,
  responseJsonSchema,
}: {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetch: FetchLike;
  contents: unknown[];
  responseJsonSchema: unknown;
}): Promise<T> {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema
        }
      })
    }
  );

  const body = await readBody(response);

  if (!response.ok) {
    throw new HttpError(
      response.status,
      "GeminiRequestFailed",
      `Gemini request failed with status ${response.status}: ${body.error?.message ?? response.statusText}`,
      body
    );
  }

  const text = extractText(body);
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new HttpError(
      502,
      "GeminiInvalidJson",
      `Gemini returned invalid structured JSON: ${errorMessage(error)}`,
      body
    );
  }
}

async function readBody(response: Response): Promise<GeminiResponseBody> {
  try {
    return (await response.json()) as GeminiResponseBody;
  } catch (error) {
    throw new HttpError(
      502,
      "GeminiInvalidResponse",
      `Gemini returned invalid JSON: ${errorMessage(error)}`
    );
  }
}

function extractText(body: GeminiResponseBody): string {
  for (const candidate of body.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) return part.text;
    }
  }

  throw new HttpError(
    502,
    "GeminiInvalidResponse",
    "Gemini response did not include output text",
    body
  );
}
