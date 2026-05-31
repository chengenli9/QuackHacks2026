import { mkdtempSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createApp } from "../src/app.js";

describe("project persistence API", () => {
  let app: FastifyInstance | undefined;

  afterEach(async () => {
    if (app) {
      await app.close();
      app = undefined;
    }
  });

  it("returns a typed 404 when no saved project exists", async () => {
    app = await createApp({
      projectStorageDir: mkdtempSync(join(tmpdir(), "roomcraft-projects-"))
    });

    const response = await app.inject({ method: "GET", url: "/api/projects/last" });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "ProjectNotFound" });
  });

  it("stores and reloads the last project snapshot", async () => {
    const projectStorageDir = mkdtempSync(join(tmpdir(), "roomcraft-projects-"));
    app = await createApp({ projectStorageDir });
    const snapshot = {
      version: 1,
      savedAt: "2026-05-30T22:00:00.000Z",
      project: {
        importedGlbFileName: "chaoman.glb",
        sceneObjects: [{ id: "mesh10", label: "Mesh10" }],
        assetSources: [{ id: "asset_1", type: "url", url: "/chaoman.glb" }]
      }
    };

    const saved = await app.inject({
      method: "PUT",
      url: "/api/projects/last",
      payload: snapshot
    });

    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toEqual({ ok: true, projectId: "last-project", savedAt: snapshot.savedAt });

    const loaded = await app.inject({ method: "GET", url: "/api/projects/last" });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json()).toEqual(snapshot);

    const storedFile = await readFile(join(projectStorageDir, "last-project", "project.json"), "utf8");
    expect(JSON.parse(storedFile)).toEqual(snapshot);
  });

  it("stores, lists, and reloads named project folders", async () => {
    const projectStorageDir = mkdtempSync(join(tmpdir(), "roomcraft-projects-"));
    app = await createApp({ projectStorageDir });
    const snapshot = {
      version: 1,
      savedAt: "2026-05-30T22:30:00.000Z",
      project: {
        projectId: "demo-night-room",
        projectName: "Demo Night Room",
        importedGlbFileName: "room.glb",
        sceneObjects: [{ id: "chair_01", label: "chair" }],
        assetSources: []
      }
    };

    const saved = await app.inject({
      method: "PUT",
      url: "/api/projects/demo-night-room",
      payload: snapshot
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject({ ok: true, projectId: "demo-night-room" });

    const list = await app.inject({ method: "GET", url: "/api/projects" });
    expect(list.statusCode).toBe(200);
    expect(list.json().projects).toEqual([
      expect.objectContaining({
        id: "demo-night-room",
        name: "Demo Night Room",
        importedGlbFileName: "room.glb",
        objectCount: 1
      })
    ]);

    const loaded = await app.inject({ method: "GET", url: "/api/projects/demo-night-room" });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json()).toEqual(snapshot);

    const storedFile = await readFile(join(projectStorageDir, "demo-night-room", "project.json"), "utf8");
    expect(JSON.parse(storedFile)).toEqual(snapshot);
  });

  it("bundles data-url GLBs and generated backgrounds into the saved project folder", async () => {
    const projectStorageDir = mkdtempSync(join(tmpdir(), "roomcraft-projects-"));
    app = await createApp({
      projectStorageDir,
      publicBaseUrl: "http://localhost:8787"
    });
    const snapshot = {
      version: 1,
      savedAt: "2026-05-30T22:00:00.000Z",
      project: {
        importedGlbFileName: "duck.glb",
        sceneObjects: [{ id: "duck_01", label: "duck", source: { assetId: "asset_duck" } }],
        assetSources: [
          {
            id: "asset_duck",
            type: "data-url",
            fileName: "duck.glb",
            mimeType: "model/gltf-binary",
            dataUrl: "data:model/gltf-binary;base64,Z2xi"
          }
        ],
        sceneBackground: {
          id: "background_1",
          prompt: "neon horizon",
          imageDataUrl: "data:image/png;base64,cG5n",
          status: "ready",
          error: null
        },
        backgroundGallery: [
          {
            id: "background_1",
            prompt: "neon horizon",
            imageDataUrl: "data:image/png;base64,cG5n"
          }
        ]
      }
    };

    const saved = await app.inject({
      method: "PUT",
      url: "/api/projects/last",
      payload: snapshot
    });
    expect(saved.statusCode).toBe(200);

    const loaded = await app.inject({ method: "GET", url: "/api/projects/last" });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json().project.assetSources[0]).toMatchObject({
      id: "asset_duck",
      type: "url",
      fileName: "duck.glb",
      url: "http://localhost:8787/api/projects/last-project/assets/asset_duck.glb"
    });
    expect(loaded.json().project.assetSources[0].dataUrl).toBeUndefined();
    expect(loaded.json().project.sceneBackground.imageDataUrl).toBe(
      "http://localhost:8787/api/projects/last-project/backgrounds/background_1.png"
    );
    expect(loaded.json().project.backgroundGallery[0].imageDataUrl).toBe(
      "http://localhost:8787/api/projects/last-project/backgrounds/background_1.png"
    );

    const asset = await app.inject({
      method: "GET",
      url: "/api/projects/last-project/assets/asset_duck.glb"
    });
    expect(asset.statusCode).toBe(200);
    expect(asset.body).toBe("glb");

    const background = await app.inject({
      method: "GET",
      url: "/api/projects/last-project/backgrounds/background_1.png"
    });
    expect(background.statusCode).toBe(200);
    expect(background.body).toBe("png");
  });
});
