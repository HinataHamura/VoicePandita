'use client'

import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { StepCard, TeachingShell } from './primitives'
import type { TeachingAnimationProps } from './types'

function cleanLabel(value: string) {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/["'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 34)
}

function labelsFromMermaid(diagram?: string | null) {
  if (!diagram) return []
  return Array.from(diagram.matchAll(/\[([^\]]+)\]/g))
    .map(match => cleanLabel(match[1]))
    .filter(Boolean)
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)))
}

function conceptParts(question?: string, graphPath?: string[] | null, fallbackDiagram?: string | null) {
  const diagramLabels = labelsFromMermaid(fallbackDiagram)
  const pathLabels = (graphPath || []).map(cleanLabel)
  const title = cleanLabel(pathLabels[pathLabels.length - 1] || diagramLabels[0] || question || 'Concept')
  const nodes = unique([...diagramLabels.slice(1), ...pathLabels.slice(0, -1), 'Definition', 'Example', 'Why it matters'])
    .filter(item => item.toLowerCase() !== title.toLowerCase())
    .slice(0, 6)

  return {
    title,
    nodes: nodes.length >= 4 ? nodes : unique([...nodes, 'Main idea', 'Key parts', 'Cause', 'Result']).slice(0, 6),
  }
}

function conceptSteps(question: string | undefined, concept: ReturnType<typeof conceptParts>) {
  const haystack = `${question || ''} ${concept.title} ${concept.nodes.join(' ')}`.toLowerCase()

  if (/(pendulum|দোলক|সরল দোলক|simple pendulum)/i.test(haystack)) {
    return [
      {
        title: 'দোলনকাল (T)',
        text: 'একবার পূর্ণ দোলন শেষ করতে যে সময় লাগে, সেটাই দোলনকাল।',
      },
      {
        title: 'বব ও সুতা',
        text: 'ছোট ভারী ববটি হালকা সুতায় ঝুলে সামনে-পেছনে দোলে।',
      },
      {
        title: 'দৈর্ঘ্য নির্ভরতা',
        text: 'সুতার দৈর্ঘ্য বাড়লে দোলন ধীর হয়; ছোট হলে দোলন দ্রুত হয়।',
      },
    ]
  }

  const usefulNodes = concept.nodes
    .filter(node => !/definition|example|why it matters|main idea|key parts|cause|result/i.test(node))
    .slice(0, 3)
  const cards = (usefulNodes.length >= 3 ? usefulNodes : unique([...usefulNodes, ...concept.nodes])).slice(0, 3)

  return cards.map((node, index) => {
    const title = node || ['মূল ধারণা', 'কারণ/অংশ', 'ফলাফল'][index]
    const text = index === 0
      ? `${concept.title} বুঝতে আগে "${title}" অংশটা ধরো।`
      : index === 1
        ? `"${title}" কীভাবে মূল ধারণার সাথে যুক্ত, সেটা দেখো।`
        : `শেষে "${title}" থেকে concept-এর ব্যবহার বা ফলাফল পরিষ্কার হয়।`

    return { title, text }
  })
}

const positions = [
  'left-[7%] top-[18%]',
  'right-[8%] top-[16%]',
  'left-[9%] bottom-[22%]',
  'right-[10%] bottom-[20%]',
  'left-[36%] top-[5%]',
  'left-[38%] bottom-[7%]',
]

