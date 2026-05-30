const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let body = '';
    // eslint-disable-next-line no-empty
    try { body = await res.text(); } catch {}
    throw new Error(`API ${options.method || 'GET'} ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

export function sendCommand(message, sceneContext) {
  return request('/api/command', {
    method: 'POST',
    body: JSON.stringify({ message, sceneContext }),
  });
}

export function generateAsset(prompt, style = 'cartoon', targetFormat = 'glb') {
  return request('/api/generate-asset', {
    method: 'POST',
    body: JSON.stringify({ prompt, style, targetFormat }),
  });
}

export function getAssetStatus(taskId) {
  return request(`/api/generated-assets/${taskId}/status`);
}

export function getAssetModel(taskId) {
  return request(`/api/generated-assets/${taskId}/model`);
}

export function createFallbackAsset({ fallbackAssetKey, sourcePrompt }) {
  return request('/api/generated-assets/fallback', {
    method: 'POST',
    body: JSON.stringify({ fallbackAssetKey, sourcePrompt }),
  });
}
