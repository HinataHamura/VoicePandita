import { createHash } from 'crypto'

export function fallbackEmbedding(text: string, dimension = 384) {
  const vector = Array.from({ length: dimension }, () => 0)
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim()
  const tokens = normalized ? normalized.split(/\s+/) : ['empty']

  for (const token of tokens) {
    const digest = createHash('sha256').update(token).digest()
    for (let i = 0; i < digest.length; i += 2) {
      const index = digest[i] % dimension
      const sign = digest[i + 1] % 2 === 0 ? 1 : -1
      vector[index] += sign
    }
  }

  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map(value => value / magnitude)
}
