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
          primaryColor:    '#E8893A',
          primaryTextColor:'#0D0D0D',
          primaryBorderColor:'#D4A843',
          lineColor:       '#2A5C45',
          fontSize:        '14px',
          fontFamily:      'var(--font-bangla), "Noto Sans Chakma", "Noto Sans Myanmar", "Myanmar Text", sans-serif',
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
        ref.current.innerHTML = '<p style="color:#888;font-size:12px">Diagram unavailable</p>'
      }
    })
    return () => { cancelled = true }
  }, [chart])

  return (
    <div ref={ref} className="mermaid overflow-x-auto w-full flex justify-center [&>svg]:max-w-full" />
  )
}
