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

    expect(requestBody.generationConfig).toEqual({
      responseMimeType: "application/json"
    });
    expect(requestBody.contents[0].parts[0].text).toContain("Available tools");
    expect(requestBody.contents[0].parts[0].text).toContain("update_object_appearance");
    expect(requestBody.contents[0].parts[0].text).toContain("generate_environment_scene");
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

  it("delegates contextual all-object floor and locking decisions to Gemini tools", async () => {
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
                        operations: [
                          { action: "move_object", target: "tray_01", position: [2, 0.1, 4] },
                          {
                            action: "update_object_physics",
                            target: "tray_01",
                            changes: { static: true }
                          },
                          { action: "move_object", target: "vase_01", position: [-1, 0.6, 0.5] },
                          {
                            action: "update_object_physics",
                            target: "vase_01",
                            changes: { static: true }
                          }
                        ],
                        thoughts: [
                          "Move each object to rest on the floor.",
                          "Set each object to fixed/static."
                        ]
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

    await expect(
      parser.parse({
        message: "Lock all the objects and bring them to the floor area",
        sceneContext: {
          objects: [
            {
              id: "tray_01",
              label: "decorative metal tray",
              material: "metal",
              position: [2, 3, 4],
              dimensions: [2, 0.2, 1],
              static: false
            },
            {
              id: "vase_01",
              label: "glass vase",
              material: "glass",
              position: [-1, 2, 0.5],
              dimensions: [0.4, 1.2, 0.4],
              static: false
            }
          ],
          selectedObjectId: "tray_01"
        }
      })
    ).resolves.toMatchObject({
      operations: [
        { action: "move_object", target: "tray_01", position: [2, 0.1, 4] },
        { action: "update_object_physics", target: "tray_01", changes: { static: true } },
        { action: "move_object", target: "vase_01", position: [-1, 0.6, 0.5] },
        { action: "update_object_physics", target: "vase_01", changes: { static: true } }
      ]
    });

    const prompt = requestBody.contents[0].parts[0].text;
    expect(prompt).toContain("Do not rely on local keyword parsing");
    expect(prompt).toContain("Infer the target objects and tools from the full scene context");
    expect(prompt).toContain("resting on the floor");
    expect(prompt).toContain("position.y should normally be half of that object's height");
    expect(prompt).toContain('"label":"decorative metal tray"');
  });

  it("instructs Gemini not to turn scene-wide background requests into selected-object edits", async () => {
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
                          action: "generate_background_image",
                          prompt: "low-poly field with a black sky with orange highlights"
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

    await expect(
      parser.parse({
        message: "Make the background a low-poly field with a black sky with orange highlights",
        sceneContext: {
          objects: [{ id: "geometry_4", label: "geometry 4" }],
          selectedObjectId: "geometry_4"
        }
      })
    ).resolves.toEqual({
      operation: {
        action: "generate_background_image",
        prompt: "low-poly field with a black sky with orange highlights"
      }
    });

    const prompt = requestBody.contents[0].parts[0].text;
    expect(prompt).toContain("Do not assume the selected object is the target");
    expect(prompt).toContain("Background, backdrop, sky, horizon, and environment-image requests are scene-wide");
    expect(prompt).toContain("not update_object_appearance");
    expect(prompt).toContain('"selectedObjectId":"geometry_4"');
  });

  it("normalizes Gemini JSON-mode tool aliases before schema validation", async () => {
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
                        thoughts: "Create a scene-wide background image.",
                        operations: [
                          {
                            tool: "generate_background_image",
                            arguments: {
                              prompt: "low-poly field with a black sky with orange highlights"
                            }
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
        message: "Make the background a low-poly field with a black sky with orange highlights",
        sceneContext: {
          objects: [{ id: "geometry_4", label: "geometry 4" }],
          selectedObjectId: "geometry_4"
        }
      })
    ).resolves.toEqual({
      thoughts: ["Create a scene-wide background image."],
      operations: [
        {
          action: "generate_background_image",
          prompt: "low-poly field with a black sky with orange highlights"
        }
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

  it("normalizes Gemini appearance change aliases before validation", async () => {
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
                        operations: [
                          {
                            tool: "update_object_appearance",
                            arguments: {
                              target: "geometry_1",
                              changes: { color: "red" }
                            }
                          },
                          {
                            tool: "update_object_appearance",
                            arguments: {
                              target: "geometry_4",
                              changes: { color: "red" }
                            }
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
        message: "mske the objcts red",
        sceneContext: {
          objects: [
            { id: "geometry_1", label: "geometry 1" },
            { id: "geometry_4", label: "geometry 4" }
          ],
          selectedObjectId: "geometry_4"
        }
      })
    ).resolves.toEqual({
      operations: [
        {
          action: "update_object_appearance",
          target: "geometry_1",
          changes: { baseColor: "#ff0000" }
        },
        {
          action: "update_object_appearance",
          target: "geometry_4",
          changes: { baseColor: "#ff0000" }
        }
      ]
    });
  });
});
