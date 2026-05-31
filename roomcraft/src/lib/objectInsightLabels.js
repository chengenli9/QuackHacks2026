// Keep merged demo imports visible even when the GLB loader can only expose "Imported GLB".
const GENERIC_LABELS = new Set(['room_mesh', 'scene']);

export function buildObjectInsightLabel(object = {}) {
  const physics = object.physics ?? {};
  const appearance = object.appearance ?? {};
  const category = cleanValue(physics.category);
  const material = cleanValue(physics.material);

  return {
    title: displayLabel(object.label ?? object.id ?? 'object'),
    subtitle: category || material
      ? [category, material].filter(Boolean).join(' / ')
      : 'awaiting estimate',
    metrics: [
      Number.isFinite(physics.massKg) ? `${formatNumber(physics.massKg)} kg` : null,
      Number.isFinite(physics.restitution) ? `${formatNumber(physics.restitution)} bounce` : null,
      Number.isFinite(physics.confidence) ? `${Math.round(physics.confidence * 100)}% confidence` : null,
    ].filter(Boolean),
    texture: cleanValue(appearance.textureDescription),
  };
}

export function labelPositionForObject(object = {}) {
  const position = vec3(object.transform?.position, [0, 0, 0]);
  const center = vec3(object.localBoundsCenter, [0, 0, 0]);
  const dimensions = vec3(object.localBoundsDimensions ?? object.dimensions, [1, 1, 1]);
  const scale = vec3(object.transform?.scale, [1, 1, 1]);
  const topOffset = center[1] * scale[1] + Math.abs(dimensions[1] * scale[1]) / 2 + 0.22;

  return [
    round(position[0] + center[0] * scale[0]),
    round(position[1] + topOffset),
    round(position[2] + center[2] * scale[2]),
  ];
}

export function shouldShowObjectInsightLabel(object, enabled) {
  if (!enabled || !object?.id) return false;
  const key = String(object.label ?? object.id).trim().toLowerCase();
  return !GENERIC_LABELS.has(key);
}

function displayLabel(value) {
  return String(value).replaceAll('_', ' ').trim() || 'object';
}

function cleanValue(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized || null;
}

function vec3(value, fallback) {
  return Array.isArray(value) && value.length === 3
    ? value.map((entry, index) => Number.isFinite(Number(entry)) ? Number(entry) : fallback[index])
    : [...fallback];
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
