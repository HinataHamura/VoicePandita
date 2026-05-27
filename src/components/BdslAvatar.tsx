'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as THREE from 'three'
import {
  DEFAULT_BDSL_MOTIONS,
  parseIsharaKothaSigml,
  sampleBdslFrame,
  sigmlUrlForEntry,
  type BdslRigMotion,
} from '@/lib/bdsl/sigmlParser'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  active: boolean
  text: string  // raw LLM output — may contain markdown, Bengali, mixed content
}

type DatasetEntry = {
  gloss: string
  english: string
  category: string
  sigmlPath: string
  datasetRoot?: string
}

type SignToken = {
  word: string
  gloss: string
  english: string
  category: string
  sigmlPath: string
  datasetRoot?: string
  known: boolean
}

type LlmTranslations = Record<string, string[]>

declare global {
  interface Window {
    CWASA?: {
      init?: (options?: unknown) => void
      playSiGMLURL?: (...args: unknown[]) => void
      stopSiGML?: (...args: unknown[]) => void
    }
  }
}

const CWASA_BASE_URL = 'https://vhg.cmp.uea.ac.uk/tech/jas/vhg2026'
const CWASA_SCRIPT_URL = `${CWASA_BASE_URL}/cwa/allcsa.js`
const CWASA_STYLE_URL = `${CWASA_BASE_URL}/cwa/cwasa.css`
let cwasaLoadPromise: Promise<void> | null = null

function ensureCwasaLoaded() {
  if (typeof window === 'undefined') return Promise.reject(new Error('CWASA is browser-only'))
  if (window.CWASA) return Promise.resolve()
  if (cwasaLoadPromise) return cwasaLoadPromise

  cwasaLoadPromise = new Promise<void>((resolve, reject) => {
    if (!document.querySelector(`link[href="${CWASA_STYLE_URL}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = CWASA_STYLE_URL
      document.head.appendChild(link)
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${CWASA_SCRIPT_URL}"]`)
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(), { once: true })
      existingScript.addEventListener('error', () => reject(new Error('Failed to load CWASA')), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = CWASA_SCRIPT_URL
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load CWASA'))
    document.body.appendChild(script)
  })

  return cwasaLoadPromise
}

// ─── Category → colour ────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  'Work':                  { bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },
  'Animals and Birds':     { bg: '#E1F5EE', text: '#0F6E56', dot: '#1D9E75' },
  'Body Parts':            { bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27' },
  'City':                  { bg: '#E6F1FB', text: '#185FA5', dot: '#378ADD' },
  'Country':               { bg: '#E6F1FB', text: '#0C447C', dot: '#378ADD' },
  'Crime and Law':         { bg: '#FCEBEB', text: '#A32D2D', dot: '#E24B4A' },
  'Economic':              { bg: '#FAEEDA', text: '#633806', dot: '#BA7517' },
  'Education':             { bg: '#EEEDFE', text: '#3C3489', dot: '#7F77DD' },
  'Family and Relatives':  { bg: '#FBEAF0', text: '#993556', dot: '#D4537E' },
  'Festival':              { bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27' },
  'Food and Drinks':       { bg: '#FAECE7', text: '#993C1D', dot: '#D85A30' },
  'Household Items':       { bg: '#E1F5EE', text: '#085041', dot: '#1D9E75' },
  'Human Characteristics': { bg: '#FBEAF0', text: '#72243E', dot: '#D4537E' },
  'Important Places':      { bg: '#E6F1FB', text: '#185FA5', dot: '#378ADD' },
  'International':         { bg: '#EEEDFE', text: '#534AB7', dot: '#7F77DD' },
  'Letters':               { bg: '#F1EFE8', text: '#5F5E5A', dot: '#888780' },
  'Nature and Environment':{ bg: '#EAF3DE', text: '#27500A', dot: '#639922' },
  'Numbers':               { bg: '#F1EFE8', text: '#444441', dot: '#888780' },
  'Politics':              { bg: '#FCEBEB', text: '#791F1F', dot: '#E24B4A' },
  'Profession':            { bg: '#E1F5EE', text: '#0F6E56', dot: '#1D9E75' },
  'Religion':              { bg: '#FAEEDA', text: '#854F0B', dot: '#EF9F27' },
  'Social Work':           { bg: '#EEEDFE', text: '#3C3489', dot: '#7F77DD' },
  'Transport':             { bg: '#E6F1FB', text: '#185FA5', dot: '#378ADD' },
  'Agriculture':           { bg: '#EAF3DE', text: '#3B6D11', dot: '#639922' },
  'Others - 1':            { bg: '#F1EFE8', text: '#5F5E5A', dot: '#B4B2A9' },
  'Others - 2':            { bg: '#F1EFE8', text: '#5F5E5A', dot: '#B4B2A9' },
  'Others - 3':            { bg: '#F1EFE8', text: '#5F5E5A', dot: '#B4B2A9' },
  'Unknown':               { bg: '#F1EFE8', text: '#888780', dot: '#B4B2A9' },
}
const getColor = (cat: string) => CATEGORY_COLORS[cat] ?? CATEGORY_COLORS['Unknown']

// ─── Hand shape SVGs ──────────────────────────────────────────────────────────
type HandVariant = 'open' | 'point' | 'fist' | 'flat' | 'peace' | 'thumb'

const CAT_HAND: Record<string, HandVariant> = {
  'Education': 'flat', 'Numbers': 'point', 'Letters': 'point',
  'Social Work': 'open', 'Family and Relatives': 'peace',
  'Work': 'fist', 'Transport': 'thumb',
  'Food and Drinks': 'open', 'Nature and Environment': 'flat',
}
const ALL_SHAPES: HandVariant[] = ['open', 'point', 'flat', 'peace', 'fist', 'thumb']
const handKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]/g, '')

const WORD_HAND: Record<string, HandVariant> = {
  sun: 'open',
  heat: 'flat',
  light: 'point',
  land: 'fist',
  river: 'peace',
  canal: 'flat',
  pond: 'open',
  sea: 'peace',
  water: 'open',
  steam: 'thumb',
  air: 'open',
  sky: 'open',
  cloud: 'flat',
  rain: 'point',
  evaporate: 'thumb',
  change: 'thumb',
  continuous: 'peace',
  up: 'point',
  direction: 'point',
  shape: 'flat',
  form: 'flat',
  book: 'flat',
  school: 'point',
  learn: 'flat',
  teacher: 'point',
  mother: 'peace',
  father: 'fist',
  home: 'flat',
  good: 'thumb',
  work: 'fist',
  come: 'open',
  go: 'point',
  hello: 'open',
  thank: 'flat',
}

