import { createReadStream, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { HttpError } from "../errors.js";
import { fallbackAssetKeySchema } from "../schemas.js";

const fallbackAssetFileParamsSchema = z.object({
  asset: z.string().regex(/^[a-z_]+\.glb$/)
});

const fallbackAssetDirectory = resolve(process.cwd(), "public", "assets", "fallback");

export const registerFallbackAssetRoutes = async (app: FastifyInstance) => {
  app.get("/assets/fallback/:asset", async (request, reply) => {
    const params = fallbackAssetFileParamsSchema.parse(request.params);
    const assetKey = params.asset.replace(/\.glb$/, "");
    const key = fallbackAssetKeySchema.safeParse(assetKey);

    if (!key.success) {
      throw new HttpError(404, "FallbackAssetNotFound", `Unknown fallback asset: ${assetKey}`);
    }

    const filePath = join(fallbackAssetDirectory, `${key.data}.glb`);

    if (!existsSync(filePath)) {
      throw new HttpError(
        404,
        "FallbackAssetMissing",
        `Fallback asset file is missing: ${key.data}.glb`
      );
    }

    return reply.type("model/gltf-binary").send(createReadStream(filePath));
  });
};