export default function GenericConceptAnimation({ question, graphPath, fallbackDiagram }: TeachingAnimationProps) {
  const concept = conceptParts(question, graphPath, fallbackDiagram)
  const steps = conceptSteps(question, concept)

  return (
    <TeachingShell title={concept.title} subtitle="The AI teacher turns this answer into a live concept map: main idea first, then parts, links, example, and result.">
      <div className="grid gap-4 lg:grid-cols-[1.35fr_.9fr]">
        <div className="relative min-h-[350px] overflow-hidden rounded-2xl border border-cyan-100 bg-[linear-gradient(135deg,rgba(255,255,255,.95),rgba(236,254,255,.74)),radial-gradient(circle_at_50%_42%,rgba(99,102,241,.20),transparent_34rem)] p-4">
          <svg viewBox="0 0 680 360" className="absolute inset-0 h-full w-full">
            <defs>
              <linearGradient id="genericLine" x1="0" x2="1" y1="0" y2="1">
                <stop stopColor="#6366F1" />
                <stop offset="1" stopColor="#14B8A6" />
              </linearGradient>
            </defs>
            {[0, 1, 2].map(i => (
              <motion.circle
                key={i}
                cx="340"
                cy="178"
                r={82 + i * 36}
                fill="none"
                stroke="rgba(99,102,241,.14)"
                strokeWidth="2"
                strokeDasharray="8 12"
                animate={{ rotate: 360 }}
                transition={{ duration: 18 + i * 5, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: '340px 178px' }}
              />
            ))}
            {[
              'M340 178 C252 132 176 88 92 82',
              'M340 178 C438 126 520 84 594 78',
              'M340 178 C250 232 172 278 86 292',
              'M340 178 C438 232 520 276 594 290',
              'M340 178 C330 102 342 56 340 30',
              'M340 178 C350 246 342 300 340 336',
            ].map((d, index) => (
              <motion.path
                key={d}
                d={d}
                fill="none"
                stroke="url(#genericLine)"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 0.55 }}
                transition={{ delay: 0.35 + index * 0.1, duration: 0.95, ease: 'easeInOut' }}
              />
            ))}
          </svg>

          <motion.div
            initial={{ opacity: 0, scale: 0.72 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-1/2 top-1/2 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-indigo-100 bg-white/86 p-4 text-center shadow-2xl shadow-indigo/18 backdrop-blur-xl"
          >
            <motion.div
              className="absolute inset-[-12px] rounded-full border border-indigo/20"
              animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0.14, 0.5] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <div>
              <div className="mx-auto mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-forest to-indigo text-white">
                <Sparkles size={15} />
              </div>
              <div className="bangla text-sm font-black leading-tight text-slate-950">{concept.title}</div>
            </div>
          </motion.div>

          {concept.nodes.map((node, index) => (
            <motion.div
              key={`${node}-${index}`}
              initial={{ opacity: 0, scale: 0.72, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
              transition={{
                opacity: { delay: 0.65 + index * 0.12, duration: 0.42 },
                scale: { delay: 0.65 + index * 0.12, duration: 0.42 },
                y: { delay: 1.2 + index * 0.1, duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
              }}
              className={`absolute ${positions[index]} max-w-[135px] rounded-2xl border border-white/80 bg-white/82 px-3 py-2 text-center shadow-xl shadow-indigo/10 backdrop-blur-xl`}
            >
              <div className="bangla text-xs font-bold leading-snug text-slate-800">{node}</div>
            </motion.div>
          ))}

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.35, duration: 0.55 }}
            className="absolute bottom-5 left-5 z-20 w-[min(420px,calc(100%-2.5rem))] rounded-2xl border border-cyan-100 bg-white/94 px-4 py-3 text-xs text-slate-800 shadow-2xl shadow-indigo/12 backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="bangla font-bold text-slate-900">Teaching flow</div>
              <div className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo">concept reveal</div>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/80">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-aqua via-forest to-saffron"
                initial={{ width: '0%' }}
                animate={{ width: ['0%', '42%', '72%', '100%'] }}
                transition={{ duration: 4.2, repeat: Infinity, repeatDelay: 0.8, ease: 'easeInOut' }}
              />
            </div>
          </motion.div>
        </div>

        <div className="grid content-start gap-3">
          {steps.map((step, index) => (
            <StepCard key={`${step.title}-${index}`} index={index} title={step.title} text={step.text} />
          ))}
        </div>
      </div>
    </TeachingShell>
  )
}
