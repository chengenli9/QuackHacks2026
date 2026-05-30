const GENERIC_SCENE_NODE_RE = /^(geometry|mesh|object|node)[_-]?\d+$/i;

const profile = ({
  category = 'unknown',
  material = 'unknown',
  massKg = 1,
  restitution = 0.2,
  friction = 0.65,
  static: isStatic = false,
  breakable = false,
  collider = 'convex_hull',
  confidence = 0.35,
  needsVisualEstimate = false,
  notes = '',
} = {}) => ({
  category,
  material,
  massKg,
  restitution,
  friction,
  static: isStatic,
  breakable,
  collider,
  confidence,
  needsVisualEstimate,
  source: needsVisualEstimate ? 'visual-estimate-needed' : 'label-rule',
  notes,
});

const hasAny = (value, terms) => terms.some((term) => value.includes(term));

export function isGenericSceneNodeLabel(label = '') {
  return GENERIC_SCENE_NODE_RE.test(label.trim());
}

export function inferPhysicsProfile({ label = '', dimensions } = {}) {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, '_');

  if (!normalized || isGenericSceneNodeLabel(normalized)) {
    return profile({
      collider: 'convex_hull',
      confidence: 0.2,
      needsVisualEstimate: true,
      notes: 'Generic GLB node name; use a visual estimate before trusting object-specific physics.',
    });
  }

  if (hasAny(normalized, ['floor', 'wall', 'ceiling', 'ground', 'room', 'stair', 'window', 'door'])) {
    return profile({
      massKg: 0,
      friction: 0.9,
      static: true,
      collider: 'cuboid',
      confidence: 0.88,
      notes: 'Architecture-like label; fixed collision surface.',
    });
  }

  if (hasAny(normalized, ['ball', 'sphere'])) {
    return profile({
      category: 'toy',
      material: normalized.includes('rubber') ? 'rubber' : 'plastic',
      massKg: 0.45,
      restitution: 0.85,
      friction: 0.4,
      collider: 'ball',
      confidence: 0.9,
      notes: 'Round toy-like label; bouncy dynamic ball collider.',
    });
  }

  if (hasAny(normalized, ['vase', 'bottle', 'glass', 'jar'])) {
    return profile({
      category: 'decor',
      material: normalized.includes('plastic') ? 'plastic' : 'glass',
      massKg: 0.8,
      restitution: 0.08,
      friction: 0.45,
      breakable: !normalized.includes('plastic'),
      collider: 'cylinder',
      confidence: 0.78,
      notes: 'Tall decor/container label; cylindrical dynamic collider.',
    });
  }

  if (hasAny(normalized, ['barrel', 'can', 'drum'])) {
    return profile({
      category: 'container',
      material: normalized.includes('wood') ? 'wood' : 'metal',
      massKg: 6,
      restitution: 0.2,
      friction: 0.55,
      collider: 'cylinder',
      confidence: 0.82,
      notes: 'Barrel-like label; medium-heavy cylindrical collider.',
    });
  }

  if (hasAny(normalized, ['crate', 'box', 'container', 'chest'])) {
    return profile({
      category: 'container',
      material: normalized.includes('plastic') ? 'plastic' : 'wood',
      massKg: 3,
      restitution: 0.15,
      friction: 0.75,
      collider: 'cuboid',
      confidence: 0.82,
      notes: 'Box-like label; dynamic cuboid collider.',
    });
  }

  if (hasAny(normalized, ['table', 'desk', 'counter', 'shelf', 'cabinet', 'sofa', 'couch', 'bed'])) {
    return profile({
      category: 'furniture',
      material: normalized.includes('metal') ? 'metal' : 'wood',
      massKg: 0,
      restitution: 0.08,
      friction: 0.82,
      static: true,
      collider: 'cuboid',
      confidence: 0.78,
      notes: 'Large furniture label; fixed simplified collider.',
    });
  }

  if (hasAny(normalized, ['chair', 'stool', 'bench'])) {
    return profile({
      category: 'furniture',
      material: normalized.includes('metal') ? 'metal' : 'wood',
      massKg: 7,
      restitution: 0.12,
      friction: 0.7,
      collider: 'cuboid',
      confidence: 0.76,
      notes: 'Seat-like furniture label; movable cuboid approximation.',
    });
  }

  if (hasAny(normalized, ['duck', 'toy', 'figurine', 'plush'])) {
    return profile({
      category: 'toy',
      material: normalized.includes('rubber') ? 'rubber' : 'plastic',
      massKg: 0.35,
      restitution: 0.55,
      friction: 0.5,
      collider: 'convex_hull',
      confidence: 0.74,
      notes: 'Toy-like label; lightweight convex hull collider.',
    });
  }

  const maxDimension = Math.max(...(dimensions ?? [1]));
  return profile({
    massKg: maxDimension > 4 ? 0 : 1.2,
    static: maxDimension > 4,
    collider: maxDimension > 4 ? 'cuboid' : 'convex_hull',
    confidence: 0.32,
    needsVisualEstimate: true,
    notes: 'Unrecognized label; conservative fallback until a VLM estimate is available.',
  });
}
