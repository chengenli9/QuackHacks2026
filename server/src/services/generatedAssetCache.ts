import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { HttpError } from "../errors.js";
import type { GeneratedAsset } from "../schemas.js";

export class GeneratedAssetCache {
  private readonly assets = new Map<string, GeneratedAsset>();

  constructor(
    private readonly storageDir?: string,
    private readonly publicBaseUrl = "http://localhost:8787",
    private readonly fetchImpl: typeof fetch = globalThis.fetch
  ) {}

  save(asset: GeneratedAsset): GeneratedAsset {
    this.assets.set(asset.id, asset);
    this.writeToDisk(asset);
    return asset;
  }

  async saveRemoteModel(asset: GeneratedAsset): Promise<GeneratedAsset> {
    const originalGlbUrl = asset.originalGlbUrl ?? asset.glbUrl;
    const response = await this.fetchImpl(originalGlbUrl);

    if (!response.ok) {
      throw new HttpError(
        502,
        "GeneratedAssetDownloadFailed",
        `Could not download generated GLB from provider: ${response.status}`
      );
    }

    const bytes = Buffer.from(await response.arrayBuffer());
    this.writeModelToDisk(asset.id, bytes);

    return this.save({
      ...asset,
      glbUrl: this.modelUrlFor(asset.id),
      cachedGlbUrl: this.modelUrlFor(asset.id),
      originalGlbUrl,
      metadata: {
        ...(asset.metadata ?? {}),
        originalGlbUrl
      }
    });
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

  modelFilePath(id: string): string {
    return this.pathFor(id, ".glb");
  }

  hasModelFile(id: string): boolean {
    return existsSync(this.modelFilePath(id));
  }

  private writeToDisk(asset: GeneratedAsset): void {
    if (!this.storageDir) {
      return;
    }

    mkdirSync(this.storageDir, { recursive: true });
    writeFileSync(this.pathFor(asset.id, ".json"), `${JSON.stringify(asset, null, 2)}\n`, "utf8");
  }

  private writeModelToDisk(id: string, bytes: Buffer): void {
    if (!this.storageDir) {
      throw new HttpError(
        500,
        "GeneratedAssetStorageUnavailable",
        "Generated asset storage directory is not configured"
      );
    }

    mkdirSync(this.storageDir, { recursive: true });
    writeFileSync(this.modelFilePath(id), bytes);
  }

  private readFromDisk(id: string): GeneratedAsset | undefined {
    if (!this.storageDir) {
      return undefined;
    }

    const path = this.pathFor(id, ".json");

    if (!existsSync(path)) {
      return undefined;
    }

    return JSON.parse(readFileSync(path, "utf8")) as GeneratedAsset;
  }

  private pathFor(id: string, extension: ".json" | ".glb"): string {
    return join(this.storageDir ?? "", `${id.replace(/[^a-zA-Z0-9._-]/g, "_")}${extension}`);
  }

  private modelUrlFor(id: string): string {
    return `${this.publicBaseUrl.replace(/\/+$/, "")}/api/generated-assets/${encodeURIComponent(id)}/model.glb`;
  }
}
