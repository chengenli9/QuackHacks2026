import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { GeneratedAsset } from "../schemas.js";

export class GeneratedAssetCache {
  private readonly assets = new Map<string, GeneratedAsset>();

  constructor(private readonly storageDir?: string) {}

  save(asset: GeneratedAsset): GeneratedAsset {
    this.assets.set(asset.id, asset);
    this.writeToDisk(asset);
    return asset;
  }

  get(id: string): GeneratedAsset | undefined {
    const cached = this.assets.get(id);

    if (cached) {
      return cached;
    }

    const stored = this.readFromDisk(id);

    if (stored) {
      this.assets.set(stored.id, stored);
    }

    return stored;
  }

  private writeToDisk(asset: GeneratedAsset): void {
    if (!this.storageDir) {
      return;
    }

    mkdirSync(this.storageDir, { recursive: true });
    writeFileSync(this.pathFor(asset.id), `${JSON.stringify(asset, null, 2)}\n`, "utf8");
  }

  private readFromDisk(id: string): GeneratedAsset | undefined {
    if (!this.storageDir) {
      return undefined;
    }

    const path = this.pathFor(id);

    if (!existsSync(path)) {
      return undefined;
    }

    return JSON.parse(readFileSync(path, "utf8")) as GeneratedAsset;
  }

  private pathFor(id: string): string {
    return join(this.storageDir ?? "", `${id.replace(/[^a-zA-Z0-9._-]/g, "_")}.json`);
  }
}
