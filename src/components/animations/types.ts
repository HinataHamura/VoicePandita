import type { ComponentType } from 'react'

export type AnimationKey = 'newton_second_law' | 'photosynthesis' | 'minerals' | 'generic_concept'

export interface TeachingAnimationProps {
  active?: boolean
  compact?: boolean
  question?: string
  graphPath?: string[] | null
  fallbackDiagram?: string | null
}

export interface AnimationTemplate {
  key: AnimationKey
  title: string
  subtitle: string
  component: ComponentType<TeachingAnimationProps>
  prompts: string[]
}
