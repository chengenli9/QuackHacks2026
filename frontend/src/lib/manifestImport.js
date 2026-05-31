const PHYSICS_FIELDS = [
  'category',
  'material',
  'massKg',
  'restitution',
  'friction',
  'static',
  'breakable',
  'collider',
  'confidence',
  'notes',
];

const APPEARANCE_FIELDS = ['baseColor', 'roughness', 'metalness', 'textureDescription'];

export function parseSceneManifest(input) {
  const manifest = typeof input === 'string' ? JSON.parse(input) : input;
  const rawEntries = manifest?.objects ?? manifest?.nodes ?? manifest?.assets ?? manifest;

  if (Array.isArray(rawEntries)) {
    return { entries: rawEntries.filter(isPlainObject).map((entry) => ({ ...entry })) };
  }

  if (isPlainObject(rawEntries)) {
    return {
      entries: Object.entries(rawEntries)
        .filter(([, value]) => isPlainObject(value))
        .map(([id, value]) => ({ id, ...value })),
    };
  }

  return { entries: [] };
}

export function applyManifestToSceneObjects(sceneObjects, manifestInput) {
  const { entries } = parseSceneManifest(manifestInput);
  const matchedEntries = new Set();
  const matchedObjects = new Set();

  const objects = sceneObjects.map((object) => {
    const entryIndex = entries.findIndex((entry, index) => !matchedEntries.has(index) && matchesManifestEntry(object, entry));
    if (entryIndex === -1) return object;

    matchedEntries.add(entryIndex);
    matchedObjects.add(object.id);
    return mergeManifestEntry(object, entries[entryIndex]);
  });

  const warnings = [];
  entries.forEach((entry, index) => {
    if (!matchedEntries.has(index)) {
      warnings.push(`Manifest entry "${entry.id ?? entry.nodeName ?? entry.label ?? index}" did not match an imported object.`);
    }
  });

  const missingLabels = objects
    .filter((object) => !matchedObjects.has(object.id))
    .map((object) => object.label ?? object.id);
  if (entries.length > 0 && missingLabels.length > 0) {
    warnings.push(`Manifest did not include metadata for: ${missingLabels.join(', ')}.`);
  }

  return { objects, warnings };
}

function mergeManifestEntry(object, entry) {
  const physicsPatch = {
    ...(isPlainObject(entry.physics) ? entry.physics : {}),
    ...pick(entry, PHYSICS_FIELDS),
  };
  const appearancePatch = {
    ...(isPlainObject(entry.appearance) ? entry.appearance : {}),
    ...pick(entry, APPEARANCE_FIELDS),
  };

  return {
    ...object,
    label: entry.label ?? object.label,
    physics: {
      ...object.physics,
      ...physicsPatch,
      needsVisualEstimate: false,
      source: 'manifest',
    },
    appearance: {
      ...object.appearance,
      ...appearancePatch,
      source: 'manifest',
    },
    manifest: {
      id: entry.id,
      nodeName: entry.nodeName ?? entry.name,
    },
  };
}

function matchesManifestEntry(object, entry) {
  const entryKeys = [entry.id, entry.objectId, entry.nodeName, entry.name, entry.label].filter(Boolean);
  const objectKeys = [object.id, object.nodeName, object.label].filter(Boolean);

  return entryKeys.some((entryKey) =>
    objectKeys.some((objectKey) => objectKey === entryKey || normalizeKey(objectKey) === normalizeKey(entryKey))
  );
}

function pick(source, keys) {
  const picked = {};
  for (const key of keys) {
    if (Object.hasOwn(source, key)) picked[key] = source[key];
  }
  return picked;
}

function isPlainObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function normalizeKey(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}
