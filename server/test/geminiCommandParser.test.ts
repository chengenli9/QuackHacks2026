import { describe, expect, it } from "vitest";
import { GeminiCommandParser } from "../src/providers/GeminiCommandParser.js";

describe("GeminiCommandParser", () => {
  it("uses Gemini structured output for scene commands", async () => {
    let requestBody: any;
    const parser = new GeminiCommandParser({
      apiKey: "gemini-key",
      model: "gemini-3.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch: async (_url, init) => {
        requestBody = JSON.parse(String(init?.body));
        return new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        operation: {
                          action: "update_object_physics",
                          target: "duck_01",
                          changes: { restitution: 0.9 }
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

    const response = await parser.parse({
      message: "make the duck bouncier",
      sceneContext: { objects: [{ id: "duck_01", label: "rubber duck" }] }
    });

    expect(requestBody.generationConfig.responseMimeType).toBe("application/json");
    expect(requestBody.generationConfig.responseJsonSchema.properties.operation).toBeDefined();
    expect(requestBody.generationConfig.responseJsonSchema.properties.operations).toBeDefined();
    expect(requestBody.generationConfig.responseJsonSchema.properties.operation.properties.target).toBeDefined();
    expect(requestBody.generationConfig.responseJsonSchema.properties.operation.properties.changes).toBeDefined();
    expect(
      requestBody.generationConfig.responseJsonSchema.properties.operation.properties.action.enum
    ).toContain("update_object_appearance");
    expect(
      requestBody.generationConfig.responseJsonSchema.properties.operation.properties.action.enum
    ).toContain("generate_environment_scene");
    expect(requestBody.contents[0].parts[0].text).toContain("Available tools");
    expect(requestBody.contents[0].parts[0].text).toContain("Reply conversationally");
    expect(requestBody.contents[0].parts[0].text).toContain("one or more ordered editor tool calls");
    expect(requestBody.contents[0].parts[0].text).toContain("one tool call per target object");
    expect(requestBody.contents[0].parts[0].text).toContain("current object transforms");
    expect(response.operation).toEqual({
      action: "update_object_physics",
      target: "duck_01",
      changes: { restitution: 0.9 }
    });
  });

  it("allows Gemini to respond conversationally without forcing a tool call", async () => {
    const parser = new GeminiCommandParser({
      apiKey: "gemini-key",
      model: "gemini-3.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        message: "I can help edit objects, physics, materials, backgrounds, and exports."
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    await expect(
      parser.parse({
        message: "what can you do?",
        sceneContext: { objects: [] }
      })
    ).resolves.toEqual({
      message: "I can help edit objects, physics, materials, backgrounds, and exports."
    });
  });

  it("allows Gemini to return multiple ordered tool calls with visible plan lines", async () => {
    const parser = new GeminiCommandParser({
      apiKey: "gemini-key",
      model: "gemini-3.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        thoughts: ["Disable gravity first.", "Move the duck after that."],
                        operations: [
                          { action: "toggle_gravity", enabled: false },
                          {
                            action: "move_object",
                            target: "duck_01",
                            position: [1, 2, 3]
                          }
                        ]
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    await expect(
      parser.parse({
        message: "turn gravity off and move the duck",
        sceneContext: { objects: [{ id: "duck_01", label: "rubber duck" }] }
      })
    ).resolves.toEqual({
      thoughts: ["Disable gravity first.", "Move the duck after that."],
      operations: [
        { action: "toggle_gravity", enabled: false },
        { action: "move_object", target: "duck_01", position: [1, 2, 3] }
      ]
    });
  });

  it("normalizes Gemini color names into validated appearance operations", async () => {
    const parser = new GeminiCommandParser({
      apiKey: "gemini-key",
      model: "gemini-3.5-flash",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta",
      fetch: async () =>
        new Response(
          JSON.stringify({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify({
                        operation: {
                          action: "update_object_appearance",
                          target: "duck_01",
                          changes: { baseColor: "crimson", metalness: 0.2 }
                        }
                      })
                    }
                  ]
                }
              }
            ]
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    });

    await expect(
      parser.parse({
        message: "make the duck crimson",
        sceneContext: { objects: [{ id: "duck_01", label: "rubber duck" }] }
      })
    ).resolves.toEqual({
      operation: {
        action: "update_object_appearance",
        target: "duck_01",
        changes: { baseColor: "#dc143c", metalness: 0.2 }
      }
    });
  });
});
