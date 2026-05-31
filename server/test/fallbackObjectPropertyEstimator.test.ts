import { describe, expect, it } from "vitest";
import { FallbackObjectPropertyEstimator } from "../src/services/fallbackObjectPropertyEstimator.js";

describe("FallbackObjectPropertyEstimator", () => {
  it("uses the fallback estimator when the primary estimator fails", async () => {
    const estimator = new FallbackObjectPropertyEstimator(
      {
        async estimate() {
          throw new Error("Gemini unavailable");
        }
      },
      {
        async estimate() {
          return {
            objectId: "geometry_0",
            label: "rubber duck",
            category: "toy",
            material: "rubber",
            massKg: 0.2,
            restitution: 0.7,
            friction: 0.55,
            static: false,
            breakable: false,
            collider: "cuboid",
            confidence: 0.72,
            notes: "Fallback estimate."
          };
        }
      }
    );

    await expect(
      estimator.estimate({
        objectId: "geometry_0",
        label: "geometry_0",
        dimensions: [1, 1, 1]
      })
    ).resolves.toMatchObject({
      objectId: "geometry_0",
      label: "rubber duck",
      material: "rubber"
    });
  });
});
