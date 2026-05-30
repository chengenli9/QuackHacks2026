import type { FastifyInstance } from "fastify";
import {
  fallbackAssetRequestSchema,
  generatedAssetParamsSchema,
  generatedAssetSchema
} from "../schemas.js";
import type { AssetGenerationService } from "../services/assetGenerationService.js";

export const registerGeneratedAssetModelRoutes = async (
  app: FastifyInstance,
  service: AssetGenerationService
) => {
  app.get("/api/generated-assets/:id/model", async (request, reply) => {
    const params = generatedAssetParamsSchema.parse(request.params);
    const asset = generatedAssetSchema.parse(await service.getModel(params.id));
    return reply.send(asset);
  });

  app.post("/api/generated-assets/fallback", async (request, reply) => {
    const body = fallbackAssetRequestSchema.parse(request.body);
    const asset = generatedAssetSchema.parse(service.getFallbackAsset(body));
    return reply.send(asset);
  });
};
