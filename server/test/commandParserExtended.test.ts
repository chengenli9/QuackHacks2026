import { describe, expect, it } from "vitest";
import { FallbackCommandParser } from "../src/services/fallbackCommandParser.js";
import {
  buildCommandResponse,
  parseSceneCommand,
  parseSceneOperations
} from "../src/services/commandParser.js";

const sceneContext = {
  objects: [
    {
      id: "duck_01",
      label: "rubber duck",
      material: "rubber",
      position: [0, 1, 0],
      static: false
    },
    {
      id: "table_01",
      label: "coffee table",
      category: "furniture",
      material: "wood",
      position: [0, 0, 0],
      static: true
    }
  ]
};

describe("extended local command parser", () => {
  it("parses local fallback insertion commands", () => {
    expect(
      parseSceneCommand({
        message: "add local duck on the coffee table",
        sceneContext
      })
    ).toEqual({
      action: "add_local_object",
      fallbackAssetKey: "duck",
      placement: { mode: "on_object", target: "table_01" }
    });
  });

  it("parses move rotate scale and relabel commands", () => {
    expect(
      parseSceneCommand({
        message: "move the duck to 1 2 3",
        sceneContext
      })
    ).toEqual({ action: "move_object", target: "duck_01", position: [1, 2, 3] });

    expect(
      parseSceneCommand({
        message: "rotate the duck to 0 1.57 0",
        sceneContext
      })
    ).toEqual({ action: "rotate_object", target: "duck_01", rotation: [0, 1.57, 0] });

    expect(
      parseSceneCommand({
        message: "scale the duck to 2 2 2",
        sceneContext
      })
    ).toEqual({ action: "scale_object", target: "duck_01", scale: [2, 2, 2] });

    expect(
      parseSceneCommand({
        message: "rename the duck to bath toy",
        sceneContext
      })
    ).toEqual({ action: "relabel_object", target: "duck_01", label: "bath toy" });
  });

  it("parses multi-tool prompts into ordered operations", async () => {
    const command = {
      message: "turn gravity off and move the duck to 1 2 3",
      sceneContext: {
        ...sceneContext,
        selectedObjectId: "duck_01"
      }
    };

    expect(parseSceneOperations(command)).toEqual([
      { action: "toggle_gravity", enabled: false },
      { action: "move_object", target: "duck_01", position: [1, 2, 3] }
    ]);

    await expect(buildCommandResponse(command)).resolves.toEqual({
      operations: [
        { action: "toggle_gravity", enabled: false },
        { action: "move_object", target: "duck_01", position: [1, 2, 3] }
      ],
      thoughts: ["1. Turn gravity off.", "2. Move duck_01 to 1, 2, 3."],
      message: "I will run 2 editor tools in order."
    });
  });

  it("parses multi-object material edits from one prompt", () => {
    expect(
      parseSceneOperations({
        message: "make the duck red and the table blue",
        sceneContext
      })
    ).toEqual([
      {
        action: "update_object_appearance",
        target: "duck_01",
        changes: { baseColor: "#ff0000" }
      },
      {
        action: "update_object_appearance",
        target: "table_01",
        changes: { baseColor: "#1f6fff" }
      }
    ]);
  });

  it("parses multiple property categories across multiple objects", () => {
    expect(
      parseSceneOperations({
        message: "make the duck red and bouncy, make the table metallic and fixed",
        sceneContext
      })
    ).toEqual([
      {
        action: "update_object_appearance",
        target: "duck_01",
        changes: { baseColor: "#ff0000" }
      },
      {
        action: "update_object_physics",
        target: "duck_01",
        changes: { restitution: 0.85 }
      },
      {
        action: "update_object_appearance",
        target: "table_01",
        changes: { metalness: 0.85 }
      },
      {
        action: "update_object_physics",
        target: "table_01",
        changes: { static: true }
      }
    ]);
  });

  it("parses all-object batch appearance edits", () => {
    expect(
      parseSceneOperations({
        message: "make all objects matte green and nonmetallic",
        sceneContext
      })
    ).toEqual([
      {
        action: "update_object_appearance",
        target: "duck_01",
        changes: { baseColor: "#00a651", roughness: 0.9, metalness: 0 }
      },
      {
        action: "update_object_appearance",
        target: "table_01",
        changes: { baseColor: "#00a651", roughness: 0.9, metalness: 0 }
      }
    ]);
  });

  it("uses the selected object for this/it follow-up editing commands", () => {
    expect(
      parseSceneCommand({
        message: "make it bouncier",
        sceneContext: {
          ...sceneContext,
          selectedObjectId: "duck_01"
        }
      })
    ).toEqual({
      action: "update_object_physics",
      target: "duck_01",
      changes: { restitution: 0.85 }
    });
  });

  it("parses collision and material editing commands", () => {
    expect(
      parseSceneCommand({
        message: "turn collisions off",
        sceneContext
      })
    ).toEqual({ action: "toggle_collisions", enabled: false });

    expect(
      parseSceneCommand({
        message: "make the duck bright red and metallic",
        sceneContext
      })
    ).toEqual({
      action: "update_object_appearance",
      target: "duck_01",
      changes: { baseColor: "#ff0000", metalness: 0.85 }
    });
  });

  it("parses numeric physics and background generation commands", () => {
    expect(
      parseSceneCommand({
        message: "set duck friction to 0.2",
        sceneContext
      })
    ).toEqual({
      action: "update_object_physics",
      target: "duck_01",
      changes: { friction: 0.2 }
    });

    expect(
      parseSceneCommand({
        message: "generate a deep starry night background",
        sceneContext
      })
    ).toEqual({
      action: "generate_background_image",
      prompt: "deep starry night background"
    });
  });

  it("parses environment scene generation as a scene GLB plus grid-suited background", () => {
    expect(
      parseSceneCommand({
        message: "create a neon sci-fi apartment environment scene",
        sceneContext
      })
    ).toEqual({
      action: "generate_environment_scene",
      scenePrompt: "neon sci-fi apartment environment scene",
      backgroundPrompt: "neon sci-fi apartment environment scene",
      placement: { mode: "on_floor" }
    });

    expect(
      parseSceneCommand({
        message: "create a neon sci-fi apartment environment with a deep starry night background",
        sceneContext
      })
    ).toEqual({
      action: "generate_environment_scene",
      scenePrompt: "neon sci-fi apartment environment",
      backgroundPrompt: "deep starry night background",
      placement: { mode: "on_floor" }
    });
  });

  it("returns conversational messages when no scene tool is needed", async () => {
    const response = await buildCommandResponse({
      message: "what can you help me do?",
      sceneContext
    });

    expect(response.message).toContain("scene");
    expect(response.message).not.toContain("I can chat about the scene");
  });

  it("answers scene questions without canned edit fallback text", async () => {
    const response = await buildCommandResponse({
      message: "why is the duck falling?",
      sceneContext: {
        ...sceneContext,
        selectedObjectId: "duck_01",
        gravityEnabled: true,
        collisionsEnabled: true
      }
    });

    expect(response.message).toContain("gravity");
    expect(response.message).toContain("rubber duck");
    expect(response.message).not.toContain("Ask a question");
    expect(response.message).not.toContain("describe the edit");
  });

  it("falls back to local parsing when the primary command parser fails", async () => {
    const parser = new FallbackCommandParser(
      {
        async parse() {
          throw new Error("Gemini unavailable");
        }
      },
      {
        async parse() {
          return {
            operation: { action: "toggle_gravity", enabled: false }
          };
        }
      }
    );

    await expect(
      parser.parse({ message: "turn gravity off", sceneContext })
    ).resolves.toEqual({
      operation: { action: "toggle_gravity", enabled: false }
    });
  });
});
