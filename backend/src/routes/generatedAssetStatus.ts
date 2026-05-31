import type { FastifyInstance } from "fastify";
import {
  assetGenerationTaskStatusSchema,
  generatedAssetParamsSchema
} from "../schemas.js";
import type { AssetGenerationService } from "../services/assetGenerationService.js";

export const registerGeneratedAssetStatusRoutes = async (
  app: FastifyInstance,
  service: AssetGenerationService
) => {
  app.get("/api/generated-assets/:id/status", async (request, reply) => {
    const params = generatedAssetParamsSchema.parse(request.params);
    const status = assetGenerationTaskStatusSchema.parse(await service.getTask(params.id));
    return reply.send(status);
  });
};