function stableShapeSeed(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

function handFor(token: SignToken, i: number): HandVariant {
  const keys = [token.gloss, token.english, token.word, token.sigmlPath].map(handKey).filter(Boolean)
  for (const key of keys) {
    if (WORD_HAND[key]) return WORD_HAND[key]
  }
  if (token.known) {
    const seed = stableShapeSeed(keys.join('|') || `${token.category}-${i}`)
    return ALL_SHAPES[seed % ALL_SHAPES.length]
  }
  return CAT_HAND[token.category] ?? ALL_SHAPES[i % ALL_SHAPES.length]
}

// ─── Text cleaning — handles LLM markdown output ──────────────────────────────
type FingerPose = {
  rotate: number
  y: number
  scaleY: number
  opacity: number
}

const FINGER_POSES: Record<HandVariant, FingerPose[]> = {
  open: [
    { rotate: -12, y: 0, scaleY: 1, opacity: 1 },
    { rotate: -4, y: -6, scaleY: 1.08, opacity: 1 },
    { rotate: 4, y: -4, scaleY: 1.04, opacity: 1 },
    { rotate: 12, y: 3, scaleY: 0.94, opacity: 1 },
  ],
  flat: [
    { rotate: -4, y: -2, scaleY: 1.03, opacity: 1 },
    { rotate: -1, y: -7, scaleY: 1.1, opacity: 1 },
    { rotate: 1, y: -5, scaleY: 1.08, opacity: 1 },
    { rotate: 4, y: 0, scaleY: 1.01, opacity: 1 },
  ],
  point: [
    { rotate: 66, y: 36, scaleY: 0.62, opacity: 0.95 },
    { rotate: -3, y: -8, scaleY: 1.12, opacity: 1 },
    { rotate: 60, y: 34, scaleY: 0.66, opacity: 0.95 },
    { rotate: 66, y: 38, scaleY: 0.58, opacity: 0.95 },
  ],
  fist: [
    { rotate: 74, y: 40, scaleY: 0.56, opacity: 0.96 },
    { rotate: 72, y: 35, scaleY: 0.6, opacity: 0.96 },
    { rotate: 72, y: 36, scaleY: 0.58, opacity: 0.96 },
    { rotate: 76, y: 42, scaleY: 0.54, opacity: 0.96 },
  ],
  peace: [
    { rotate: 66, y: 36, scaleY: 0.62, opacity: 0.95 },
    { rotate: -8, y: -7, scaleY: 1.1, opacity: 1 },
    { rotate: 8, y: -7, scaleY: 1.08, opacity: 1 },
    { rotate: 68, y: 38, scaleY: 0.58, opacity: 0.95 },
  ],
  thumb: [
    { rotate: 68, y: 35, scaleY: 0.62, opacity: 0.95 },
    { rotate: 66, y: 32, scaleY: 0.64, opacity: 0.95 },
    { rotate: 68, y: 34, scaleY: 0.62, opacity: 0.95 },
    { rotate: 72, y: 37, scaleY: 0.58, opacity: 0.95 },
  ],
}

function RealisticSignHand({ variant, accent, playing, id }: {
  variant: HandVariant
  accent: string
  playing: boolean
  id: string
}) {
  const poses = FINGER_POSES[variant]
  const fingerX = [42, 56, 70, 84]
  const fingerH = [56, 66, 62, 52]
  const handMotion = playing
    ? { rotate: variant === 'thumb' ? [0, -7, 4, 0] : [-3, 4, -2], y: [0, -5, 2, 0], x: [0, 3, -2, 0] }
    : { rotate: 0, y: 0, x: 0 }
  const thumbMotion = variant === 'thumb'
    ? { rotate: [-38, -62, -42], x: [-1, -8, -1], y: [0, -6, 0] }
    : variant === 'fist'
      ? { rotate: [-12, -18, -12], x: [0, 2, 0], y: [0, 2, 0] }
      : { rotate: [-34, -42, -34], x: [0, -2, 0], y: [0, -1, 0] }

  return (
    <svg viewBox="0 0 132 160" width="122" height="122" role="img" aria-label={`${variant} signing hand`}>
      <defs>
        <linearGradient id={`${id}-skin`} x1="28" x2="98" y1="12" y2="136" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#F6A27D" />
          <stop offset="0.48" stopColor="#DD7356" />
          <stop offset="1" stopColor="#B94E3D" />
        </linearGradient>
        <linearGradient id={`${id}-highlight`} x1="36" x2="88" y1="28" y2="122" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD0B3" stopOpacity="0.9" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#5F2A20" floodOpacity="0.2" />
        </filter>
      </defs>

      <ellipse cx="66" cy="143" rx="35" ry="7" fill="#000" opacity="0.09" />
      <motion.g
        filter={`url(#${id}-shadow)`}
        animate={handMotion}
        transition={{ duration: 0.92, ease: 'easeInOut', repeat: playing ? Infinity : 0 }}
        style={{ transformOrigin: '66px 104px' }}
      >
        <motion.g
          animate={thumbMotion}
          transition={{ duration: 0.7, ease: 'easeInOut', repeat: playing ? Infinity : 0 }}
          style={{ transformOrigin: '42px 98px' }}
        >
          <rect x="17" y="66" width="21" height="53" rx="10.5" fill={`url(#${id}-skin)`} />
          <ellipse cx="26" cy="65" rx="9" ry="5.5" fill="#FFD4BE" opacity="0.42" transform="rotate(-22 26 65)" />
        </motion.g>

        {fingerX.map((x, i) => {
          const pose = poses[i]
          const knuckleY = 76 + Math.max(0, pose.y * 0.35)
          return (
            <motion.g
              key={x}
              animate={{
                rotate: playing ? [pose.rotate - 3, pose.rotate + 5, pose.rotate - 2] : pose.rotate,
                y: playing ? [pose.y, pose.y - 4, pose.y] : pose.y,
                scaleY: pose.scaleY,
                opacity: pose.opacity,
              }}
              transition={{ duration: 0.82 + i * 0.07, ease: 'easeInOut', repeat: playing ? Infinity : 0 }}
              style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}
            >
              <rect x={x} y={18 + i * 2} width="14" height={fingerH[i]} rx="7" fill={`url(#${id}-skin)`} />
              <rect x={x + 2.5} y={21 + i * 2} width="9" height="8" rx="4" fill="#FFE0CF" opacity="0.55" />
              <path d={`M${x + 2} ${knuckleY} C${x + 5} ${knuckleY + 2}, ${x + 9} ${knuckleY + 2}, ${x + 12} ${knuckleY}`} stroke="#8E3F32" strokeOpacity="0.22" strokeWidth="1.2" fill="none" />
            </motion.g>
          )
        })}

        <path
          d="M34 86 C34 72 44 63 58 64 L78 65 C92 66 101 76 101 90 L101 119 C101 134 91 143 74 143 L56 143 C42 143 32 133 32 119 Z"
          fill={`url(#${id}-skin)`}
        />
        <path
          d="M44 88 C54 78 79 78 91 89 C87 107 80 124 64 132 C51 126 44 111 44 88 Z"
          fill={`url(#${id}-highlight)`}
        />
        <path d="M48 105 C56 110 75 111 86 105" stroke="#7A3229" strokeOpacity="0.22" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        <path d="M49 121 C58 126 73 126 83 119" stroke="#7A3229" strokeOpacity="0.16" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <rect x="42" y="133" width="48" height="16" rx="7" fill="#B94E3D" opacity="0.92" />
        <rect x="42" y="144" width="48" height="7" rx="3.5" fill={accent} opacity="0.55" />
      </motion.g>
    </svg>
  )
}

function cleanLLMText(raw: string): string {
  return raw
    // strip markdown bold/italic/code
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    // strip URLs
    .replace(/https?:\/\/\S+/g, '')
    // keep English, Bengali, digits, and whitespace for sign matching
    .replace(/[^\u0980-\u09FFa-zA-Z0-9\s?]/g, ' ')
    // collapse whitespace
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Stop words (grammar words that have no sign) ─────────────────────────────
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could',
  'should','may','might','shall','can','need','dare','ought',
  'and','or','but','so','yet','for','nor',
  'in','on','at','by','to','of','up','as','into','onto','upon',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their',
  'this','that','these','those',
  'not','no','nor','very','just','also','only','even','still',
  'then','when','where','which','who','whom','whose','how','why',
  'if','because','since','while','although','though','unless',
  'after','before','during','about','above','below','between',
  'from','with','without','through','across','against','among',
  'হলো','হল','হয়','হয়','হওয়া','হওয়ার','হয়ে','হয়েছে',
  'ও','এবং','আর','বা','কিন্তু','তাই','যে','যা','যখন','তখন',
  'একটি','একটা','এই','ওই','তার','তাদের','আমাদের','এর',
  'থেকে','দিয়ে','জন্য','সাথে','কারণ','কারণে','না','আছে',
])

const EXTRA_STOP_WORDS = new Set([
  '\u09B9\u09AC\u09C7', '\u09B9\u09B2\u09C7', '\u09B9\u09B2\u09CB', '\u09B9\u09B2',
  '\u09B9\u09DF', '\u09B9\u09AF\u09BC', '\u09B9\u09AF\u09BC\u09C7', '\u09B9\u09DF\u09C7',
  '\u098F\u099F\u09BF', '\u098F\u099F\u09BE', '\u098F\u0995\u099F\u09BF', '\u098F\u0995\u099F\u09BE',
  '\u0993', '\u098F\u09AC\u0982', '\u0986\u09B0', '\u09AC\u09BE', '\u09A4\u09BE\u0987',
  '\u09AF\u09C7', '\u09AF\u09BE', '\u098F\u09B0', '\u09A5\u09C7\u0995\u09C7',
  '\u09A6\u09BF\u09AF\u09BC\u09C7', '\u099C\u09A8\u09CD\u09AF', '\u09AE\u09A4\u09CB',
  '\u0986\u099B\u09C7', '\u09A8\u09BE', '\u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09DF\u09BE\u099F\u09BF',
  '\u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09AF\u09BC\u09BE\u099F\u09BF', '\u0985\u09A8\u09A8\u09CD\u09AF',
  '\u0985\u09A8\u09CD\u09AF\u09A8\u09CD\u09AF',
])

const isStopWord = (word: string) => {
  const lower = word.toLowerCase()
  const normalized = norm(word)
  return STOP_WORDS.has(lower) || STOP_WORDS.has(normalized) || EXTRA_STOP_WORDS.has(word.trim()) || EXTRA_STOP_WORDS.has(normalized)
}

