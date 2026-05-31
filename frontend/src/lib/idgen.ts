let counter = 0

export function generateId(prefix = 'obj'): string {
  counter++
  const slug = prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24) || 'obj'
  return `${slug}_${Date.now()}_${counter}`
}
