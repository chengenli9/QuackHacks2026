import { describe, expect, it, vi } from "vitest";
import { GeminiObjectPropertyEstimator } from "../src/providers/GeminiObjectPropertyEstimator.js";

const profile = {
  objectId: "asset_001",
  label: "ceramic vase",
  category: "decor",
  material: "glass",
  massKg: 0.9,
  restitution: 0.08,
  friction: 0.48,
  static: false,
  breakable: true,
  collider: "cylinder",
  confidence: 0.84,
  notes: "The object appears to be a narrow decorative vase."
};

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

describe("GeminiObjectPropertyEstimator", () => {
  it("requests structured physics metadata from Gemini using inline image data", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(profile) }]
            }
          }
        ]
      })
    );
    const estimator = new GeminiObjectPropertyEstimator({
      apiKey: "secret",
      model: "gemini-3.1-flash-lite-preview",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch
    });

    await expect(
      estimator.estimate({
        objectId: "asset_001",
        label: "geometry_0",
        imageBase64: "ZmFrZS1wbmc=",
        imageMimeType: "image/png",
        dimensions: [0.25, 0.7, 0.25],
        meshMetadata: { nodeName: "geometry_0" }
      })
    ).resolves.toEqual(profile);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent"
    );
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        "x-goog-api-key": "secret",
        "Content-Type": "application/json"
      }
    });

    const body = JSON.parse(String(init?.body));
    expect(body.contents[0].parts).toEqual([
      expect.objectContaining({
        text: expect.stringContaining("Estimate game-ready physics metadata")
      }),
      {
        inline_data: {
          mime_type: "image/png",
          data: "ZmFrZS1wbmc="
        }
      }
    ]);
    expect(body.generationConfig.responseFormat.text).toMatchObject({
      mimeType: "application/json",
      schema: expect.objectContaining({
        type: "object",
        required: expect.arrayContaining(["objectId", "label", "collider"])
      })
    });
  });

  it("surfaces Gemini API errors with response details", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({ error: { message: "model unavailable" } }, false, 404)
    );
    const estimator = new GeminiObjectPropertyEstimator({
      apiKey: "secret",
      fetch
    });

    await expect(
      estimator.estimate({
        objectId: "asset_001",
        imageBase64: "ZmFrZS1qcGc=",
        imageMimeType: "image/jpeg"
      })
    ).rejects.toThrow("Gemini request failed with status 404: model unavailable");
  });

  it("rejects Gemini responses with no output text", async () => {
    const fetch = vi.fn(async () => jsonResponse({ candidates: [] }));
    const estimator = new GeminiObjectPropertyEstimator({
      apiKey: "secret",
      fetch
    });

    await expect(
      estimator.estimate({
        objectId: "asset_001",
        imageBase64: "ZmFrZS13ZWJw",
        imageMimeType: "image/webp"
      })
    ).rejects.toThrow("Gemini response did not include output text");
  });
});