// Bengali word -> English dataset key. The local dataset mostly uses English
// filenames/glosses, so this bridges Bangla tutor text to available signs.
const BN_TO_EN: Record<string, string> = {
  'বৃষ্টি': 'Rain', 'বৃষ্টিপাত': 'Rain', 'বৃষ্টিপাতের': 'Rain',
  'সমুদ্র': 'Sea', 'সাগর': 'Sea', 'সাগরের': 'Sea',
  'নদী': 'River', 'নদ': 'River', 'নদীর': 'River',
  'সূর্য': 'Sun', 'সূর্যের': 'Sun', 'সূর্যতাপে': 'Sun',
  'পানি': 'Water', 'জল': 'Water', 'জলের': 'Water',
  'বায়ু': 'Air', 'বাতাস': 'Air', 'বাতাসের': 'Air',
  'মেঘ': 'Cloud', 'মেঘের': 'Cloud',
  'আকাশ': 'Sky', 'আকাশের': 'Sky',
  'মাটি': 'Soil', 'মাটির': 'Soil',
  'পাহাড়': 'Mountain', 'পর্বত': 'Mountain',
  'গাছ': 'Tree', 'গাছের': 'Tree',
  'ফুল': 'Flower', 'ফল': 'Fruit', 'ফলের': 'Fruit',
  'মাছ': 'Fish', 'পাখি': 'Bird', 'কুকুর': 'Dog', 'বিড়াল': 'Cat',
  'গরু': 'Cow', 'ছাগল': 'Goat', 'ঘোড়া': 'Horse', 'হাতি': 'Elephant',
  'বাঘ': 'Tiger', 'সিংহ': 'Lion', 'সাপ': 'Snake',
  'মা': 'Mother', 'বাবা': 'Father', 'ভাই': 'Brother', 'বোন': 'Sister',
  'ছেলে': 'Son', 'মেয়ে': 'Daughter', 'বন্ধু': 'Friend',
  'মানুষ': 'Human', 'মানুষের': 'Human', 'লোক': 'Human',
  'ভাত': 'Rice', 'রুটি': 'Bread', 'দুধ': 'Milk', 'ডিম': 'Egg',
  'মাংস': 'Meat', 'সবজি': 'Vegetable', 'ফলমূল': 'Fruit',
  'চা': 'Tea', 'চিনি': 'Sugar', 'লবণ': 'Salt',
  'হাত': 'Hand', 'পা': 'Leg', 'মাথা': 'Head', 'চোখ': 'Eye',
  'কান': 'Ear', 'নাক': 'Nose', 'মুখ': 'Mouth', 'দাঁত': 'Teeth',
  'হৃদয়': 'Heart', 'রক্ত': 'Blood',
  'খাওয়া': 'Eat', 'খায়': 'Eat', 'খাই': 'Eat', 'পান': 'Drink',
  'ঘুম': 'Sleep', 'হাঁটা': 'Walk', 'দৌড়': 'Run', 'বসা': 'Sit',
  'দাঁড়ানো': 'Stand', 'লেখা': 'Write', 'পড়া': 'Read',
  'দেখা': 'See', 'শোনা': 'Hear', 'বলা': 'Say',
  'আসা': 'Come', 'যাওয়া': 'Go', 'নেওয়া': 'Take', 'দেওয়া': 'Give',
  'করা': 'Do', 'কাজ': 'Work', 'রান্না': 'Cook', 'শেখা': 'Learn',
  'বাড়ি': 'Home', 'বাড়ি': 'Home', 'বাসা': 'Home',
  'স্কুল': 'School', 'কলেজ': 'College', 'বিশ্ববিদ্যালয়': 'University',
  'হাসপাতাল': 'Hospital', 'বাজার': 'Market', 'দোকান': 'Shop',
  'রাস্তা': 'Road', 'শহর': 'City', 'গ্রাম': 'Village',
  'দেশ': 'Country', 'বাংলাদেশ': 'Bangladesh', 'ঢাকা': 'Dhaka',
  'ভালো': 'Good', 'ভাল': 'Good', 'খারাপ': 'Bad',
  'বড়': 'Big', 'বড়': 'Big', 'ছোট': 'Small',
  'গরম': 'Hot', 'ঠান্ডা': 'Cold', 'নতুন': 'New', 'পুরানো': 'Old',
  'সুন্দর': 'Beautiful', 'কালো': 'Black', 'সাদা': 'White',
  'লাল': 'Red', 'সবুজ': 'Green', 'নীল': 'Blue', 'হলুদ': 'Yellow',
  'এক': 'One', 'দুই': 'Two', 'তিন': 'Three', 'চার': 'Four',
  'পাঁচ': 'Five', 'ছয়': 'Six', 'ছয়': 'Six', 'সাত': 'Seven',
  'আট': 'Eight', 'নয়': 'Nine', 'নয়': 'Nine', 'দশ': 'Ten',
  'বাষ্প': 'Steam', 'জলীয়': 'Water', 'জলীয়': 'Water',
  'জলচক্র': 'Water', 'তাপ': 'Heat', 'তাপে': 'Heat',
  'পুকুর': 'Pond', 'পুকুরের': 'Pond', 'পুকুরে': 'Pond',
  'বই': 'Book', 'কলম': 'Pen', 'কাগজ': 'Paper',
  'টাকা': 'Money', 'সময়': 'Time', 'সময়': 'Time',
  'নাম': 'Name', 'বয়স': 'Age', 'বয়স': 'Age',
  'ডাক্তার': 'Doctor', 'ওষুধ': 'Medicine',
  'পরিবার': 'Family', 'সমাজ': 'Society', 'জীবন': 'Life',
  'শিক্ষক': 'Teacher', 'ছাত্র': 'Student',
  'আলো': 'Light', 'অন্ধকার': 'Dark',
}

const BN_SUFFIXES = [
  'গুলো','গুলি','দের','ের','র','কে','তে','য়','য়','ে','টা','টি',
]

const EXTRA_BN_TO_EN: Record<string, string> = {
  '\u0995\u09C7\u09A8': 'Cause',
  '\u0995\u09BF': 'What',
  '\u0995\u09C0': 'What',
  '\u0995\u0996\u09A8': 'When',
  '\u0995\u09CB\u09A5\u09BE\u09AF\u09BC': 'Where',
  '\u0995\u09CB\u09A5\u09BE\u09DF': 'Where',
  '\u09AC\u09C1\u099D\u09A4\u09C7': 'To understand',
  '\u09AC\u09C1\u099D\u09BE': 'To understand',
  '\u09AC\u09CB\u099D\u09BE': 'To understand',
  '\u099C\u09BE\u09A8\u09A4\u09C7': 'Know',
  '\u099C\u09BE\u09A8\u09BE': 'Know',
  '\u09A4\u09C0\u09AC\u09CD\u09B0': 'Strong',
  '\u09A4\u09C0\u09AC\u09CD\u09B0\u09A4\u09BE': 'Strong',
  '\u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09DF\u09BE\u099F\u09BF': 'Process',
  '\u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09AF\u09BC\u09BE\u099F\u09BF': 'Process',
  '\u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09DF\u09BE': 'Process',
  '\u09AA\u09CD\u09B0\u0995\u09CD\u09B0\u09BF\u09AF\u09BC\u09BE': 'Process',
  '\u0985\u09A8\u09A8\u09CD\u09AF': 'Other',
  '\u0985\u09A8\u09CD\u09AF\u09A8\u09CD\u09AF': 'Other',
  '\u0986\u0995\u09BE\u09B0': 'Shape',
  '\u0986\u0995\u09BE\u09B0\u09C7': 'Shape',
  '\u09A8\u09BE\u09B2\u09BE': 'Canal',
  '\u0996\u09BE\u09B2': 'Canal',
  '\u09AC\u09BF\u09B2': 'Pond',
  '\u09A4\u09BE\u09AA': 'Heat',
  '\u09A4\u09BE\u09AA\u09C7': 'Heat',
  '\u09AC\u09BE\u09B7\u09CD\u09AA\u09C0\u09AD\u09C2\u09A4': 'Evaporate',
  '\u09AC\u09BE\u09B7\u09CD\u09AA\u09C0\u09AD\u09AC\u09A8': 'Evaporate',
  '\u09AC\u09BE\u09B7\u09CD\u09AA\u09C7': 'Steam',
  '\u09AA\u09CD\u09B0\u09A4\u09BF\u09A8\u09BF\u09DF\u09A4': 'continuous',
  '\u09AA\u09CD\u09B0\u09A4\u09BF\u09A8\u09BF\u09AF\u09BC\u09A4': 'continuous',
  '\u09AC\u09BE\u09DF\u09C1\u09AE\u09A3\u09CD\u09A1\u09B2': 'Air',
  '\u09AC\u09BE\u09DF\u09C1\u09AE\u09A3\u09CD\u09A1\u09B2\u09C7\u09B0': 'Air',
  '\u09AC\u09BE\u09AF\u09BC\u09C1\u09AE\u09A3\u09CD\u09A1\u09B2': 'Air',
  '\u09AC\u09BE\u09AF\u09BC\u09C1\u09AE\u09A3\u09CD\u09A1\u09B2\u09C7\u09B0': 'Air',
  '\u0989\u09AA\u09B0': 'Up',
  '\u0989\u09AA\u09B0\u09C7': 'Up',
  '\u0989\u09AA\u09B0\u09C7\u09B0': 'Up',
  '\u09A6\u09BF\u0995': 'Direction',
  '\u09A6\u09BF\u0995\u09C7': 'Direction',
}

// ─── Dataset + index ──────────────────────────────────────────────────────────
const DATASET_URL = '/data/Sections/dataset.json'

