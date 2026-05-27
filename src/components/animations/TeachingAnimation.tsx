'use client'

import MermaidDiagram from '@/components/MermaidDiagram'
import { animationMap, selectAnimationTemplate } from './registry'
import type { AnimationKey } from './types'

interface Props {
  animationKey?: AnimationKey | null
  question?: string
  graphPath?: string[] | null
  fallbackDiagram?: string | null
}

export default function TeachingAnimation({ animationKey, question, graphPath, fallbackDiagram }: Props) {
  const selected = animationKey || selectAnimationTemplate(question, graphPath)

  if (selected && animationMap[selected]) {
    const Template = animationMap[selected].component
    return <Template active question={question} graphPath={graphPath} fallbackDiagram={fallbackDiagram} />
  }

  if (fallbackDiagram) {
    return <MermaidDiagram chart={fallbackDiagram} />
  }

  return null
}
