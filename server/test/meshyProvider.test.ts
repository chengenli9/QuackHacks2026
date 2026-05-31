import { describe, expect, it, vi } from "vitest";
import { MeshyProvider } from "../src/providers/MeshyProvider.js";

const jsonResponse = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

describe("MeshyProvider", () => {
  it("creates preview text-to-3D tasks with GLB output", async () => {
    const fetch = vi.fn(async () => jsonResponse({ result: "meshy_task_1" }));
    const provider = new MeshyProvider({
      apiKey: "secret",
      baseUrl: "https://api.meshy.ai",
      fetch
    });

    const task = await provider.generateFromText({
      prompt: "rubber duck",
      style: "cartoon",
      targetFormat: "glb"
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://api.meshy.ai/openapi/v2/text-to-3d");
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        Authorization: "Bearer secret",
        "Content-Type": "application/json"
      }
    });
    expect(JSON.parse(String(init?.body))).toEqual({
      mode: "preview",
      ai_model: "latest",
      prompt: "rubber duck, cartoon style",
      target_formats: ["glb"]
    });
    expect(task).toEqual({
      taskId: "meshy_task_1",
      provider: "meshy",
      status: "queued"
    });
  });

  it("starts a low-definition textured refine task after preview and exposes refined GLB URLs", async () => {
    const fetch = vi.fn(async (url, init) => {
      if (String(url).endsWith("/openapi/v2/text-to-3d") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return jsonResponse({ result: body.mode === "preview" ? "preview_task_1" : "refine_task_1" });
      }
      if (String(url).endsWith("/openapi/v2/text-to-3d/preview_task_1")) {
        return jsonResponse({
          id: "preview_task_1",
          type: "text-to-3d-preview",
          status: "SUCCEEDED",
          progress: 100,
          prompt: "rubber duck",
          task_error: { message: "" }
        });
      }
      return jsonResponse({
        id: "refine_task_1",
        type: "text-to-3d-refine",
        status: "SUCCEEDED",
        progress: 100,
        prompt: "rubber duck",
        thumbnail_url: "https://assets.example/preview.png",
        model_urls: {
          glb: "https://assets.example/textured.glb"
        },
        task_error: { message: "" }
      });
    });
    const provider = new MeshyProvider({
      apiKey: "secret",
      baseUrl: "https://api.meshy.ai",
      fetch
    });

    await provider.generateFromText({
      prompt: "rubber duck",
      targetFormat: "glb"
    });

    await expect(provider.getTask("preview_task_1")).resolves.toEqual({
      taskId: "preview_task_1",
      status: "running",
      progress: 50
    });

    const [, refineInit] = fetch.mock.calls.find(([, init]) => {
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      return body?.mode === "refine";
    }) ?? [];
    expect(JSON.parse(String(refineInit?.body))).toEqual({
      mode: "refine",
      ai_model: "latest",
      preview_task_id: "preview_task_1",
      texture_prompt: "rubber duck",
      enable_pbr: false,
      hd_texture: false,
      remove_lighting: true,
      target_formats: ["glb"],
      auto_size: true,
      origin_at: "bottom"
    });

    await expect(provider.getTask("preview_task_1")).resolves.toEqual({
      taskId: "preview_task_1",
      status: "succeeded",
      progress: 100,
      modelUrl: "https://assets.example/textured.glb"
    });

    await expect(provider.getModel("preview_task_1")).resolves.toEqual({
      id: "preview_task_1",
      provider: "meshy",
      sourcePrompt: "rubber duck",
      glbUrl: "https://assets.example/textured.glb",
      thumbnailUrl: "https://assets.example/preview.png",
      metadata: {
        meshyStatus: "SUCCEEDED",
        meshyStage: "refine",
        previewTaskId: "preview_task_1",
        refineTaskId: "refine_task_1",
        textured: true,
        pbr: false
      }
    });
  });

  it("uses Meshy's lowpoly model type instead of only prompt styling", async () => {
    const fetch = vi.fn(async () => jsonResponse({ result: "meshy_task_lowpoly" }));
    const provider = new MeshyProvider({
      apiKey: "secret",
      baseUrl: "https://api.meshy.ai",
      fetch
    });

    await provider.generateFromText({
      prompt: "wooden crate",
      style: "lowpoly",
      targetFormat: "glb"
    });

    const [, init] = fetch.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      mode: "preview",
      ai_model: "latest",
      prompt: "wooden crate",
      model_type: "lowpoly",
      target_formats: ["glb"]
    });
  });

  it("prompts Meshy for complete environment scenes when requested", async () => {
    const fetch = vi.fn(async () => jsonResponse({ result: "meshy_scene_task" }));
    const provider = new MeshyProvider({
      apiKey: "secret",
      baseUrl: "https://api.meshy.ai",
      fetch
    });

    await provider.generateFromText({
      prompt: "neon sci-fi apartment",
      assetType: "environment_scene",
      targetFormat: "glb"
    });

    const [, init] = fetch.mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      mode: "preview",
      ai_model: "latest",
      prompt: "neon sci-fi apartment, complete 3D environment scene, cohesive floor and room-scale props",
      target_formats: ["glb"]
    });
  });

  it("surfaces Meshy API errors with response details", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({ message: "Insufficient credits" }, false, 402)
    );
    const provider = new MeshyProvider({
      apiKey: "secret",
      baseUrl: "https://api.meshy.ai",
      fetch
    });

    await expect(
      provider.generateFromText({ prompt: "duck", targetFormat: "glb" })
    ).rejects.toThrow("Meshy request failed with status 402: Insufficient credits");
  });

  it("requires a textured refine task before returning generated model metadata", async () => {
    const fetch = vi.fn(async () =>
      jsonResponse({
        id: "meshy_task_1",
        status: "IN_PROGRESS",
        progress: 50,
        prompt: "rubber duck",
        model_urls: {}
      })
    );
    const provider = new MeshyProvider({
      apiKey: "secret",
      baseUrl: "https://api.meshy.ai",
      fetch
    });

    await expect(provider.getModel("meshy_task_1")).rejects.toThrow(
      "Meshy task meshy_task_1 has no textured refine task yet"
    );
  });

  it("keeps refined tasks running until the textured GLB URL is present", async () => {
    const fetch = vi.fn(async (url, init) => {
      if (String(url).endsWith("/openapi/v2/text-to-3d") && init?.method === "POST") {
        const body = JSON.parse(String(init.body));
        return jsonResponse({ result: body.mode === "preview" ? "preview_task_1" : "refine_task_1" });
      }
      if (String(url).endsWith("/openapi/v2/text-to-3d/preview_task_1")) {
        return jsonResponse({
          id: "preview_task_1",
          status: "SUCCEEDED",
          progress: 100,
          prompt: "rubber duck"
        });
      }
      return jsonResponse({
        id: "refine_task_1",
        status: "SUCCEEDED",
        progress: 100,
        prompt: "rubber duck",
        model_urls: {}
      });
    });
    const provider = new MeshyProvider({
      apiKey: "secret",
      baseUrl: "https://api.meshy.ai",
      fetch
    });

    await provider.generateFromText({ prompt: "rubber duck", targetFormat: "glb" });
    await provider.getTask("preview_task_1");

    await expect(provider.getTask("preview_task_1")).resolves.toEqual({
      taskId: "preview_task_1",
      status: "running",
      progress: 100
    });
  });
});