// Seed covers common words so the component works immediately before dataset loads
const SEED: DatasetEntry[] = [
  { gloss:'Water',       english:'Water',       category:'Nature and Environment', sigmlPath:'Water.sigml' },
  { gloss:'Rain',        english:'Rain',         category:'Nature and Environment', sigmlPath:'Rain.sigml' },
  { gloss:'River',       english:'River',        category:'Nature and Environment', sigmlPath:'River.sigml' },
  { gloss:'Sun',         english:'Sun',          category:'Nature and Environment', sigmlPath:'Sun.sigml' },
  { gloss:'Steam',       english:'Steam',        category:'Nature and Environment', sigmlPath:'Steam.sigml' },
  { gloss:'Cloud',       english:'Cloud',        category:'Nature and Environment', sigmlPath:'Cloud.sigml' },
  { gloss:'Sea',         english:'Sea',          category:'Nature and Environment', sigmlPath:'Sea.sigml' },
  { gloss:'Mountain',    english:'Mountain',     category:'Nature and Environment', sigmlPath:'Mountain.sigml' },
  { gloss:'Tree',        english:'Tree',         category:'Nature and Environment', sigmlPath:'Tree.sigml' },
  { gloss:'Sky',         english:'Sky',          category:'Nature and Environment', sigmlPath:'Sky.sigml' },
  { gloss:'Heat',        english:'Heat',         category:'Nature and Environment', sigmlPath:'Heat.sigml' },
  { gloss:'Cold',        english:'Cold',         category:'Nature and Environment', sigmlPath:'Cold.sigml' },
  { gloss:'Fire',        english:'Fire',         category:'Nature and Environment', sigmlPath:'Fire.sigml' },
  { gloss:'Wind',        english:'Wind',         category:'Nature and Environment', sigmlPath:'Wind.sigml' },
  { gloss:'Book',        english:'Book',         category:'Education',             sigmlPath:'Book.sigml' },
  { gloss:'School',      english:'School',       category:'Education',             sigmlPath:'School.sigml' },
  { gloss:'Learn',       english:'Learn',        category:'Education',             sigmlPath:'Learning.sigml' },
  { gloss:'Read',        english:'Read',         category:'Education',             sigmlPath:'Read.sigml' },
  { gloss:'Write',       english:'Write',        category:'Education',             sigmlPath:'Write.sigml' },
  { gloss:'Teacher',     english:'Teacher',      category:'Profession',            sigmlPath:'Teacher.sigml' },
  { gloss:'Doctor',      english:'Doctor',       category:'Profession',            sigmlPath:'Doctor.sigml' },
  { gloss:'Mother',      english:'Mother',       category:'Family and Relatives',  sigmlPath:'Mother.sigml' },
  { gloss:'Father',      english:'Father',       category:'Family and Relatives',  sigmlPath:'Father.sigml' },
  { gloss:'Brother',     english:'Brother',      category:'Family and Relatives',  sigmlPath:'Brother.sigml' },
  { gloss:'Sister',      english:'Sister',       category:'Family and Relatives',  sigmlPath:'Sister.sigml' },
  { gloss:'Child',       english:'Child',        category:'Family and Relatives',  sigmlPath:'Child.sigml' },
  { gloss:'Rice',        english:'Rice',         category:'Food and Drinks',       sigmlPath:'Rice.sigml' },
  { gloss:'Fish',        english:'Fish',         category:'Animals and Birds',     sigmlPath:'Fish.sigml' },
  { gloss:'Cat',         english:'Cat',          category:'Animals and Birds',     sigmlPath:'Cat.sigml' },
  { gloss:'Dog',         english:'Dog',          category:'Animals and Birds',     sigmlPath:'Dog.sigml' },
  { gloss:'Bird',        english:'Bird',         category:'Animals and Birds',     sigmlPath:'Bird.sigml' },
  { gloss:'Home',        english:'Home',         category:'Household Items',       sigmlPath:'Home.sigml' },
  { gloss:'Bangladesh',  english:'Bangladesh',   category:'Country',               sigmlPath:'Bangladesh.sigml' },
  { gloss:'Good',        english:'Good',         category:'Human Characteristics', sigmlPath:'Good.sigml' },
  { gloss:'Work',        english:'Work',         category:'Work',                  sigmlPath:'Work.sigml' },
  { gloss:'Come',        english:'Come',         category:'Work',                  sigmlPath:'Come.sigml' },
  { gloss:'Go',          english:'Go',           category:'Work',                  sigmlPath:'Go.sigml' },
  { gloss:'Hello',       english:'Hello',        category:'Social Work',           sigmlPath:'Hello.sigml' },
  { gloss:'Thank',       english:'Thank',        category:'Social Work',           sigmlPath:'Thank.sigml' },
  { gloss:'Help',        english:'Help',         category:'Social Work',           sigmlPath:'Help.sigml' },
  { gloss:'Road',        english:'Road',         category:'Transport',             sigmlPath:'Road.sigml' },
  { gloss:'Evaporate',   english:'Evaporate',    category:'Nature and Environment', sigmlPath:'Evaporate.sigml' },
  { gloss:'Surface',     english:'Surface',      category:'Nature and Environment', sigmlPath:'Surface.sigml' },
  { gloss:'Absorb',      english:'Absorb',       category:'Nature and Environment', sigmlPath:'Absorb.sigml' },
  { gloss:'Form',        english:'Form',         category:'Nature and Environment', sigmlPath:'Form.sigml' },
  { gloss:'Fall',        english:'Fall',         category:'Nature and Environment', sigmlPath:'Fall.sigml' },
  { gloss:'Rise',        english:'Rise',         category:'Nature and Environment', sigmlPath:'Rise.sigml' },
  { gloss:'Cycle',       english:'Cycle',        category:'Nature and Environment', sigmlPath:'Cycle.sigml' },
  { gloss:'Animal',      english:'Animal',       category:'Animals and Birds',     sigmlPath:'Animal.sigml' },
  { gloss:'Human',       english:'Human',        category:'Human Characteristics', sigmlPath:'Human.sigml' },
  { gloss:'Food',        english:'Food',         category:'Food and Drinks',       sigmlPath:'Food.sigml' },
  { gloss:'Eat',         english:'Eat',          category:'Food and Drinks',       sigmlPath:'Eat.sigml' },
  { gloss:'Drink',       english:'Drink',        category:'Food and Drinks',       sigmlPath:'Drink.sigml' },
  { gloss:'Sleep',       english:'Sleep',        category:'Work',                  sigmlPath:'Sleep.sigml' },
  { gloss:'Walk',        english:'Walk',         category:'Work',                  sigmlPath:'Walk.sigml' },
  { gloss:'Run',         english:'Run',          category:'Work',                  sigmlPath:'Run.sigml' },
  { gloss:'See',         english:'See',          category:'Work',                  sigmlPath:'See.sigml' },
  { gloss:'Hear',        english:'Hear',         category:'Body Parts',            sigmlPath:'Hear.sigml' },
  { gloss:'Hand',        english:'Hand',         category:'Body Parts',            sigmlPath:'Hand.sigml' },
  { gloss:'Eye',         english:'Eye',          category:'Body Parts',            sigmlPath:'Eye.sigml' },
  { gloss:'Head',        english:'Head',         category:'Body Parts',            sigmlPath:'Head.sigml' },
  { gloss:'Heart',       english:'Heart',        category:'Body Parts',            sigmlPath:'Heart.sigml' },
  { gloss:'Blood',       english:'Blood',        category:'Body Parts',            sigmlPath:'Blood.sigml' },
  { gloss:'Time',        english:'Time',         category:'Others - 1',            sigmlPath:'Time.sigml' },
  { gloss:'Day',         english:'Day',          category:'Others - 1',            sigmlPath:'Day.sigml' },
  { gloss:'Night',       english:'Night',        category:'Others - 1',            sigmlPath:'Night.sigml' },
  { gloss:'Morning',     english:'Morning',      category:'Others - 1',            sigmlPath:'Morning.sigml' },
  { gloss:'Year',        english:'Year',         category:'Others - 1',            sigmlPath:'Year.sigml' },
  { gloss:'House',       english:'House',        category:'Household Items',       sigmlPath:'House.sigml' },
  { gloss:'Money',       english:'Money',        category:'Economic',              sigmlPath:'Money.sigml' },
  { gloss:'Country',     english:'Country',      category:'Country',               sigmlPath:'Country.sigml' },
  { gloss:'City',        english:'City',         category:'City',                  sigmlPath:'City.sigml' },
  { gloss:'People',      english:'People',       category:'Human Characteristics', sigmlPath:'People.sigml' },
  { gloss:'Life',        english:'Life',         category:'Human Characteristics', sigmlPath:'Life.sigml' },
  { gloss:'Love',        english:'Love',         category:'Human Characteristics', sigmlPath:'Love.sigml' },
  { gloss:'Happy',       english:'Happy',        category:'Human Characteristics', sigmlPath:'Happy.sigml' },
  { gloss:'Sad',         english:'Sad',          category:'Human Characteristics', sigmlPath:'Sad.sigml' },
  { gloss:'Big',         english:'Big',          category:'Human Characteristics', sigmlPath:'Big.sigml' },
  { gloss:'Small',       english:'Small',        category:'Human Characteristics', sigmlPath:'Small.sigml' },
  { gloss:'New',         english:'New',          category:'Others - 1',            sigmlPath:'New.sigml' },
  { gloss:'Old',         english:'Old',          category:'Others - 1',            sigmlPath:'Old.sigml' },
]

