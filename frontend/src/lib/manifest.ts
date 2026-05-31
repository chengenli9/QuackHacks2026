import { z } from 'zod'

const manifestObjectSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  nodeName: z.string().optional(),
  nodePath: z.string().optional(),
  physics: z.object({
    massKg: z.number().positive().optional(),
    restitution: z.number().min(0).max(1).optional(),
    friction: z.number().min(0).max(1).optional(),
    static: z.boolean().optional(),
    collider: z.enum(['ball', 'cuboid', 'cylinder', 'convex_hull']).optional(),
  }).optional(),
  locked: z.boolean().optional(),
})

export const manifestSchema = z.object({
  version: z.literal(1),
  objects: z.array(manifestObjectSchema),
})

export type ManifestObject = z.infer<typeof manifestObjectSchema>
export type Manifest = z.infer<typeof manifestSchema>

export function parseManifest(raw: unknown): Manifest {
  return manifestSchema.parse(raw)
}

export async function loadManifestFile(file: File): Promise<Manifest> {
  const text = await file.text()
  const json = JSON.parse(text)
  return parseManifest(json)
}
