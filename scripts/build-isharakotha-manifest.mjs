import { access, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const preferredRoots = ['public/data/Sections', 'public/data/sections', 'public/data/isharakotha']

const findRoot = async () => {
  for (const candidate of preferredRoots.map((item) => path.resolve(item))) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next known dataset location.
    }
  }

  throw new Error(`No IsharaKotha dataset folder found. Tried: ${preferredRoots.join(', ')}`)
}

const root = await findRoot()
const output = path.join(root, 'dataset.json')

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(fullPath)
    return entry.isFile() && entry.name.toLowerCase().endsWith('.sigml') ? [fullPath] : []
  }))

  return files.flat()
}

const textBetween = (value, pattern) => {
  const match = value.match(pattern)
  return match?.[1]?.trim()
}

const englishFromFilename = (filename) => {
  const withoutExt = filename.replace(/\.sigml$/i, '')
  const matches = [...withoutExt.matchAll(/\(([^()]+)\)/g)]
  return matches.at(-1)?.[1]?.trim()
}

const categoryFromDirectory = (filePath) => {
  const relative = path.relative(root, path.dirname(filePath)).split(path.sep)
  const category = relative.at(-1) ?? ''
  const english = textBetween(category, /\(([^()]+)\)\s*$/)
  return english ?? category.replace(/^\d+\s*/, '').trim()
}

const makeEntry = async (filePath) => {
  const xml = await readFile(filePath, 'utf8')
  const english = englishFromFilename(path.basename(filePath))
  const gloss = textBetween(xml, /<hns_sign[^>]*\bgloss="([^"]*)"/i) || english
  if (!gloss) return null

  const relativePath = path.relative(root, filePath).split(path.sep).join('/')

  return {
    gloss,
    english,
    category: categoryFromDirectory(filePath),
    aliases: [english, gloss].filter(Boolean),
    sigmlPath: relativePath,
  }
}

const files = await walk(root)
const entries = (await Promise.all(files.map(makeEntry)))
  .filter(Boolean)
  .sort((a, b) => a.gloss.localeCompare(b.gloss, 'bn'))

await writeFile(
  output,
  `${JSON.stringify({
    name: 'IsharaKotha generated manifest',
    generatedAt: new Date().toISOString(),
    entries,
  }, null, 2)}\n`,
  'utf8',
)

console.log(`Wrote ${entries.length} entries to ${path.relative(process.cwd(), output)}`)