async function loadDataset(): Promise<DatasetEntry[]> {
  const res = await fetch(DATASET_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = await res.json() as Record<string, string>[]
  return raw
    .filter((item) => !!item && typeof item === 'object')
    .map((item) => ({
      gloss:     item.gloss     ?? '',
      english:   item.english   ?? item.gloss ?? '',
      category:  item.sectionEn ?? item.category ?? 'Unknown',
      sigmlPath: item.sigmlPath ?? '',
      datasetRoot: item.datasetRoot ?? '',
    }))
    .filter((e) => e.english.trim())
}

// ─── Index & lookup ───────────────────────────────────────────────────────────
const norm = (s: string) =>
  s.normalize('NFC').toLowerCase().replace(/[^\u0980-\u09FFa-z0-9]/g, '')

function buildIndex(entries: DatasetEntry[]): Map<string, DatasetEntry> {
  const idx = new Map<string, DatasetEntry>()
  for (const e of entries) {
    if (e.english) idx.set(norm(e.english), e)
    if (e.gloss)   idx.set(norm(e.gloss),   e)
  }
  return idx
}

const SUFFIXES = ['tion','sion','ness','ment','ing','ers','ies','ed','er','es','ly','s','e']

function lookupIndexedWord(idx: Map<string, DatasetEntry>, word: string): DatasetEntry | null {
  const n = norm(word)
  if (!n) return null
  if (idx.has(n)) return idx.get(n)!

  for (const sfx of SUFFIXES) {
    if (n.length > sfx.length + 3 && n.endsWith(sfx)) {
      const stem = n.slice(0, -sfx.length)
      if (idx.has(stem))       return idx.get(stem)!
      if (idx.has(stem + 'e')) return idx.get(stem + 'e')!
      if (idx.has(stem + 'y')) return idx.get(stem + 'y')!
    }
  }
  return null
}

function bengaliVariants(normalized: string): string[] {
  return BN_SUFFIXES
    .map((suffix) => (normalized.endsWith(suffix) ? normalized.slice(0, -suffix.length) : ''))
    .filter((variant) => variant && variant !== normalized)
}

function lookupWord(
  idx: Map<string, DatasetEntry>,
  word: string,
  llmTranslations: LlmTranslations = {},
): DatasetEntry | null {
  const direct = lookupIndexedWord(idx, word)
  if (direct) return direct

  const normalized = norm(word)
  const translated = EXTRA_BN_TO_EN[word.trim()] ?? EXTRA_BN_TO_EN[normalized] ?? BN_TO_EN[word.trim()] ?? BN_TO_EN[normalized]
  if (translated) {
    const translatedEntry = lookupIndexedWord(idx, translated)
    if (translatedEntry) return translatedEntry
  }

  const llmCandidates = llmTranslations[normalized] ?? []
  for (const candidate of llmCandidates) {
    const llmEntry = lookupIndexedWord(idx, candidate)
    if (llmEntry) return llmEntry
  }

  for (const variant of bengaliVariants(normalized)) {
    const translatedVariant = EXTRA_BN_TO_EN[variant] ?? BN_TO_EN[variant]
    if (translatedVariant) {
      const variantEntry = lookupIndexedWord(idx, translatedVariant)
      if (variantEntry) return variantEntry
    }
    for (const candidate of llmTranslations[variant] ?? []) {
      const llmVariantEntry = lookupIndexedWord(idx, candidate)
      if (llmVariantEntry) return llmVariantEntry
    }
    const directVariant = lookupIndexedWord(idx, variant)
    if (directVariant) return directVariant
  }

  return null
}

// ─── Core tokeniser — works on cleaned LLM output ────────────────────────────
function tokeniseText(rawText: string, idx: Map<string, DatasetEntry>, llmTranslations: LlmTranslations = {}): SignToken[] {
  const cleaned = cleanLLMText(rawText)
  if (!cleaned) return []

  const rawWords = cleaned.split(/\s+/).filter((w) => w.length > 0)

  // Try 2-word phrases first (dataset has 559 multi-word glosses)
  const tokens: SignToken[] = []
  let i = 0
  while (i < rawWords.length && tokens.length < 16) {
    const w1 = rawWords[i]
    const w2 = rawWords[i + 1]
    // Attempt 2-word match
    if (w2) {
      const phrase = w1 + ' ' + w2
      const phraseEntry = lookupWord(idx, phrase, llmTranslations) ?? idx.get(norm(phrase)) ?? null
      if (phraseEntry) {
        tokens.push({ word: phrase, gloss: phraseEntry.gloss, english: phraseEntry.english, category: phraseEntry.category, sigmlPath: phraseEntry.sigmlPath, datasetRoot: phraseEntry.datasetRoot, known: true })
        i += 2
        continue
      }
    }
    // Single word: skip stop words unless in index
    const inIndex = lookupWord(idx, w1, llmTranslations) !== null
    if (!inIndex && isStopWord(w1)) { i++; continue }
    if (w1.length < 2) { i++; continue }

    const entry = lookupWord(idx, w1, llmTranslations)
    if (entry) {
      tokens.push({ word: w1, gloss: entry.gloss, english: entry.english, category: entry.category, sigmlPath: entry.sigmlPath, datasetRoot: entry.datasetRoot, known: true })
    } else {
      // Unknown word — still show it as fingerspell so we never return empty
      tokens.push({ word: w1, gloss: w1, english: w1, category: 'Unknown', sigmlPath: '', known: false })
    }
    i++
  }

  return tokens
}

// ─── Waveform ─────────────────────────────────────────────────────────────────
type RigFrame = {
  left: [number, number, number]
  right: [number, number, number]
  leftRot: [number, number, number]
  rightRot: [number, number, number]
}

type RigMotion = {
  frames: RigFrame[]
  leftHand: HandVariant
  rightHand: HandVariant
  speed: number
  source: 'sigml' | 'fallback'
}

const degToRad = (value: number) => (value * Math.PI) / 180
const frame = (
  left: [number, number, number],
  right: [number, number, number],
  leftRot: [number, number, number] = [0, -18, -8],
  rightRot: [number, number, number] = [0, 18, 8],
): RigFrame => ({ left, right, leftRot, rightRot })

const LOCATION_POINTS: Record<string, [number, number, number]> = {
  neutral: [0, 1.35, 0.25],
  shoulders: [0.78, 1.7, 0.18],
  shoulder: [0.78, 1.7, 0.18],
  chest: [0.18, 1.35, 0.42],
  sternum: [0.16, 1.42, 0.42],
  head: [0.32, 2.08, 0.18],
  face: [0.18, 1.92, 0.46],
  mouth: [0.1, 1.84, 0.58],
  chin: [0.1, 1.76, 0.55],
  hand: [0.54, 1.42, 0.35],
}

const DEFAULT_MOTIONS: Record<HandVariant, RigMotion> = {
  open: { leftHand: 'open', rightHand: 'open', speed: 1, source: 'fallback', frames: [frame([-0.8, 1.25, 0.18], [0.62, 1.5, 0.58]), frame([-0.78, 1.3, 0.2], [0.92, 1.62, 0.68], [0, -18, -8], [-12, 32, 18]), frame([-0.8, 1.25, 0.18], [0.62, 1.5, 0.58])] },
  point: { leftHand: 'open', rightHand: 'point', speed: 1, source: 'fallback', frames: [frame([-0.82, 1.22, 0.16], [0.48, 1.58, 0.7]), frame([-0.82, 1.22, 0.16], [0.68, 1.8, 0.85], [0, -18, -8], [-24, 18, 5]), frame([-0.82, 1.22, 0.16], [0.48, 1.58, 0.7])] },
  flat: { leftHand: 'flat', rightHand: 'flat', speed: 1, source: 'fallback', frames: [frame([-0.58, 1.28, 0.45], [0.58, 1.28, 0.45], [8, -20, -8], [8, 20, 8]), frame([-0.24, 1.58, 0.62], [0.24, 1.58, 0.62], [-4, -6, 6], [-4, 6, -6]), frame([-0.58, 1.28, 0.45], [0.58, 1.28, 0.45], [8, -20, -8], [8, 20, 8])] },
  peace: { leftHand: 'open', rightHand: 'peace', speed: 1, source: 'fallback', frames: [frame([-0.72, 1.24, 0.16], [0.45, 1.48, 0.62]), frame([-0.72, 1.24, 0.16], [0.78, 1.62, 0.76], [0, -18, -8], [-12, 28, 18]), frame([-0.72, 1.24, 0.16], [0.45, 1.48, 0.62])] },
  fist: { leftHand: 'fist', rightHand: 'fist', speed: 1, source: 'fallback', frames: [frame([-0.48, 1.24, 0.42], [0.48, 1.24, 0.42]), frame([-0.34, 1.48, 0.62], [0.34, 1.48, 0.62]), frame([-0.48, 1.24, 0.42], [0.48, 1.24, 0.42])] },
  thumb: { leftHand: 'fist', rightHand: 'thumb', speed: 1, source: 'fallback', frames: [frame([-0.72, 1.24, 0.16], [0.48, 1.44, 0.62]), frame([-0.72, 1.24, 0.16], [0.72, 1.62, 0.72], [0, -18, -8], [-22, 18, 18]), frame([-0.72, 1.24, 0.16], [0.48, 1.44, 0.62])] },
}

function sigmlUrl(token: SignToken) {
  if (!token.sigmlPath) return null
  if (!token.datasetRoot) return null
  if (/^https?:\/\//i.test(token.sigmlPath)) return token.sigmlPath
  const rootBase = DATASET_URL.replace('/dataset.json', '')
  const root = `${rootBase}/${encodeURIComponent(token.datasetRoot)}`
  const file = encodeURIComponent(token.sigmlPath.replaceAll('\\', '/').split('/').pop() ?? token.sigmlPath)
  return `${root}/${file}`
}

function handFromHam(tags: string, fallback: HandVariant): HandVariant {
  if (/hamfist|hamceeall|hamfingerbendmod|hamclose/.test(tags)) return 'fist'
  if (/hamfinger23|hamvsign/.test(tags)) return 'peace'
  if (/hamflathand|hampalmd/.test(tags)) return 'flat'
  if (/hamfinger2|hamindex|hamextfingeru|hamextfingerl/.test(tags)) return 'point'
  if (/hamthumb|hamthumboutmod/.test(tags)) return 'thumb'
  return fallback
}

function pointForTags(tags: string): [number, number, number] {
  const key = Object.keys(LOCATION_POINTS).find((name) => tags.includes(`ham${name}`))
  return key ? LOCATION_POINTS[key] : LOCATION_POINTS.neutral
}

function parseSigmlMotion(xml: string, fallback: HandVariant): RigMotion {
  const tags = Array.from(xml.matchAll(/<\s*(ham[a-z0-9_:-]+)/gi)).map((m) => m[1].toLowerCase()).join(' ')
  const hand = handFromHam(tags, fallback)
  const base = pointForTags(tags)
  const leftBase: [number, number, number] = [-Math.abs(base[0] || 0.64), base[1], base[2]]
  const rightBase: [number, number, number] = [Math.abs(base[0] || 0.64), base[1], base[2]]
  const dx = tags.includes('haml') ? -0.28 : tags.includes('hamr') ? 0.28 : 0.18
  const dy = tags.includes('hamup') ? 0.32 : tags.includes('hamdown') ? -0.28 : tags.includes('hamcircle') ? 0.18 : 0.08
  const dz = tags.includes('hamclose') ? -0.18 : tags.includes('hamfar') || tags.includes('hamforward') ? 0.32 : 0.16
  const both = /hambetween|hamboth|hamcircle|hamrepeat/.test(tags)
  const midR: [number, number, number] = [rightBase[0] + dx, rightBase[1] + dy, rightBase[2] + dz]
  const midL: [number, number, number] = both ? [leftBase[0] - dx, leftBase[1] + dy, leftBase[2] + dz] : [-0.82, 1.22, 0.16]
  const frames = tags.includes('hamcircle')
    ? [frame(leftBase, rightBase), frame(midL, midR, [8, -24, -18], [8, 24, 18]), frame([leftBase[0], leftBase[1] - 0.12, leftBase[2] + 0.22], [rightBase[0], rightBase[1] - 0.12, rightBase[2] + 0.22], [-8, -12, 18], [-8, 12, -18]), frame(leftBase, rightBase)]
    : [frame(leftBase, rightBase), frame(midL, midR), frame(leftBase, rightBase)]
  return { frames, leftHand: both ? hand : 'open', rightHand: hand, speed: tags.includes('hamslow') ? 1.35 : tags.includes('hamfast') ? 0.7 : 1, source: 'sigml' }
}

function sampleFrame(frames: RigFrame[], phase: number) {
  const scaled = (phase % 1) * (frames.length - 1)
  const i = Math.floor(scaled)
  const ni = Math.min(i + 1, frames.length - 1)
  const t = scaled - i
  const mix = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  return { left: mix(frames[i].left, frames[ni].left), right: mix(frames[i].right, frames[ni].right), leftRot: mix(frames[i].leftRot, frames[ni].leftRot), rightRot: mix(frames[i].rightRot, frames[ni].rightRot) }
}

function SignWaveform({ color, playing }: { color: string; playing: boolean }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'3px', height:'44px' }}>
      {Array.from({ length: 24 }, (_, i) => (
        <div key={i} style={{
          width: '3px', borderRadius: '2px', backgroundColor: color, opacity: 0.75,
          minHeight: '4px',
          animation: playing
            ? `bdslwave ${(0.85 + (i % 5) * 0.14).toFixed(2)}s ease-in-out ${((i * 0.038) % 0.48).toFixed(2)}s infinite alternate`
            : 'none',
          height: playing ? undefined : '5px',
        }} />
      ))}
      <style>{`@keyframes bdslwave{from{height:5px}to{height:32px}}`}</style>
    </div>
  )
}

