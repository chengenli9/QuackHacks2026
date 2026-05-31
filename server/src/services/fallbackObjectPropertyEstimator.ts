import type { ObjectEstimateInput, ObjectPhysicsProfile } from "../schemas.js";
import type { ObjectPropertyEstimator } from "../providers/ObjectPropertyEstimator.js";

export class FallbackObjectPropertyEstimator implements ObjectPropertyEstimator {
  constructor(
    private readonly primary: ObjectPropertyEstimator,
    private readonly fallback: ObjectPropertyEstimator
  ) {}

  async estimate(input: ObjectEstimateInput): Promise<ObjectPhysicsProfile> {
    try {
      return await this.primary.estimate(input);
    } catch {
      return this.fallback.estimate(input);
    }
  }
}
