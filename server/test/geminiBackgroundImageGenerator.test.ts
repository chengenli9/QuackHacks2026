import { describe, expect, it } from "vitest";
import { GeminiBackgroundImageGenerator } from "../src/providers/GeminiBackgroundImageGenerator.js";

describe("GeminiBackgroundImageGenerator", () => {
  it("generates a grid-scene background image with Gemini image output", async () => {
    let requestUrl = "";
    let requestBody: any;
    const generator = new GeminiBackgroundImageGenerator({
      apiKey: "gemini-key",
      model: "gemini-2.5-flash-image",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch: async (url, init) => {
        requestUrl = String(url);
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    { text: "Generated a wide starry-night backdrop." },
                    {
                      inlineData: {
                        mimeType: "image/png",
                        data: "abc123"
                      }
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

    const response = await generator.generate({ prompt: "deep starry night" });

    expect(requestUrl).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent"
    );
    expect(requestBody.contents[0].parts[0].text).toContain("background for a 3D grid editor scene");
    expect(requestBody.contents[0].parts[0].text).toContain("deep starry night");
    expect(response).toEqual({
      provider: "gemini",
      model: "gemini-2.5-flash-image",
      prompt: "deep starry night",
      revisedPrompt: "Generated a wide starry-night backdrop.",
      mimeType: "image/png",
      imageDataUrl: "data:image/png;base64,abc123"
    });
  });

  it("falls back to the documented Nano Banana image model when an override fails", async () => {
    const requestUrls: string[] = [];
    const generator = new GeminiBackgroundImageGenerator({
      apiKey: "gemini-key",
      model: "gemini-3.1-flash-lite-image-generation",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch: async (url) => {
        requestUrls.push(String(url));
        if (String(url).includes("gemini-3.1-flash-lite-image-generation")) {
          return new Response(
            JSON.stringify({ error: { message: "model not found" } }),
            { status: 404, headers: { "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: {
                        mimeType: "image/png",
                        data: "fallback123"
                      }
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

    const response = await generator.generate({ prompt: "neon horizon" });

    expect(requestUrls).toHaveLength(2);
    expect(response.model).toBe("gemini-2.5-flash-image");
    expect(response.imageDataUrl).toBe("data:image/png;base64,fallback123");
  });
});