// ─── Sign card ────────────────────────────────────────────────────────────────
function makeRigHand(material: THREE.Material) {
  const hand = new THREE.Group()
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 16), material)
  palm.scale.set(1, 1.18, 0.34)
  palm.castShadow = true
  hand.add(palm)
  const fingers: THREE.Group[] = []
  for (let i = 0; i < 4; i++) {
    const finger = new THREE.Group()
    finger.position.set(-0.15 + i * 0.1, 0.22, 0.02)
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.027, 0.22 + (i === 1 ? 0.06 : 0), 8, 10), material)
    lower.position.y = 0.12
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.024, 0.18 + (i === 1 ? 0.04 : 0), 8, 10), material)
    upper.position.y = 0.34
    finger.add(lower, upper)
    hand.add(finger)
    fingers.push(finger)
  }
  const thumb = new THREE.Group()
  thumb.position.set(-0.23, -0.02, 0.04)
  const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.032, 0.28, 8, 10), material)
  thumbMesh.position.y = 0.12
  thumb.add(thumbMesh)
  hand.add(thumb)
  hand.userData.fingers = fingers
  hand.userData.thumb = thumb
  return hand
}

function applyRigHandShape(hand: THREE.Group, shape: HandVariant) {
  const fingers = hand.userData.fingers as THREE.Group[] | undefined
  const thumb = hand.userData.thumb as THREE.Group | undefined
  if (!fingers) return
  fingers.forEach((finger, i) => {
    const isPoint = shape === 'point' && i === 1
    const isPeace = shape === 'peace' && (i === 1 || i === 2)
    const curl = shape === 'fist' ? 1.35 : shape === 'thumb' ? 1.25 : isPoint || isPeace || shape === 'flat' || shape === 'open' ? 0.05 : 1.1
    finger.rotation.x = curl
    finger.rotation.z = degToRad((i - 1.5) * (shape === 'open' ? -8 : 3))
    finger.scale.y = isPoint || isPeace ? 1.12 : shape === 'fist' || shape === 'thumb' ? 0.84 : 1
  })
  if (thumb) {
    thumb.rotation.z = shape === 'thumb' ? degToRad(-72) : shape === 'fist' ? degToRad(-12) : degToRad(-42)
    thumb.rotation.x = shape === 'fist' ? degToRad(42) : 0
  }
}

function ThreeSignRig({ token, fallbackShape, accent, playing }: {
  token: SignToken
  fallbackShape: HandVariant
  accent: string
  playing: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const motionRef = useRef<BdslRigMotion>(DEFAULT_BDSL_MOTIONS[fallbackShape])

  useEffect(() => {
    motionRef.current = DEFAULT_BDSL_MOTIONS[fallbackShape]
    const url = sigmlUrlForEntry(token)
    if (!url || !token.known) return
    let cancelled = false
    fetch(url)
      .then((res) => (res.ok ? res.text() : null))
      .then((xml) => {
        if (!cancelled && xml) motionRef.current = parseIsharaKothaSigml(xml, fallbackShape)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [fallbackShape, token])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100)
    camera.position.set(0, 1.02, 4.25)
    camera.lookAt(0, 0.98, 0.1)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    host.appendChild(renderer.domElement)
    const skin = new THREE.MeshStandardMaterial({ color: 0xe07b5d, roughness: 0.48, metalness: 0.02 })
    const leftHand = makeRigHand(skin)
    const rightHand = makeRigHand(skin)
    leftHand.scale.setScalar(1.28)
    rightHand.scale.setScalar(1.28)
    scene.add(leftHand, rightHand)

    const key = new THREE.DirectionalLight(0xffffff, 2.5)
    key.position.set(2.6, 3.6, 4.2)
    key.castShadow = true
    scene.add(key)
    scene.add(new THREE.HemisphereLight(0xfff5ef, 0xdbe7ff, 1.55))
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 0.55)
    rim.position.set(-2, 2, 2.4)
    scene.add(rim)
    const resize = () => {
      const rect = host.getBoundingClientRect()
      renderer.setSize(Math.max(1, rect.width), Math.max(1, rect.height), false)
      camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height)
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    let raf = 0
    const animate = () => {
      const motion = motionRef.current
      const phase = playing ? (performance.now() % (1100 * motion.speed)) / (1100 * motion.speed) : 0
      const sampled = sampleBdslFrame(motion.frames, phase)
      leftHand.position.set(sampled.left[0] * 0.72, sampled.left[1] - 0.62, sampled.left[2] + 0.04)
      rightHand.position.set(sampled.right[0] * 0.72, sampled.right[1] - 0.62, sampled.right[2] + 0.04)
      leftHand.rotation.set(degToRad(sampled.leftRot[0]), degToRad(sampled.leftRot[1] - 18), degToRad(sampled.leftRot[2]))
      rightHand.rotation.set(degToRad(sampled.rightRot[0]), degToRad(sampled.rightRot[1] + 18), degToRad(sampled.rightRot[2]))
      applyRigHandShape(leftHand, motion.leftHand)
      applyRigHandShape(rightHand, motion.rightHand)
      renderer.render(scene, camera)
      raf = window.requestAnimationFrame(animate)
    }
    animate()
    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
      renderer.dispose()
      scene.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        mesh.geometry?.dispose()
      })
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [accent, playing])

  return <div ref={hostRef} style={{ width:'100%', height:'196px' }} aria-label="3D BdSL SiGML hand rig" />
}

