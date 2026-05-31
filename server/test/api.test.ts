import { afterEach, describe, expect, it, vi } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";
import type {
  AssetGenerationTask,
  AssetGenerationTaskStatus,
  AssetGenerator,
  GeneratedAsset,
  TextAssetGenerationInput
} from "../src/providers/AssetGenerator.js";
import type { BackgroundImageGenerator } from "../src/providers/BackgroundImageGenerator.js";
import type { CommandParser } from "../src/providers/CommandParser.js";

class FakeAssetGenerator implements AssetGenerator {
  public readonly generateFromText = vi.fn(
    async (input: TextAssetGenerationInput): Promise<AssetGenerationTask> => ({
      taskId: `task-for-${input.prompt.replaceAll(" ", "-")}`,
      provider: "meshy",
      status: "queued"
    })
  );

  public readonly getTask = vi.fn(
    async (taskId: string): Promise<AssetGenerationTaskStatus> => ({
      taskId,
      status: "running",
      progress: 42,
      modelUrl: undefined
    })
  );

  public readonly getModel = vi.fn(
    async (taskId: string): Promise<GeneratedAsset> => ({
      id: taskId,
      provider: "meshy",
      sourcePrompt: "rubber duck",
      glbUrl: `https://assets.example/${taskId}.glb`,
      thumbnailUrl: `https://assets.example/${taskId}.png`,
      metadata: { providerTaskId: taskId }
    })
  );
}

class FakeCommandParser implements CommandParser {
  async parse() {
    return {
      operation: {
        action: "toggle_gravity" as const,
        enabled: true
      }
    };
  }
}

class FakeBackgroundImageGenerator implements BackgroundImageGenerator {
  async generate() {
    return {
      provider: "gemini" as const,
      model: "gemini-2.5-flash-image",
      prompt: "deep starry night",
      revisedPrompt: "Generated a wide starry-night backdrop.",
      mimeType: "image/png",
      imageDataUrl: "data:image/png;base64,abc123"
    };
  }
}

