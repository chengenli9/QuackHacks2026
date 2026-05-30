import type { ObjectEstimateInput, ObjectPhysicsProfile } from "../schemas.js";

export type { ObjectEstimateInput, ObjectPhysicsProfile };

export interface ObjectPropertyEstimator {
  estimate(input: ObjectEstimateInput): Promise<ObjectPhysicsProfile>;
}