function CwasaSignAvatar({ token, playing }: { token: SignToken; playing: boolean }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)
  const pendingUrlRef = useRef<string | null>(null)
  const [status, setStatus] = useState('Loading avatar...')
  const currentUrl = useMemo(() => sigmlUrlForEntry(token), [token])

  const playUrl = useCallback((url: string) => {
    const absoluteUrl = /^https?:\/\//i.test(url) ? url : `${window.location.origin}${url}`
    const host = hostRef.current
    if (host) {
      const input = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '.CWASASiGMLURL input, .CWASASiGMLURL textarea',
      )

      if (input) {
        input.value = absoluteUrl
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))

        const controls = Array.from(host.querySelectorAll<HTMLElement>('.CWASAPlay button, .CWASAPlay input, .CWASAPlay a, .CWASAPlay [role="button"], .CWASAPlay *'))
        const playButton = controls.find((button) => {
          const value = button instanceof HTMLInputElement ? button.value : ''
          const title = button.getAttribute('title') ?? button.getAttribute('aria-label') ?? ''
          const label = `${button.textContent ?? ''} ${value} ${title}`.toLowerCase()
          return label.includes('play') || label.includes('sign')
        }) ?? controls.find((button) => typeof button.click === 'function')

        if (playButton) {
          playButton.click()
          setStatus('Playing IsharaKotha SiGML')
          return
        }

        setStatus('CWASA play button not ready')
        return
      }

      setStatus('CWASA URL field not ready')
      return
    }

    try {
      window.CWASA?.playSiGMLURL?.(absoluteUrl)
      setStatus('Playing IsharaKotha SiGML')
    } catch {
      try {
        window.CWASA?.playSiGMLURL?.(0, absoluteUrl)
        setStatus('Playing IsharaKotha SiGML')
      } catch {
        setStatus('Playback failed')
      }
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ensureCwasaLoaded()
      .then(() => {
        if (cancelled || initializedRef.current) return
        window.CWASA?.init?.()
        initializedRef.current = true
        setStatus('Avatar ready')
        if (pendingUrlRef.current) {
          window.setTimeout(() => {
            if (!cancelled && pendingUrlRef.current) {
              playUrl(pendingUrlRef.current)
              pendingUrlRef.current = null
            }
          }, 700)
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('CWASA could not load')
      })

    return () => { cancelled = true }
  }, [playUrl])

  useEffect(() => {
    if (!token.known || !currentUrl) {
      setStatus('No sign found')
      return
    }
    if (!initializedRef.current) {
      pendingUrlRef.current = currentUrl
      return
    }
    if (!playing) return

    const timer = window.setTimeout(() => playUrl(currentUrl), 400)
    return () => window.clearTimeout(timer)
  }, [currentUrl, token.known, playing, playUrl])

  useEffect(() => {
    if (!playing) window.CWASA?.stopSiGML?.(0)
  }, [playing])

  return (
    <div ref={hostRef} style={{ position:'relative', width:'100%', height:'340px', overflow:'hidden' }} aria-label="CWASA BdSL signing avatar">
      <div style={{ width:'100%', height:'306px', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
        <div className="CWASAAvatar av0" style={{ textAlign:'center' }} />
      </div>
      <div style={{ position:'absolute', left:'-9999px', top:'0', width:'360px', height:'1px', overflow:'hidden' }}>
        <span className="CWASAAvMenu av0" />
        <span className="CWASAAmbBox av0" />
        <span className="CWASASpeed av0" />
        <div className="CWASASiGMLURL av0" />
        <div className="CWASASiGMLText av0" />
        <div className="CWASAPlay av0" />
        <span className="CWASAPlayExtra av0" />
        <span className="CWASAFrames av0" />
        <div className="CWASAProgress av0" />
        <div className="CWASAStatus av0" />
        <div className="SToCA" style={{ textAlign:'center' }} />
      </div>
      <div style={{ position:'absolute', left:'10px', right:'10px', bottom:'2px', textAlign:'center', fontSize:'11px', color:'var(--color-text-tertiary)' }}>
        {status}
      </div>
    </div>
  )
}

function SignCard({ token, index, playing }: { token: SignToken; index: number; playing: boolean }) {
  const col = getColor(token.category)
  return (
    <motion.div
      key={token.gloss + index}
      initial={{ opacity: 0, scale: 0.93, y: 14 }}
      animate={{ opacity: 1, scale: 1,    y: 0  }}
      exit={{    opacity: 0, scale: 0.88, y: -12 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: col.bg,
        border: `2px solid ${col.dot}`,
        borderRadius: '16px',
        padding: '18px 20px 14px',
        display: 'flex', flexDirection: 'column', gap: '10px',
        width: '100%', boxSizing: 'border-box',
      }}
    >
      {/* Waveform */}
      <SignWaveform color={col.dot} playing={playing} />

      {/* Label */}
      <div>
        <div style={{ fontSize:'20px', fontWeight:500, color:col.text, letterSpacing:'-0.02em', lineHeight:1.2, marginBottom:'3px' }}>
          {token.gloss}
        </div>
        {token.word && token.word.toLowerCase() !== token.gloss.toLowerCase() && (
          <div style={{ fontSize:'12px', color:col.text, lineHeight:1.25, marginBottom:'3px' }}>
            Matched word: <span style={{ fontWeight:500 }}>{token.word}</span>
          </div>
        )}
        {token.english !== token.gloss && (
          <div style={{ fontSize:'12px', color:col.dot, fontStyle:'italic' }}>{token.english}</div>
        )}
      </div>

      {/* Badges */}
      <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
        <span style={{ fontSize:'10px', fontWeight:500, background:`${col.dot}22`, color:col.text, padding:'3px 7px', borderRadius:'5px' }}>
          {token.category}
        </span>
        <span style={{ fontSize:'10px', fontWeight:500, background:`${col.dot}11`, color:col.text, padding:'3px 7px', borderRadius:'5px' }}>
          {token.known ? 'lexical' : 'fingerspell'}
        </span>
      </div>
    </motion.div>
  )
}

// ─── Token pills ──────────────────────────────────────────────────────────────
function TokenStrip({ tokens, activeIndex, onSelect }: {
  tokens: SignToken[]; activeIndex: number; onSelect: (i: number) => void
}) {
  return (
    <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', paddingTop:'4px' }}>
      {tokens.map((t, i) => {
        const c = getColor(t.category)
        const active = i === activeIndex
        return (
          <button key={i} onClick={() => onSelect(i)} style={{
            fontSize:'12px', fontWeight: active ? 500 : 400,
            padding:'4px 11px', borderRadius:'20px', cursor:'pointer',
            border: active ? `1.5px solid ${c.dot}` : '0.5px solid var(--color-border-tertiary)',
            background: active ? c.bg : 'transparent',
            color: active ? c.text : 'var(--color-text-secondary)',
            transition:'all 0.15s',
            display:'inline-flex', flexDirection:'column', alignItems:'center', gap:'1px',
            lineHeight:1.1, minHeight:'28px',
          }}>
            <span>{t.word}</span>
            {t.known && t.word.toLowerCase() !== t.gloss.toLowerCase() && (
              <span style={{ fontSize:'10px', opacity:0.75 }}>{t.gloss}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0
  return (
    <div style={{ height:'3px', background:'var(--color-border-tertiary)', borderRadius:'2px', overflow:'hidden', width:'100%' }}>
      <motion.div animate={{ width:`${pct}%` }} transition={{ duration:0.3, ease:'easeOut' }}
        style={{ height:'100%', background:color, borderRadius:'2px' }} />
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BdslAvatar({ active, text }: Props) {
  const [entries, setEntries]   = useState<DatasetEntry[]>(SEED)
  const [loadState, setLoadState] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [loadError, setLoadError] = useState<string|null>(null)
  const [playing, setPlaying]   = useState(true)
  const [activeIndex, setActiveIndex] = useState(0)
  const [llmTranslations, setLlmTranslations] = useState<LlmTranslations>({})
  const [resolvingSigns, setResolvingSigns] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null)

  // Load full dataset
  useEffect(() => {
    if (!active || loadState !== 'idle') return
    setLoadState('loading')
    loadDataset()
      .then((data) => {
        const seen = new Set<string>()
        const merged = [...data, ...SEED].filter((entry) => {
          const key = `${norm(entry.english)}:${norm(entry.gloss)}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setEntries(merged)
        setLoadState('done')
      })
      .catch((err) => { setLoadError(String(err)); setLoadState('error') })
  }, [active, loadState])

  const idx = useMemo(() => buildIndex(entries), [entries])

  // Re-tokenise whenever text OR the index changes
  const rawTokens = useMemo(() => {
    if (!text?.trim()) return []
    return tokeniseText(text, idx, llmTranslations)
  }, [text, idx, llmTranslations])
  const tokens = useMemo(() => {
    const playable = rawTokens.filter((token) => token.known && token.sigmlPath && token.datasetRoot)
    return playable.length > 0 ? playable : rawTokens
  }, [rawTokens])
  const preparing = resolvingSigns || loadState === 'loading'

  // Reset playhead when sentence changes
  useEffect(() => {
    setActiveIndex(0)
    setPlaying(false)
    setLlmTranslations({})
    setResolvingSigns(!!text?.trim())
  }, [text])

  // Resolve the whole sign sequence first, then allow playback.
  useEffect(() => {
    if (!active || !text?.trim()) {
      setResolvingSigns(false)
      return
    }
    if (loadState === 'loading' || loadState === 'idle') {
      setResolvingSigns(true)
      return
    }

    const localTokens = tokeniseText(text, idx)
    const unknownWords = localTokens
      .filter((token) => !token.known)
      .map((token) => token.word)
      .filter((word, index, list) => list.indexOf(word) === index)
      .slice(0, 8)

    if (unknownWords.length === 0) {
      setResolvingSigns(false)
      setPlaying(true)
      return
    }

    let cancelled = false
    setResolvingSigns(true)
    fetch('/api/bdsl-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: unknownWords, context: text }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((payload) => {
        if (cancelled || !payload || !Array.isArray(payload.translations)) return
        setLlmTranslations((prev) => {
          const next = { ...prev }
          for (const word of unknownWords) {
            const key = norm(word)
            if (key && !next[key]) next[key] = []
          }
          for (const item of payload.translations) {
            if (!item || typeof item.word !== 'string' || !Array.isArray(item.candidates)) continue
            const key = norm(item.word)
            const candidates = item.candidates.filter((candidate: unknown): candidate is string => typeof candidate === 'string')
            if (key && candidates.length > 0) next[key] = candidates
          }
          return next
        })
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) {
          setResolvingSigns(false)
          setPlaying(true)
        }
      })

    return () => { cancelled = true }
  }, [active, idx, loadState, text])

  // Auto-advance through tokens
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (preparing || !playing || tokens.length <= 1) return
    intervalRef.current = setInterval(() => {
      setActiveIndex((i) => (i + 1) % tokens.length)
    }, 6500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, preparing, tokens.length])

  useEffect(() => {
    if (activeIndex >= tokens.length) setActiveIndex(0)
  }, [activeIndex, tokens.length])

  const handleSelect  = useCallback((i: number) => { setActiveIndex(i); setPlaying(false) }, [])
  const togglePlay    = useCallback(() => setPlaying((p) => !p), [])
  const restart       = useCallback(() => { setActiveIndex(0); setPlaying(true) }, [])

  if (!active) return null

  const current      = tokens[activeIndex]
  const currentColor = current ? getColor(current.category) : getColor('Unknown')
  const knownCount   = tokens.filter((t) => t.known).length

  return (
    <div style={{ fontFamily:'var(--font-sans)', width:'100%' }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px', flexWrap:'wrap', gap:'8px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <span style={{ fontSize:'13px', fontWeight:500, color:'var(--color-text-primary)' }}>BdSL Finger Signs</span>
          <span style={{ fontSize:'11px', color:'var(--color-text-secondary)', background:'var(--color-background-secondary)', padding:'2px 8px', borderRadius:'10px' }}>
            {loadState === 'done' ? `${entries.length} signs` : loadState === 'loading' ? 'Loading…' : `${SEED.length} seed signs`}
          </span>
          {tokens.length > 0 && (
            <span style={{ fontSize:'11px', color:'var(--color-text-secondary)', background:'var(--color-background-secondary)', padding:'2px 8px', borderRadius:'10px' }}>
              {preparing ? 'Preparing signs' : `${knownCount}/${tokens.length} matched`}
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:'6px' }}>
          <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} disabled={preparing}
            style={{ width:'32px', height:'32px', borderRadius:'8px', border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-primary)', cursor:preparing ? 'not-allowed' : 'pointer', opacity:preparing ? 0.55 : 1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', color:'var(--color-text-primary)' }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={restart} aria-label="Restart" disabled={preparing}
            style={{ width:'32px', height:'32px', borderRadius:'8px', border:'0.5px solid var(--color-border-secondary)', background:'var(--color-background-primary)', cursor:preparing ? 'not-allowed' : 'pointer', opacity:preparing ? 0.55 : 1, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', color:'var(--color-text-primary)' }}>
            ↺
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      {loadError && (
        <div style={{ marginBottom:'10px', padding:'8px 12px', borderRadius:'8px', background:'var(--color-background-warning)', color:'var(--color-text-warning)', fontSize:'12px', border:'0.5px solid var(--color-border-warning)' }}>
          ⚠ {loadError} — using seed signs
        </div>
      )}

      {/* ── Main body ── */}
      {!preparing && tokens.length > 0 && current ? (
        <div style={{ display:'grid', gridTemplateColumns:'190px 1fr', gap:'16px', alignItems:'start' }}>

          {/* Left: persistent CWASA canvas + animated sign metadata */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ height:'340px', overflow:'hidden', borderRadius:'12px', background:`linear-gradient(180deg, ${currentColor.bg} 0%, rgba(255,255,255,0.45) 100%)`, border:`2px solid ${currentColor.dot}` }}>
              <CwasaSignAvatar token={current} playing={playing} />
            </div>
            <AnimatePresence mode="wait">
              <SignCard key={`${current.gloss}-${activeIndex}`} token={current} index={activeIndex} playing={playing} />
            </AnimatePresence>
          </div>

          {/* Right: info + strip */}
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

            {/* Info panel */}
            <div style={{ background:'var(--color-background-secondary)', borderRadius:'12px', padding:'16px' }}>
              <div style={{ fontSize:'10px', fontWeight:500, color:'var(--color-text-tertiary)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:'10px' }}>
                IsharaKotha · {activeIndex + 1} of {tokens.length}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={`info-${activeIndex}`}
                  initial={{ opacity:0, x:8 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-8 }}
                  transition={{ duration:0.18 }}>
                  <div style={{ fontSize:'26px', fontWeight:500, color:'var(--color-text-primary)', letterSpacing:'-0.03em', lineHeight:1.1, marginBottom:'5px' }}>
                    {current.gloss}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--color-text-secondary)', marginBottom:'6px' }}>
                    Matched word: <span style={{ fontWeight:500, color:'var(--color-text-primary)' }}>{current.word}</span>
                  </div>
                  <div style={{ fontSize:'13px', color:'var(--color-text-secondary)', marginBottom:'12px' }}>
                    {current.category}{current.english !== current.gloss ? ` · ${current.english}` : ''}
                  </div>
                  <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                    <span style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'6px', fontWeight:500,
                      background: current.known ? currentColor.bg : 'var(--color-background-warning)',
                      color:      current.known ? currentColor.text : 'var(--color-text-warning)' }}>
                      {current.known ? 'lexical sign' : 'fingerspell'}
                    </span>
                    {current.sigmlPath && (
                      <span style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'6px', background:'var(--color-background-primary)', color:'var(--color-text-tertiary)', border:'0.5px solid var(--color-border-tertiary)' }}>
                        SiGML: {current.sigmlPath}
                      </span>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Progress */}
            <ProgressBar current={activeIndex} total={tokens.length} color={currentColor.dot} />

            {/* Token pills */}
            <TokenStrip tokens={tokens} activeIndex={activeIndex} onSelect={handleSelect} />
          </div>
        </div>

      ) : (
        <div style={{ padding:'32px', textAlign:'center', color:'var(--color-text-tertiary)', fontSize:'14px', background:'var(--color-background-secondary)', borderRadius:'12px' }}>
          {loadState === 'loading'
            ? 'Loading IsharaKotha dataset…'
            : resolvingSigns
              ? 'Preparing all BdSL signs…'
              : !text?.trim()
                ? 'Waiting for text…'
                : 'Processing…'}
        </div>
      )}
    </div>
  )
}
