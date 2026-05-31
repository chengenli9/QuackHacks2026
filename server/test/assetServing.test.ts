import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

class FakeRemoteModelGenerator implements AssetGenerator {
  public readonly getModel = vi.fn(
    async (taskId: string): Promise<GeneratedAsset> => ({
      id: taskId,
      provider: "meshy",
      sourcePrompt: "rubber duck",
      glbUrl: `https://assets.example/${taskId}.glb`,
      metadata: { providerTaskId: taskId }
    })
  );

  async generateFromText(input: TextAssetGenerationInput): Promise<AssetGenerationTask> {
    return { taskId: input.prompt, provider: "meshy", status: "queued" };
  }

  async getTask(taskId: string): Promise<AssetGenerationTaskStatus> {
    return { taskId, status: "succeeded", progress: 100 };
  }
}

describe("asset serving and caching", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("serves existing fallback GLB files and rejects missing fallback files before returning metadata", async () => {
    const fallbackDir = mkdtempSync(join(tmpdir(), "fallback-assets-"));
    writeFileSync(join(fallbackDir, "duck.glb"), Buffer.from("duck-glb"));

    app = await createApp({
      assetGenerator: new FakeRemoteModelGenerator(),
      fallbackAssetDir: fallbackDir,
      publicBaseUrl: "http://localhost:8787"
    });

    const served = await app.inject({ method: "GET", url: "/assets/fallback/duck.glb" });
    expect(served.statusCode).toBe(200);
    expect(served.body).toBe("duck-glb");

    const metadata = await app.inject({
      method: "POST",
      url: "/api/generated-assets/fallback",
      payload: { fallbackAssetKey: "duck", sourcePrompt: "rubber duck" }
    });
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json().glbUrl).toBe("http://localhost:8787/assets/fallback/duck.glb");

    const missing = await app.inject({
      method: "POST",
      url: "/api/generated-assets/fallback",
      payload: { fallbackAssetKey: "wooden_crate", sourcePrompt: "wooden crate" }
    });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({
      error: "FallbackAssetFileMissing"
    });
  });

  it("downloads Meshy GLBs into backend cache and serves cached model bytes", async () => {
    const storageDir = mkdtempSync(join(tmpdir(), "generated-assets-"));
    const generator = new FakeRemoteModelGenerator();
    const fetch = vi.fn(async () => new Response(Buffer.from("cached-glb"), { status: 200 }));
    app = await createApp({
      assetGenerator: generator,
      generatedAssetStorageDir: storageDir,
      publicBaseUrl: "http://localhost:8787",
      fetch
    });

    const metadata = await app.inject({ method: "GET", url: "/api/generated-assets/task_123/model" });
    expect(metadata.statusCode).toBe(200);
    expect(metadata.json()).toMatchObject({
      id: "task_123",
      provider: "meshy",
      glbUrl: "http://localhost:8787/api/generated-assets/task_123/model.glb",
      cachedGlbUrl: "http://localhost:8787/api/generated-assets/task_123/model.glb",
      originalGlbUrl: "https://assets.example/task_123.glb"
    });
    expect(fetch).toHaveBeenCalledTimes(1);

    const bytes = await app.inject({ method: "GET", url: "/api/generated-assets/task_123/model.glb" });
    expect(bytes.statusCode).toBe(200);
    expect(bytes.body).toBe("cached-glb");

    const cached = await app.inject({ method: "GET", url: "/api/generated-assets/task_123/model" });
    expect(cached.statusCode).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(generator.getModel).toHaveBeenCalledTimes(1);
  });

  it("re-proxies stale metadata that predates backend GLB caching", async () => {
    const storageDir = mkdtempSync(join(tmpdir(), "stale-generated-assets-"));
    writeFileSync(
      join(storageDir, "task_stale.json"),
      `${JSON.stringify({
        id: "task_stale",
        provider: "meshy",
        sourcePrompt: "rubber duck",
        glbUrl: "https://assets.example/stale.glb",
        metadata: { providerTaskId: "task_stale" }
      })}\n`
    );
    const fetch = vi.fn(async () => new Response(Buffer.from("reproxied-glb"), { status: 200 }));
    app = await createApp({
      assetGenerator: new FakeRemoteModelGenerator(),
      generatedAssetStorageDir: storageDir,
      publicBaseUrl: "http://localhost:8787",
      fetch
    });

    const metadata = await app.inject({ method: "GET", url: "/api/generated-assets/task_stale/model" });

    expect(metadata.statusCode).toBe(200);
    expect(metadata.json().glbUrl).toBe("http://localhost:8787/api/generated-assets/task_stale/model.glb");
    expect(metadata.json().originalGlbUrl).toBe("https://assets.example/stale.glb");
    expect(fetch).toHaveBeenCalledWith("https://assets.example/stale.glb");
  });

  it("returns a typed error when backend GLB proxy download fails", async () => {
    const storageDir = mkdtempSync(join(tmpdir(), "generated-assets-"));
    app = await createApp({
      assetGenerator: new FakeRemoteModelGenerator(),
      generatedAssetStorageDir: storageDir,
      fetch: vi.fn(async () => new Response("not found", { status: 404 }))
    });

    const response = await app.inject({ method: "GET", url: "/api/generated-assets/task_404/model" });
    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({
      error: "GeneratedAssetDownloadFailed"
    });
  });
});
