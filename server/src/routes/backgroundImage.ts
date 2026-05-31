import type { FastifyInstance } from "fastify";
import {
  backgroundImageRequestSchema,
  backgroundImageResponseSchema
} from "../schemas.js";
import type { BackgroundImageGenerator } from "../providers/BackgroundImageGenerator.js";

export const registerBackgroundImageRoutes = async (
  app: FastifyInstance,
  generator: BackgroundImageGenerator
) => {
  app.post("/api/background-image", async (request, reply) => {
    const body = backgroundImageRequestSchema.parse(request.body);
    const result = backgroundImageResponseSchema.parse(await generator.generate(body));
    return reply.send(result);
  });
};
