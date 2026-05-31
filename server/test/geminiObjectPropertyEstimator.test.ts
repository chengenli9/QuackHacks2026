import { describe, expect, it } from "vitest";
import { GeminiObjectPropertyEstimator } from "../src/providers/GeminiObjectPropertyEstimator.js";

describe("GeminiObjectPropertyEstimator", () => {
  it("sends image previews through Gemini structured output and validates appearance metadata", async () => {
    let requestUrl = "";
    let requestBody: any;
    let requestApiKey = "";
    const estimator = new GeminiObjectPropertyEstimator({
      apiKey: "gemini-key",
      model: "gemini-3.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch: async (url, init) => {
        requestUrl = String(url);
        requestApiKey = String((init?.headers as Record<string, string>)["x-goog-api-key"]);
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        objectId: "geometry_0",
                        label: "yellow rubber duck",
                        category: "toy",
                        material: "rubber",
                        massKg: 0.24,
                        restitution: 0.74,
                        friction: 0.54,
                        static: false,
                        breakable: false,
                        collider: "cuboid",
                        confidence: 0.87,
                        notes: "Looks like a small rubber duck.",
                        appearance: {
                          baseColor: "#f6d334",
                          roughness: 0.68,
                          metalness: 0,
                          textureDescription: "matte yellow rubber",
                          source: "vlm"
                        }
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    });

    const result = await estimator.estimate({
      objectId: "geometry_0",
      label: "geometry_0",
      dimensions: [1, 1, 1],
      imageBase64: "abc123",
      imageMimeType: "image/png"
    });

    expect(requestUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent"
    );
    expect(requestApiKey).toBe("gemini-key");
    expect(requestBody.generationConfig.responseMimeType).toBe("application/json");
    expect(requestBody.generationConfig.responseJsonSchema.properties.appearance).toBeDefined();
    expect(requestBody.contents[0].parts[0].text).toContain("contextual object title");
    expect(requestBody.contents[0].parts[0].text).toContain("Do not keep generic labels like geometry_0");
    expect(requestBody.contents[0].parts[1]).toEqual({
      inlineData: { mimeType: "image/png", data: "abc123" }
    });
    expect(result.appearance?.baseColor).toBe("#f6d334");
    expect(result.appearance?.textureDescription).toBe("matte yellow rubber");
  });
});
