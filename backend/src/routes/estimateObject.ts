import type { FastifyInstance } from "fastify";
import type { ObjectPropertyEstimator } from "../providers/ObjectPropertyEstimator.js";
import {
  estimateObjectRequestSchema,
  objectPhysicsProfileSchema
} from "../schemas.js";

export const registerEstimateObjectRoutes = async (
  app: FastifyInstance,
  estimator: ObjectPropertyEstimator
) => {
  app.post("/api/estimate-object", async (request, reply) => {
    const body = estimateObjectRequestSchema.parse(request.body);
    const profile = objectPhysicsProfileSchema.parse(await estimator.estimate(body));
    return reply.send(profile);
  });
};
