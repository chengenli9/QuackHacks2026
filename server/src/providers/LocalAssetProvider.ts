import { HttpError } from "../errors.js";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fallbackAssetKeySchema, generatedAssetSchema } from "../schemas.js";
import type { FallbackAssetKey, GeneratedAsset } from "../schemas.js";

export class LocalAssetProvider {
  private readonly publicBaseUrl: string;

  constructor(publicBaseUrl: string, private readonly fallbackAssetDir: string) {
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");
  }

  getFallbackAsset(input: {
    fallbackAssetKey: FallbackAssetKey;
    sourcePrompt: string;
  }): GeneratedAsset {
    const key = fallbackAssetKeySchema.safeParse(input.fallbackAssetKey);

    if (!key.success) {
      throw new HttpError(
        404,
        "FallbackAssetNotFound",
        `Unknown fallback asset: ${input.fallbackAssetKey}`
      );
    }

    if (!existsSync(join(this.fallbackAssetDir, `${key.data}.glb`))) {
      throw new HttpError(
        404,
        "FallbackAssetFileMissing",
        `Fallback asset file missing: ${key.data}.glb`
      );
    }

    return generatedAssetSchema.parse({
      id: `local-${key.data}`,
      provider: "local",
      sourcePrompt: input.sourcePrompt,
      glbUrl: `${this.publicBaseUrl}/assets/fallback/${key.data}.glb`,
      metadata: {
        fallbackAssetKey: key.data
      }
    });
  }
}
