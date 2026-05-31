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
    expect(saved.json()).toEqual({ ok: true, savedAt: snapshot.savedAt });

    const loaded = await app.inject({ method: "GET", url: "/api/projects/last" });
    expect(loaded.statusCode).toBe(200);
    expect(loaded.json()).toEqual(snapshot);

    const storedFile = await readFile(join(projectStorageDir, "last-project.json"), "utf8");
    expect(JSON.parse(storedFile)).toEqual(snapshot);
  });
});
