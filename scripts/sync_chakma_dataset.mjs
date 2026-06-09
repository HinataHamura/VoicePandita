import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DATASET_ID = 'amlan107/chakma-nmt-base-parallel-dev-set'
const CONFIG = 'default'
const SPLIT = 'dev_val'
const PAGE_SIZE = 100
const ENDPOINT = 'https://datasets-server.huggingface.co/rows'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outputPath = path.join(__dirname, '..', 'src', 'data', 'chakmaPairs.json')

async function fetchPage(offset) {
  const params = new URLSearchParams({
    dataset: DATASET_ID,
    config: CONFIG,
    split: SPLIT,
    offset: String(offset),
    length: String(PAGE_SIZE),
  })
  const res = await fetch(`${ENDPOINT}?${params}`)
  if (!res.ok) throw new Error(`Failed at offset ${offset}: ${res.status}`)
  return res.json()
}

function toPair(item) {
  const bn = typeof item?.row?.bn === 'string' ? item.row.bn.trim() : ''
  const ccp = typeof item?.row?.ccp === 'string' ? item.row.ccp.trim() : ''
  return bn && ccp ? { bn, ccp } : null
}

const firstPage = await fetchPage(0)
const total = firstPage.num_rows_total || firstPage.rows?.length || 0
const offsets = []

for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) {
  offsets.push(offset)
}

const pages = [firstPage]
for (let index = 0; index < offsets.length; index += 8) {
  const batch = offsets.slice(index, index + 8)
  pages.push(...await Promise.all(batch.map(fetchPage)))
  process.stdout.write(`Fetched ${Math.min(offsets[index + 7] || total, total)}/${total}\n`)
}

const seen = new Set()
const pairs = pages
  .flatMap(page => page.rows || [])
  .map(toPair)
  .filter(Boolean)
  .filter(pair => {
    const key = `${pair.bn}\n${pair.ccp}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

await mkdir(path.dirname(outputPath), { recursive: true })
await writeFile(outputPath, `${JSON.stringify(pairs, null, 2)}\n`, 'utf8')
process.stdout.write(`Saved ${pairs.length} Chakma pairs to ${outputPath}\n`)
