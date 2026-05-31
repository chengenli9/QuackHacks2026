import {
  commandResponseSchema,
  assetGenerationTaskSchema,
  assetGenerationTaskStatusSchema,
  generatedAssetSchema,
  objectPhysicsProfileSchema,
  type CommandResponse,
  type AssetGenerationTask,
  type AssetGenerationTaskStatus,
  type GeneratedAsset,
  type ObjectPhysicsProfile,
} from '../schemas'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8787'

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  parse?: (data: unknown) => T
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API error ${res.status}: ${text}`)
  }
  const data = await res.json()
  if (parse) return parse(data)
  return data as T
}

export async function sendCommand(
  message: string,
  sceneObjects: Array<{ id: string; label: string }>
): Promise<CommandResponse> {
  return apiFetch(
    '/api/command',
    {
      method: 'POST',
      body: JSON.stringify({ message, sceneContext: { objects: sceneObjects } }),
    },
    (d) => commandResponseSchema.parse(d)
  )
}

export async function estimateObject(input: {
  objectId: string
  label?: string
  sourcePrompt?: string
  dimensions?: [number, number, number]
}): Promise<ObjectPhysicsProfile> {
  return apiFetch(
    '/api/estimate-object',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
    (d) => objectPhysicsProfileSchema.parse(d)
  )
}

export async function generateAsset(prompt: string): Promise<AssetGenerationTask> {
  return apiFetch(
    '/api/generate-asset',
    {
      method: 'POST',
      body: JSON.stringify({ prompt, targetFormat: 'glb' }),
    },
    (d) => assetGenerationTaskSchema.parse(d)
  )
}

export async function getGeneratedAssetStatus(taskId: string): Promise<AssetGenerationTaskStatus> {
  return apiFetch(
    `/api/generated-assets/${encodeURIComponent(taskId)}/status`,
    undefined,
    (d) => assetGenerationTaskStatusSchema.parse(d)
  )
}

export async function getGeneratedAssetModel(taskId: string): Promise<GeneratedAsset> {
  return apiFetch(
    `/api/generated-assets/${encodeURIComponent(taskId)}/model`,
    undefined,
    (d) => generatedAssetSchema.parse(d)
  )
}

export async function insertFallbackAsset(
  fallbackAssetKey: string,
  sourcePrompt: string
): Promise<GeneratedAsset> {
  return apiFetch(
    '/api/generated-assets/fallback',
    {
      method: 'POST',
      body: JSON.stringify({ fallbackAssetKey, sourcePrompt }),
    },
    (d) => generatedAssetSchema.parse(d)
  )
}
