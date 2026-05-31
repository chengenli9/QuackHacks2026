import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GeneratedAssetCache } from "../src/services/generatedAssetCache.js";
import type { GeneratedAsset } from "../src/schemas.js";

describe("GeneratedAssetCache", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))
    );
    tempDirs.length = 0;
  });

  it("persists generated asset metadata to local filesystem storage", async () => {
    const storageDir = await mkdtemp(join(tmpdir(), "quackhacks-cache-"));
    tempDirs.push(storageDir);
    const asset: GeneratedAsset = {
      id: "meshy_task_1",
      provider: "meshy",
      sourcePrompt: "rubber duck",
      glbUrl: "https://assets.example/model.glb",
      metadata: { meshyStatus: "SUCCEEDED" }
    };

    const cache = new GeneratedAssetCache(storageDir);
    cache.save(asset);

    const stored = JSON.parse(
      await readFile(join(storageDir, "meshy_task_1.json"), "utf8")
    );
    expect(stored).toEqual(asset);

    const reloadedCache = new GeneratedAssetCache(storageDir);
    expect(reloadedCache.get("meshy_task_1")).toEqual(asset);
  });
});
