import {
  estimateObjectRequestSchema,
  objectPhysicsProfileSchema
} from "../schemas.js";
import type { ObjectEstimateInput, ObjectPhysicsProfile } from "../schemas.js";
import type { ObjectPropertyEstimator } from "../providers/ObjectPropertyEstimator.js";

type EstimateRule = {
  keywords: string[];
  category: ObjectPhysicsProfile["category"];
  material: ObjectPhysicsProfile["material"];
  massKg: number;
  restitution: number;
  friction: number;
  static: boolean;
  breakable: boolean;
  collider: ObjectPhysicsProfile["collider"];
  confidence: number;
};

const rules: EstimateRule[] = [
  {
    keywords: ["rubber duck", "duck", "toy"],
    category: "toy",
    material: "rubber",
    massKg: 0.2,
    restitution: 0.7,
    friction: 0.55,
    static: false,
    breakable: false,
    collider: "cuboid",
    confidence: 0.72
  },
  {
    keywords: ["ball", "sphere", "marble"],
    category: "toy",
    material: "rubber",
    massKg: 0.35,
    restitution: 0.85,
    friction: 0.45,
    static: false,
    breakable: false,
    collider: "ball",
    confidence: 0.76
  },
  {
    keywords: ["crate", "box"],
    category: "container",
    material: "wood",
    massKg: 4,
    restitution: 0.15,
    friction: 0.7,
    static: false,
    breakable: true,
    collider: "cuboid",
    confidence: 0.7
  },
  {
    keywords: ["vase", "bottle", "cup", "glass"],
    category: "decor",
    material: "glass",
    massKg: 0.8,
    restitution: 0.08,
    friction: 0.5,
    static: false,
    breakable: true,
    collider: "cylinder",
    confidence: 0.68
  },
  {
    keywords: ["barrel", "metal"],
    category: "container",
    material: "metal",
    massKg: 12,
    restitution: 0.25,
    friction: 0.62,
    static: false,
    breakable: false,
    collider: "cylinder",
    confidence: 0.68
  },
  {
    keywords: ["table", "desk", "couch", "sofa", "chair", "shelf", "furniture"],
    category: "furniture",
    material: "wood",
    massKg: 18,
    restitution: 0.12,
    friction: 0.72,
    static: true,
    breakable: false,
    collider: "cuboid",
    confidence: 0.64
  }
];

const fallbackRule: EstimateRule = {
  keywords: [],
  category: "unknown",
  material: "unknown",
  massKg: 1,
  restitution: 0.25,
  friction: 0.55,
  static: false,
  breakable: false,
  collider: "cuboid",
  confidence: 0.42
};

export class LocalObjectPropertyEstimator implements ObjectPropertyEstimator {
  async estimate(input: ObjectEstimateInput): Promise<ObjectPhysicsProfile> {
    const request = estimateObjectRequestSchema.parse(input);
    const label = request.label ?? request.sourcePrompt ?? request.objectId;
    const haystack = `${request.label ?? ""} ${request.sourcePrompt ?? ""}`.toLowerCase();
    const rule = rules.find((candidate) =>
      candidate.keywords.some((keyword) => haystack.includes(keyword))
    ) ?? fallbackRule;

    return objectPhysicsProfileSchema.parse({
      objectId: request.objectId,
      label,
      category: rule.category,
      material: rule.material,
      massKg: this.massForDimensions(rule.massKg, request.dimensions),
      restitution: rule.restitution,
      friction: rule.friction,
      static: rule.static,
      breakable: rule.breakable,
      collider: rule.collider,
      confidence: rule.confidence,
      notes: "Estimated locally from object label, prompt, and dimensions."
    });
  }

  private massForDimensions(
    baseMassKg: number,
    dimensions: [number, number, number] | undefined
  ): number {
    if (!dimensions) {
      return baseMassKg;
    }

    if (baseMassKg <= 0.5) {
      return baseMassKg;
    }

    const volume = Math.max(dimensions[0] * dimensions[1] * dimensions[2], 0.01);
    return Number(Math.max(baseMassKg, volume * 80).toFixed(2));
  }
}
