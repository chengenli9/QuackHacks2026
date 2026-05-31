import type { FastifyInstance } from "fastify";
import { commandRequestSchema } from "../schemas.js";
import type { CommandParser } from "../providers/CommandParser.js";
import { UnavailableCommandParser } from "../services/unavailableCommandParser.js";

export const registerCommandRoutes = async (
  app: FastifyInstance,
  commandParser: CommandParser = new UnavailableCommandParser()
) => {
  app.post("/api/command", async (request, reply) => {
    const body = commandRequestSchema.parse(request.body);
    return reply.send(await commandParser.parse(body));
  });
};
