import type { FastifyInstance } from "fastify";
import {
  assetGenerationTaskSchema,
  textAssetGenerationInputSchema
} from "../schemas.js";
import type { AssetGenerationService } from "../services/assetGenerationService.js";

export const registerGenerateAssetRoutes = async (
  app: FastifyInstance,
  service: AssetGenerationService
) => {
  app.post("/api/generate-asset", async (request, reply) => {
    const body = textAssetGenerationInputSchema.parse(request.body);
    const task = assetGenerationTaskSchema.parse(await service.generateFromText(body));
    return reply.code(202).send(task);
  });
};
