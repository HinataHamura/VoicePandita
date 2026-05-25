'use client'
import { useEffect, useRef } from 'react'

interface Props { chart: string }

function quoteNodeLabels(source: string) {
  return source.replace(/([A-Za-z][A-Za-z0-9_]*)\[([^\]\n]+)\]/g, (_match, id, label) => {
    const safeLabel = String(label)
      .replace(/"/g, "'")
      .replace(/[{}]/g, '')
      .trim()
    return `${id}["${safeLabel}"]`
  })
}

function sanitizeMermaid(source: string) {
  const lines = source
    .replace(/```mermaid|```/gi, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)

  if (!lines.length) return 'graph LR\n  A["প্রশ্ন"] --> B["ধারণা"]'

  const first = /^(graph|flowchart)\s+(LR|TD|TB|RL|BT)/i.test(lines[0])
    ? lines[0]
    : 'graph LR'

  const body = lines
    .slice(/^(graph|flowchart)\s+/i.test(lines[0]) ? 1 : 0)
    .map(line => line
      .replace(/\s*--\s*([^>|-][^-]*)\s*-->\s*/g, (_m, label) => ` --|${String(label).replace(/[|[\]{}]/g, '').trim()}|--> `)
      .replace(/\(([^()\n]+)\)/g, '[$1]')
    )

  const cleaned = [first, ...body].join('\n')
  return quoteNodeLabels(cleaned)
}

function fallbackDiagramFromText(source: string) {
  const words = source
    .replace(/graph|flowchart|LR|TD|TB|-->|---|\[|\]|\(|\)|["']/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 2)
    .slice(0, 5)

  const labels = words.length >= 3 ? words : ['প্রশ্ন', 'মূল ধারণা', 'কারণ', 'উদাহরণ', 'বোঝা']
  return `graph LR\n  A["${labels[0]}"] --> B["${labels[1]}"]\n  B --> C["${labels[2]}"]\n  C --> D["${labels[3] || 'উদাহরণ'}"]\n  D --> E["${labels[4] || 'বোঝা'}"]`
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
      const id  = `mermaid-${Date.now()}`
      const safeChart = sanitizeMermaid(chart)
      const { svg } = await mermaid.render(id, safeChart)
      if (!cancelled && ref.current) {
        ref.current.innerHTML = svg
      }
    }

    render().catch(err => {
      console.warn('Mermaid render error (non-fatal):', err)
      ;(async () => {
        if (!ref.current) return
        try {
          const mermaid = (await import('mermaid')).default
          const { svg } = await mermaid.render(`mermaid-fallback-${Date.now()}`, fallbackDiagramFromText(chart))
          if (ref.current) ref.current.innerHTML = svg
        } catch {
          if (ref.current) ref.current.innerHTML = '<p style="color:#64748b;font-size:12px">Diagram unavailable</p>'
        }
      })()
    })
    return () => { cancelled = true }
  }, [chart])

  return (
    <div ref={ref} className="w-full overflow-x-auto rounded-2xl border border-white/70 bg-gradient-to-br from-white/72 via-indigo-50/38 to-cyan-50/42 p-4 flex justify-center shadow-inner shadow-indigo/5 [&>svg]:max-w-full" />
  )
}