describe("backend API", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("parses a generated asset chat command into a validated operation", async () => {
    app = await createApp({ assetGenerator: new FakeAssetGenerator() });

    const response = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: {
        message: "add a rubber duck on the coffee table",
        sceneContext: {
          objects: [{ id: "coffee_table_01", label: "coffee table" }]
        }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      operation: {
        action: "add_generated_object",
        prompt: "rubber duck",
        placement: { mode: "on_object", target: "coffee_table_01" },
        fallbackAssetKey: "duck"
      }
    });
  });

  it("parses common non-generation chat commands", async () => {
    app = await createApp({ assetGenerator: new FakeAssetGenerator() });

    const gravity = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: { message: "turn gravity on", sceneContext: { objects: [] } }
    });
    expect(gravity.statusCode).toBe(200);
    expect(gravity.json()).toEqual({
      operation: { action: "toggle_gravity", enabled: true }
    });

    const bouncy = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: {
        message: "make the duck bouncier",
        sceneContext: { objects: [{ id: "duck_01", label: "rubber duck" }] }
      }
    });
    expect(bouncy.statusCode).toBe(200);
    expect(bouncy.json()).toEqual({
      operation: {
        action: "update_object_physics",
        target: "duck_01",
        changes: { restitution: 0.85 }
      }
    });
  });

  it("routes chat commands through the configured command parser provider", async () => {
    app = await createApp({
      assetGenerator: new FakeAssetGenerator(),
      commandParser: new FakeCommandParser()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/command",
      payload: { message: "please handle this", sceneContext: { objects: [] } }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      operation: { action: "toggle_gravity", enabled: true }
    });
  });

  it("generates background images through the configured provider", async () => {
    app = await createApp({
      assetGenerator: new FakeAssetGenerator(),
      backgroundImageGenerator: new FakeBackgroundImageGenerator()
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/background-image",
      payload: { prompt: "deep starry night" }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      provider: "gemini",
      model: "gemini-2.5-flash-image",
      prompt: "deep starry night",
      revisedPrompt: "Generated a wide starry-night backdrop.",
      mimeType: "image/png",
      imageDataUrl: "data:image/png;base64,abc123"
    });
  });

  it("starts Meshy asset generation through the configured provider", async () => {
    const generator = new FakeAssetGenerator();
    app = await createApp({ assetGenerator: generator });

    const response = await app.inject({
      method: "POST",
      url: "/api/generate-asset",
      payload: {
        prompt: "rubber duck",
        style: "cartoon",
        targetFormat: "glb"
      }
    });

    expect(response.statusCode).toBe(202);
    expect(generator.generateFromText).toHaveBeenCalledWith({
      prompt: "rubber duck",
      style: "cartoon",
      targetFormat: "glb"
    });
    expect(response.json()).toEqual({
      taskId: "task-for-rubber-duck",
      provider: "meshy",
      status: "queued"
    });
  });

  it("validates asset generation requests", async () => {
    app = await createApp({ assetGenerator: new FakeAssetGenerator() });

    const response = await app.inject({
      method: "POST",
      url: "/api/generate-asset",
      payload: { prompt: "", targetFormat: "obj" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "ValidationError"
    });
  });

  it("returns generated asset task status and model metadata", async () => {
    const { mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const generator = new FakeAssetGenerator();
    app = await createApp({
      assetGenerator: generator,
      generatedAssetStorageDir: mkdtempSync(join(tmpdir(), "api-generated-assets-")),
      publicBaseUrl: "http://localhost:8787",
      fetch: vi.fn(async () => new Response(Buffer.from("glb"), { status: 200 }))
    });

    const status = await app.inject({
      method: "GET",
      url: "/api/generated-assets/task_123/status"
    });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toEqual({
      taskId: "task_123",
      status: "running",
      progress: 42
    });

    const model = await app.inject({
      method: "GET",
      url: "/api/generated-assets/task_123/model"
    });

    expect(model.statusCode).toBe(200);
    expect(model.json()).toEqual({
      id: "task_123",
      provider: "meshy",
      sourcePrompt: "rubber duck",
      glbUrl: "http://localhost:8787/api/generated-assets/task_123/model.glb",
      cachedGlbUrl: "http://localhost:8787/api/generated-assets/task_123/model.glb",
      originalGlbUrl: "https://assets.example/task_123.glb",
      thumbnailUrl: "https://assets.example/task_123.png",
      metadata: {
        providerTaskId: "task_123",
        originalGlbUrl: "https://assets.example/task_123.glb"
      }
    });
  });

  it("returns deterministic local fallback assets only through explicit fallback route", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const fallbackAssetDir = mkdtempSync(join(tmpdir(), "api-fallback-assets-"));
    writeFileSync(join(fallbackAssetDir, "duck.glb"), Buffer.from("duck"));

    app = await createApp({
      assetGenerator: new FakeAssetGenerator(),
      fallbackAssetDir,
      publicBaseUrl: "http://localhost:8787"
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/generated-assets/fallback",
      payload: {
        fallbackAssetKey: "duck",
        sourcePrompt: "rubber duck"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      id: "local-duck",
      provider: "local",
      sourcePrompt: "rubber duck",
      glbUrl: "http://localhost:8787/assets/fallback/duck.glb",
      metadata: { fallbackAssetKey: "duck" }
    });
  });

  it("estimates object physics profiles with deterministic local rules", async () => {
    app = await createApp({ assetGenerator: new FakeAssetGenerator() });

    const response = await app.inject({
      method: "POST",
      url: "/api/estimate-object",
      payload: {
        objectId: "duck_01",
        label: "rubber duck",
        sourcePrompt: "rubber duck",
        dimensions: [0.24, 0.18, 0.2]
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      objectId: "duck_01",
      label: "rubber duck",
      category: "toy",
      material: "rubber",
      massKg: 0.2,
      restitution: 0.7,
      friction: 0.55,
      static: false,
      breakable: false,
      collider: "cuboid",
      confidence: 0.72,
      notes: "Estimated locally from object label, prompt, and dimensions."
    });
  });
});
