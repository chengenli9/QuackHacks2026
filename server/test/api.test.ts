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
import type {
  ObjectEstimateInput,
  ObjectPhysicsProfile,
  ObjectPropertyEstimator
} from "../src/providers/ObjectPropertyEstimator.js";

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

class FakeObjectPropertyEstimator implements ObjectPropertyEstimator {
  public readonly estimate = vi.fn(
    async (input: ObjectEstimateInput): Promise<ObjectPhysicsProfile> => ({
      objectId: input.objectId,
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
      notes: "Estimated from screenshot."
    })
  );
}

describe("backend API", () => {
  let app: FastifyInstance | undefined;
  const originalEnv = { ...process.env };

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
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
    const generator = new FakeAssetGenerator();
    app = await createApp({ assetGenerator: generator });

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
      glbUrl: "https://assets.example/task_123.glb",
      thumbnailUrl: "https://assets.example/task_123.png",
      metadata: { providerTaskId: "task_123" }
    });
  });

  it("returns deterministic local fallback assets only through explicit fallback route", async () => {
    app = await createApp({
      assetGenerator: new FakeAssetGenerator(),
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

  it("accepts object screenshot data for VLM-backed physics estimation", async () => {
    const estimator = new FakeObjectPropertyEstimator();
    app = await createApp({
      assetGenerator: new FakeAssetGenerator(),
      objectEstimator: estimator
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/estimate-object",
      payload: {
        objectId: "asset_001",
        label: "geometry_0",
        imageBase64: "ZmFrZS1pbWFnZQ==",
        imageMimeType: "image/png",
        dimensions: [0.25, 0.7, 0.25],
        meshMetadata: { nodeName: "geometry_0" }
      }
    });

    expect(response.statusCode).toBe(200);
    expect(estimator.estimate).toHaveBeenCalledWith({
      objectId: "asset_001",
      label: "geometry_0",
      imageBase64: "ZmFrZS1pbWFnZQ==",
      imageMimeType: "image/png",
      dimensions: [0.25, 0.7, 0.25],
      meshMetadata: { nodeName: "geometry_0" }
    });
    expect(response.json()).toMatchObject({
      objectId: "asset_001",
      label: "ceramic vase",
      collider: "cylinder",
      confidence: 0.84
    });
  });

  it("uses Gemini as the default estimator when GEMINI_API_KEY is configured", async () => {
    process.env.GEMINI_API_KEY = "gemini-secret";
    process.env.GEMINI_MODEL = "gemini-3.1-flash-lite-preview";
    delete process.env.OPENAI_API_KEY;

    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify({
                      objectId: "asset_001",
                      label: "rubber ball",
                      category: "toy",
                      material: "rubber",
                      massKg: 0.35,
                      restitution: 0.85,
                      friction: 0.45,
                      static: false,
                      breakable: false,
                      collider: "ball",
                      confidence: 0.88,
                      notes: "The image shows a small round rubber ball."
                    })
                  }
                ]
              }
            }
          ]
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    app = await createApp({ assetGenerator: new FakeAssetGenerator() });

    const response = await app.inject({
      method: "POST",
      url: "/api/estimate-object",
      payload: {
        objectId: "asset_001",
        imageBase64: "ZmFrZS1pbWFnZQ==",
        imageMimeType: "image/png"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      objectId: "asset_001",
      label: "rubber ball",
      collider: "ball",
      confidence: 0.88
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent",
      expect.objectContaining({
        headers: expect.objectContaining({
          "x-goog-api-key": "gemini-secret"
        })
      })
    );
  });
});
