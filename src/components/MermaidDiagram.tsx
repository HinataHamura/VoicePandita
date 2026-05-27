'use client'
import { useEffect, useRef } from 'react'

interface Props { chart: string }

function cleanLabel(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/["'`{}()[\]|]/g, ' ')
    .replace(/classDef|class|fill:|stroke:|color:/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 34)
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function labelsFromChart(source: string) {
  const withoutCodeFence = source.replace(/```mermaid|```/gi, '').replace(/\r/g, '')
  const bracketLabels = Array.from(withoutCodeFence.matchAll(/\[([^\]\n]+)\]/g)).map(match => cleanLabel(match[1]))
  const quotedLabels = Array.from(withoutCodeFence.matchAll(/"([^"\n]+)"/g)).map(match => cleanLabel(match[1]))

  if (bracketLabels.length || quotedLabels.length) {
    return unique([...bracketLabels, ...quotedLabels]).slice(0, 7)
  }

  return unique(
    withoutCodeFence
      .replace(/graph|flowchart|LR|TD|TB|RL|BT|-->|---/gi, ' ')
      .split(/\s+/)
      .map(cleanLabel)
      .filter(word => word.length > 2)
  ).slice(0, 5)
}

function safeGraph(labels: string[]) {
  const fallback = ['প্রশ্ন', 'মূল ধারণা', 'কারণ', 'উদাহরণ', 'বোঝা']
  const safeLabels = [...labels, ...fallback].map(cleanLabel).filter(Boolean).slice(0, 5)
  const ids = ['A', 'B', 'C', 'D', 'E']
  const nodes = safeLabels.map((label, index) => `${ids[index]}["${label.replace(/"/g, "'")}"]`)
  const edges = safeLabels.slice(1).map((_label, index) => `${ids[index]} --> ${ids[index + 1]}`)
  return `graph LR\n  ${nodes.join('\n  ')}\n  ${edges.join('\n  ')}`
}

function sanitizeMermaid(source: string) {
  return safeGraph(labelsFromChart(source))
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
          padding: 18,
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
    <div ref={ref} className="w-full overflow-x-auto rounded-2xl border border-white/70 bg-gradient-to-br from-white/72 via-indigo-50/38 to-cyan-50/42 p-4 flex justify-center shadow-inner shadow-indigo/5 [&>svg]:max-w-full" />
  )
}
