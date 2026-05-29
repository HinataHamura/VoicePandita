import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_DOCS_CONFIG } from './defaults'
import type { DocsConfig } from './types'

const CONFIG_PATH = path.join(process.cwd(), 'data', 'docs-config.json')

function mergeConfig(value: Partial<DocsConfig>): DocsConfig {
  return {
    ...DEFAULT_DOCS_CONFIG,
    ...value,
    sections: Array.isArray(value.sections) ? value.sections : DEFAULT_DOCS_CONFIG.sections,
    team: Array.isArray(value.team) ? value.team : DEFAULT_DOCS_CONFIG.team,
    versions: Array.isArray(value.versions) ? value.versions : DEFAULT_DOCS_CONFIG.versions,
  }
}

export async function readDocsConfig(): Promise<DocsConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8')
    return mergeConfig(JSON.parse(raw) as Partial<DocsConfig>)
  } catch {
    return DEFAULT_DOCS_CONFIG
  }
}

export async function writeDocsConfig(next: DocsConfig, by = 'admin') {
  const current = await readDocsConfig()
  const now = new Date().toISOString()
  const config = mergeConfig({
    ...next,
    updatedAt: now.slice(0, 10),
    versions: [
      {
        id: `v-${Date.now()}`,
        at: now,
        by,
        note: `Published ${next.version || current.version}`,
      },
      ...(current.versions || []),
    ].slice(0, 12),
  })

  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true })
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  return config
}
