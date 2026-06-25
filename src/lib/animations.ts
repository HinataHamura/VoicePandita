import type { Variants } from 'framer-motion'

const ease = [0.16, 1, 0.3, 1] as const

export const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
}

export const fadeSlideIn: Variants = {
  hidden: { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.45, ease } },
}

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.4, ease } },
}

export const staggerContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

export const staggerFast: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
}

export const cardHover = {
  rest: { y: 0, boxShadow: '0 18px 48px rgba(23,32,51,0.10)' },
  hover: {
    y: -4,
    boxShadow: '0 28px 64px rgba(79,70,229,0.16)',
    transition: { type: 'spring', stiffness: 400, damping: 25 },
  },
}

export const navItemHover = {
  rest: { x: 0 },
  hover: { x: 2, transition: { type: 'spring', stiffness: 600, damping: 30 } },
}

export const buttonTap = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.97 },
  transition: { type: 'spring', stiffness: 400, damping: 20 },
}

export const perspectiveSlide = (direction: number): Variants => ({
  hidden: { opacity: 0, x: direction * 80, rotateY: direction * 8 },
  visible: { opacity: 1, x: 0, rotateY: 0, transition: { duration: 0.45, ease } },
  exit: { opacity: 0, x: direction * -80, rotateY: direction * -8, transition: { duration: 0.3, ease } },
})

export const checkmarkPop: Variants = {
  hidden: { scale: 0, opacity: 0 },
  visible: {
    scale: 1,
    opacity: 1,
    transition: { type: 'spring', stiffness: 500, damping: 20 },
  },
}
