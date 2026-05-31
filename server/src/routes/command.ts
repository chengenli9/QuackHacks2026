import type { FastifyInstance } from "fastify";
import { commandRequestSchema } from "../schemas.js";
import type { CommandParser } from "../providers/CommandParser.js";
import { RuleCommandParser } from "../services/commandParser.js";

export const registerCommandRoutes = async (
  app: FastifyInstance,
  commandParser: CommandParser = new RuleCommandParser()
) => {
  app.post("/api/command", async (request, reply) => {
    const body = commandRequestSchema.parse(request.body);
    return reply.send(await commandParser.parse(body));
  });
};
