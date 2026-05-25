'use client'
import { useEffect, useRef } from 'react'

interface Props { chart: string }

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
      const { svg } = await mermaid.render(id, chart)
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
