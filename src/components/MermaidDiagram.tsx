'use client'
import { useEffect, useRef } from 'react'

interface Props { chart: string }

const FALLBACK_LABELS = ['Question', 'Main idea', 'Causes', 'Examples', 'Evidence', 'Pattern', 'Result', 'Check']

function cleanLabel(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/["'`{}()[\]|]/g, ' ')
    .replace(/classDef|class|fill:|stroke:|color:/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 34)
}

function stripCodeFence(source: string) {
  return source
    .replace(/```mermaid/gi, '')
    .replace(/```/g, '')
    .replace(/\r/g, '')
    .trim()
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function labelsFromChart(source: string) {
  const withoutCodeFence = stripCodeFence(source)
  const bracketLabels = Array.from(withoutCodeFence.matchAll(/\[([^\]\n]+)\]/g)).map(match => cleanLabel(match[1]))
  const quotedLabels = Array.from(withoutCodeFence.matchAll(/"([^"\n]+)"/g)).map(match => cleanLabel(match[1]))

  if (bracketLabels.length || quotedLabels.length) {
    return unique([...bracketLabels, ...quotedLabels]).slice(0, 8)
  }

  return unique(
    withoutCodeFence
      .replace(/graph|flowchart|LR|TD|TB|RL|BT|-->|---|==>|-.->/gi, ' ')
      .split(/\s+/)
      .map(cleanLabel)
      .filter(word => word.length > 2),
  ).slice(0, 6)
}

function nodeIdsFromChart(source: string) {
  return unique([
    ...Array.from(source.matchAll(/^\s*([A-Za-z][\w-]*)\s*(?:\[[^\]\n]+\]|\([^\)\n]+\)|\{"[^"\n]+"\})/gm)).map(match => match[1]),
    ...Array.from(source.matchAll(/(?:^|\s)([A-Za-z][\w-]*)\s*(?:-->|---|-.->|==>)/gm)).map(match => match[1]),
    ...Array.from(source.matchAll(/(?:-->|---|-.->|==>)\s*([A-Za-z][\w-]*)/gm)).map(match => match[1]),
  ])
}

function edgePairsFromChart(source: string) {
  return Array.from(source.matchAll(/([A-Za-z][\w-]*)\s*(?:-->|---|-.->|==>)\s*([A-Za-z][\w-]*)/g))
    .map(match => [match[1], match[2]] as const)
}

function isMostlyLinear(source: string) {
  const edges = edgePairsFromChart(source)
  if (edges.length < 4) return true

  const outgoing = new Map<string, number>()
  const incoming = new Map<string, number>()
  for (const [from, to] of edges) {
    outgoing.set(from, (outgoing.get(from) ?? 0) + 1)
    incoming.set(to, (incoming.get(to) ?? 0) + 1)
  }

  const hasBranch = Array.from(outgoing.values()).some(count => count > 1)
  const hasMerge = Array.from(incoming.values()).some(count => count > 1)
  return !hasBranch && !hasMerge
}

function enrichClasses(source: string) {
  if (/classDef\s+/i.test(source)) return source

  const ids = nodeIdsFromChart(source)
  const [root, ...rest] = ids
  const result = rest.slice(-2)
  const idea = rest.slice(0, Math.max(0, rest.length - 2))
  const lines = [
    'classDef root fill:#EEF2FF,stroke:#6366F1,stroke-width:2px,color:#1E293B;',
    'classDef idea fill:#ECFEFF,stroke:#14B8A6,stroke-width:1.5px,color:#164E63;',
    'classDef result fill:#FFF7ED,stroke:#FDBA74,stroke-width:1.6px,color:#7C2D12;',
  ]
  if (root) lines.push(`class ${root} root;`)
  if (idea.length) lines.push(`class ${idea.join(',')} idea;`)
  if (result.length) lines.push(`class ${result.join(',')} result;`)
  return `${source}\n  ${lines.join('\n  ')}`
}

function conceptMap(labels: string[]) {
  const safeLabels = unique([...labels, ...FALLBACK_LABELS].map(cleanLabel)).slice(0, 8)
  const ids = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const nodes = safeLabels.map((label, index) => `${ids[index]}["${label.replace(/"/g, "'")}"]`)
  const edges = [
    'A --> B',
    'A --> C',
    'A --> D',
    'B --> E',
    'C --> F',
    'D --> G',
    'E --> H',
    'F --> H',
    'G --> H',
  ].filter(Boolean)

  return enrichClasses(`flowchart LR\n  ${nodes.join('\n  ')}\n  ${edges.join('\n  ')}`)
}

function sanitizeMermaid(source: string) {
  const clean = stripCodeFence(source)
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim() && !/^%%\{/.test(line.trim()))
    .join('\n')

  if (!/^(graph|flowchart)\s+(LR|TD|TB|RL|BT)\b/i.test(clean)) {
    return conceptMap(labelsFromChart(clean))
  }

  if (isMostlyLinear(clean)) {
    return conceptMap(labelsFromChart(clean))
  }

  return enrichClasses(clean)
}

export default function MermaidDiagram({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current || !chart) return
    let cancelled = false

    async function render() {
      const mermaid = (await import('mermaid')).default
      mermaid.initialize({
        startOnLoad: false,
        theme:       'base',
        themeVariables: {
          primaryColor:    '#EEF2FF',
          secondaryColor:  '#ECFEFF',
          tertiaryColor:   '#FFF7ED',
          primaryTextColor:'#1E293B',
          primaryBorderColor:'#C4B5FD',
          lineColor:       '#6366F1',
          clusterBkg:      '#FFFFFF',
          clusterBorder:   '#C4B5FD',
          fontSize:        '14px',
          fontFamily:      'var(--font-bangla), sans-serif',
        },
        flowchart: {
          curve: 'basis',
          htmlLabels: true,
          padding: 22,
          nodeSpacing: 42,
          rankSpacing: 58,
        },
      })

      if (cancelled || !ref.current) return
      const { svg } = await mermaid.render(`mermaid-${Date.now()}`, sanitizeMermaid(chart))
      if (!cancelled && ref.current) {
        ref.current.innerHTML = svg
      }
    }

    render().catch(err => {
      console.warn('Mermaid render error (non-fatal):', err)
      if (ref.current) {
        ref.current.innerHTML = '<p style="color:#64748b;font-size:12px">Diagram unavailable</p>'
      }
    })
    return () => { cancelled = true }
  }, [chart])

  return (
    <div ref={ref} className="mermaid-diagram w-full overflow-x-auto rounded-2xl border border-white/70 bg-gradient-to-br from-white/72 via-indigo-50/38 to-cyan-50/42 p-4 flex justify-center shadow-inner shadow-indigo/5 [&>svg]:max-w-full" />
  )
}
