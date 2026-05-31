export async function requestVisualPhysicsEstimate({
  apiBaseUrl,
  fetchImpl = globalThis.fetch,
  object,
  sourcePrompt,
  imageBase64,
  imageMimeType,
}) {
  if (!apiBaseUrl?.trim() || !imageBase64 || !imageMimeType) {
    return null;
  }

  const response = await fetchImpl(estimateEndpoint(apiBaseUrl), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      objectId: object.id,
      label: object.label,
      ...(sourcePrompt ? { sourcePrompt } : {}),
      dimensions: object.dimensions,
      meshMetadata: {
        meshCount: object.meshCount,
        vertexCount: object.vertexCount,
        triangleCount: object.triangleCount,
      },
      imageBase64,
      imageMimeType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Object estimate failed with status ${response.status}`);
  }

  const profile = await response.json();
  return {
    ...profile,
    source: 'vlm',
    needsVisualEstimate: false,
  };
}

function estimateEndpoint(apiBaseUrl) {
  const base = apiBaseUrl.trim().replace(/\/+$/, '');
  return base.endsWith('/api') ? `${base}/estimate-object` : `${base}/api/estimate-object`;
}
