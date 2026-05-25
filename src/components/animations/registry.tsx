'use client'

import GenericConceptAnimation from './GenericConceptAnimation'
import MineralAnimation from './MineralAnimation'
import NewtonLawAnimation from './NewtonLawAnimation'
import PhotosynthesisAnimation from './PhotosynthesisAnimation'
import type { AnimationKey, AnimationTemplate } from './types'

export const animationMap: Record<AnimationKey, AnimationTemplate> = {
  newton_second_law: {
    key: 'newton_second_law',
    title: "Newton's Second Law",
    subtitle: 'Force arrow, acceleration pulse, and mass effect.',
    component: NewtonLawAnimation,
    prompts: ['newton', '2nd law', 'second law', 'f=ma', 'force', 'bujhi na'],
  },
  photosynthesis: {
    key: 'photosynthesis',
    title: 'Photosynthesis',
    subtitle: 'Sunlight, water, CO2, glucose, and oxygen.',
    component: PhotosynthesisAnimation,
    prompts: ['photosynthesis', 'salok', 'chlorophyll', 'co2', 'oxygen'],
  },
  minerals: {
    key: 'minerals',
    title: 'Mineral Concept',
    subtitle: 'Earth layers, crystal formation, properties, examples.',
    component: MineralAnimation,
    prompts: ['mineral', 'khonij', 'খনিজ', 'crystal'],
  },
  generic_concept: {
    key: 'generic_concept',
    title: 'AI Concept Visual',
    subtitle: 'Dynamic visual map for any student question.',
    component: GenericConceptAnimation,
    prompts: [],
  },
}

export function selectAnimationTemplate(question = '', graphPath?: string[] | null): AnimationKey | null {
  const haystack = `${question} ${(graphPath || []).join(' ')}`.toLowerCase()
  const found = (Object.keys(animationMap) as AnimationKey[])
    .filter(key => key !== 'generic_concept')
    .find(key => animationMap[key].prompts.some(prompt => haystack.includes(prompt.toLowerCase())))

  return found || null
}
