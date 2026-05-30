import type { FastifyInstance } from "fastify";
import { commandRequestSchema } from "../schemas.js";
import { buildCommandResponse } from "../services/commandParser.js";

export const registerCommandRoutes = async (app: FastifyInstance) => {
  app.post("/api/command", async (request, reply) => {
    const body = commandRequestSchema.parse(request.body);
    return reply.send(buildCommandResponse(body));
  });
};
