import { describe, expect, it } from "vitest";
import { parseSceneCommand } from "../src/services/commandParser.js";

const sceneContext = {
  objects: [
    { id: "duck_01", label: "rubber duck" },
    { id: "table_01", label: "coffee table" }
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
});
