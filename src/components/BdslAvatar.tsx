'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import * as THREE from 'three'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  active: boolean
  text: string
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

// ─── Hand shape types ─────────────────────────────────────────────────────────
type HandVariant = 'open' | 'point' | 'fist' | 'flat' | 'peace' | 'thumb'

const ALL_SHAPES: HandVariant[] = ['open', 'point', 'flat', 'peace', 'fist', 'thumb']
function stableShapeSeed(value: string) {
  let hash = 0
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  return hash
}
function handFor(token: SignToken, i: number): HandVariant {
  return ALL_SHAPES[stableShapeSeed(token.gloss || token.word) % ALL_SHAPES.length]
}

// ─── Text cleaning ────────────────────────────────────────────────────────────
function cleanLLMText(raw: string): string {
  return raw
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/#{1,6}\s*/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[^\u0980-\u09FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Normalisation ────────────────────────────────────────────────────────────
const norm = (s: string) =>
  s.normalize('NFC').toLowerCase().replace(/[^\u0980-\u09FFa-z0-9]/g, '')

const MOJIBAKE_RE = /aª|aº|Â|Ã|à¦|à§/

function looksMojibake(value: string) {
  return MOJIBAKE_RE.test(value)
}

function cleanDatasetLabel(value: string) {
  const trimmed = value.trim()
  const underscoreLabel = trimmed.match(/_([^_]+)$/)?.[1]
  const parenLabel = trimmed.match(/\(([^()]+)\)\s*$/)?.[1]
  return (underscoreLabel || parenLabel || trimmed).trim()
}

function cleanEntry(entry: DatasetEntry): DatasetEntry {
  const cleanEnglish = cleanDatasetLabel(entry.english || entry.gloss)
  const cleanGloss = cleanDatasetLabel(entry.gloss || entry.english)
  const english = cleanEnglish || cleanGloss || entry.english
  const gloss = looksMojibake(cleanGloss) ? english : cleanGloss || english

  return {
    ...entry,
    gloss,
    english,
  }
}

// ─── Stop words ───────────────────────────────────────────────────────────────
// Keep this minimal — better to attempt a lookup and miss than skip a content word
const STOP_WORDS = new Set([
  'the','a','an','is','are','was','were','be','been','being',
  'have','has','had','do','does','did','will','would','could',
  'should','may','might','shall','can','need','ought',
  'and','or','but','so','yet','for','nor',
  'in','on','at','by','to','of','up','as','into','onto','upon',
  'i','you','he','she','it','we','they','me','him','her','us','them',
  'my','your','his','its','our','their',
  'this','that','these','those',
  'not','no','very','just','also','only','even','still',
  'then','when','where','which','who','whom','whose','how','why',
  'if','because','since','while','although','though','unless',
  'after','before','during','about','above','below','between',
  'from','with','without','through','across','against','among',
])

// Bengali function words — keep content words out of this list
const BN_STOP = new Set([
  'হলো','হল','হয়','হওয়া','হওয়ার','হয়ে','হয়েছে',
  'ও','এবং','আর','বা','কিন্তু','তাই','যে','যা','যখন','তখন',
  'একটি','একটা','এই','ওই','তার','তাদের','আমাদের','এর',
  'থেকে','দিয়ে','জন্য','সাথে','কারণ','কারণে','না','আছে',
  'হবে','হলে','হলো','এটি','এটা','ওটা','ওটি','তখন','যখন',
  'করে','করা','করার','করেছে','করেছিল','এবং','অথবা',
])

const BN_STOP_OVERRIDES = new Set([
  '\u09B9\u0993\u09AF\u09BC\u09BE\u0995\u09C7', // হওয়াকে
  '\u09B9\u0993\u09DF\u09BE\u0995\u09C7',       // হওয়াকে
  '\u09AC\u09B2\u09C7',                         // বলে
  '\u098F\u0995\u099F\u09BF',                   // একটি
  '\u098F\u0995\u099F\u09BE',                   // একটা
])

const isStopWord = (word: string) => {
  const lower = word.toLowerCase()
  const n = norm(word)
  return STOP_WORDS.has(lower) || BN_STOP.has(word.trim()) || BN_STOP.has(n) || BN_STOP_OVERRIDES.has(word.trim()) || BN_STOP_OVERRIDES.has(n)
}

// ─── Bengali → English mapping (expanded) ────────────────────────────────────
// This is the primary bridge between Bengali tutor text and English dataset keys.
// Keys use NFC-normalised forms; values are dataset English glosses.
const BN_TO_EN: Record<string, string> = {
  // Nature & Water cycle
  'বৃষ্টি':'Rain','বৃষ্টিপাত':'Rain','বৃষ্টিপাতের':'Rain',
  'সমুদ্র':'Sea','সাগর':'Sea','সাগরের':'Sea',
  'নদী':'River','নদ':'River','নদীর':'River',
  'সূর্য':'Sun','সূর্যের':'Sun','সূর্যতাপে':'Sun','সূর্যতাপ':'Sun',
  'পানি':'Water','জল':'Water','জলের':'Water','পানির':'Water',
  'বায়ু':'Air','বাতাস':'Air','বাতাসের':'Air',
  'মেঘ':'Cloud','মেঘের':'Cloud','মেঘে':'Cloud',
  'আকাশ':'Sky','আকাশের':'Sky',
  'মাটি':'Soil','মাটির':'Soil','জমি':'Land','জমির':'Land',
  'পাহাড়':'Mountain','পর্বত':'Mountain','পর্বতের':'Mountain',
  'গাছ':'Tree','গাছের':'Tree','গাছে':'Tree',
  'ফুল':'Flower','ফুলের':'Flower',
  'ফল':'Fruit','ফলের':'Fruit','ফলমূল':'Fruit',
  'বাষ্প':'Steam','বাষ্পের':'Steam','বাষ্পীয়':'Steam',
  'তাপ':'Heat','তাপে':'Heat','তাপের':'Heat','উত্তাপ':'Heat',
  'পুকুর':'Pond','পুকুরের':'Pond','পুকুরে':'Pond',
  'নালা':'Canal','খাল':'Canal','খালের':'Canal',
  'বিল':'Pond','হাওর':'Lake','লেক':'Lake',
  'আলো':'Light','আলোর':'Light',
  'অন্ধকার':'Dark',
  'আগুন':'Fire','আগুনের':'Fire',
  'বায়ুমণ্ডল':'Air','বায়ুমণ্ডলে':'Air','বায়ুমণ্ডলের':'Air',
  'বাষ্পীভূত':'Evaporate','বাষ্পীভবন':'Evaporate',
  'জলচক্র':'Water','চক্র':'Cycle',
  'উপর':'Up','উপরে':'Up','উপরের':'Up',
  'দিক':'Direction','দিকে':'Direction',
  'আকার':'Shape','আকারে':'Shape',
  'প্রক্রিয়া':'Process','প্রক্রিয়ায়':'Process','প্রক্রিয়াটি':'Process',
  'ধারাবাহিক':'Continuous','ক্রমাগত':'Continuous','ক্রমান্বয়ে':'Continuous',
  'শক্তি':'Power','শক্তির':'Power',
  'বাতাসের':'Air',
  // Animals
  'মাছ':'Fish','পাখি':'Bird','কুকুর':'Dog','বিড়াল':'Cat',
  'গরু':'Cow','ছাগল':'Goat','ঘোড়া':'Horse','হাতি':'Elephant',
  'বাঘ':'Tiger','সিংহ':'Lion','সাপ':'Snake','ব্যাঙ':'Frog',
  'হাঁস':'Duck','মুরগি':'Hen','গরুর':'Cow','ছাগলের':'Goat',
  'প্রাণী':'Animal','পশু':'Animal','পশুপাখি':'Animal',
  // Family
  'মা':'Mother','বাবা':'Father','ভাই':'Brother','বোন':'Sister',
  'ছেলে':'Son','মেয়ে':'Daughter','বন্ধু':'Friend',
  'মানুষ':'Human','মানুষের':'Human','লোক':'Human',
  'পরিবার':'Family','পরিবারের':'Family',
  'দাদা':'Grandfather','দাদি':'Grandmother','নানা':'Grandfather','নানি':'Grandmother',
  'চাচা':'Uncle','মামা':'Uncle','খালা':'Aunt','চাচি':'Aunt',
  // Food & Drink
  'ভাত':'Rice','রুটি':'Bread','দুধ':'Milk','ডিম':'Egg',
  'মাংস':'Meat','সবজি':'Vegetable','চা':'Tea',
  'চিনি':'Sugar','লবণ':'Salt','তেল':'Oil',
  'ফলমূল':'Fruit','শাকসবজি':'Vegetable',
  'খাবার':'Food','খাদ্য':'Food','পানীয়':'Drink',
  // Body Parts
  'হাত':'Hand','পা':'Leg','মাথা':'Head','চোখ':'Eye',
  'কান':'Ear','নাক':'Nose','মুখ':'Mouth','দাঁত':'Teeth',
  'হৃদয':'Heart','হৃদয়':'Heart','রক্ত':'Blood',
  'পেট':'Stomach','বুক':'Chest','পিঠ':'Back',
  'আঙুল':'Finger','বুড়ো':'Thumb','কাঁধ':'Shoulder',
  // Actions / Verbs
  'খাওয়া':'Eat','খায়':'Eat','খাই':'Eat',
  'পান':'Drink','পান করা':'Drink','পান করে':'Drink',
  'ঘুম':'Sleep','ঘুমানো':'Sleep','ঘুমায়':'Sleep',
  'হাঁটা':'Walk','দৌড়':'Run','বসা':'Sit',
  'দাঁড়ানো':'Stand','লেখা':'Write','পড়া':'Read',
  'দেখা':'See','শোনা':'Hear','বলা':'Say',
  'আসা':'Come','যাওয়া':'Go','নেওয়া':'Take','দেওয়া':'Give',
  'করা':'Do','কাজ':'Work','রান্না':'Cook','শেখা':'Learn',
  'জানা':'Know','বোঝা':'Understand','বুঝা':'Understand',
  'কাঁদা':'Cry','হাসা':'Laugh','খেলা':'Play',
  'ভাবা':'Think','মনে':'Think',
  'শেখানো':'Teach','পড়ানো':'Teach',
  'শুরু':'Start','শেষ':'End','থামা':'Stop',
  // Places
  'বাড়ি':'Home','বাসা':'Home','ঘর':'Home',
  'স্কুল':'School','কলেজ':'College','বিশ্ববিদ্যালয়':'University',
  'হাসপাতাল':'Hospital','বাজার':'Market','দোকান':'Shop',
  'রাস্তা':'Road','শহর':'City','গ্রাম':'Village',
  'দেশ':'Country','বাংলাদেশ':'Bangladesh','ঢাকা':'Dhaka',
  'মসজিদ':'Mosque','মন্দির':'Temple','চার্চ':'Church',
  'মাঠ':'Field','পার্ক':'Park','বন':'Forest',
  // Adjectives / Qualities
  'ভালো':'Good','ভাল':'Good','খারাপ':'Bad',
  'বড়':'Big','ছোট':'Small',
  'গরম':'Hot','ঠান্ডা':'Cold','নতুন':'New','পুরানো':'Old',
  'সুন্দর':'Beautiful','কালো':'Black','সাদা':'White',
  'লাল':'Red','সবুজ':'Green','নীল':'Blue','হলুদ':'Yellow',
  'সহজ':'Easy','কঠিন':'Difficult','দ্রুত':'Fast','ধীর':'Slow',
  'শক্ত':'Strong','দুর্বল':'Weak','উচ্চ':'High','নিচু':'Low',
  // Numbers
  'এক':'One','দুই':'Two','তিন':'Three','চার':'Four',
  'পাঁচ':'Five','ছয়':'Six','সাত':'Seven',
  'আট':'Eight','নয়':'Nine','দশ':'Ten',
  'শত':'Hundred','হাজার':'Thousand',
  // Time
  'সময়':'Time','দিন':'Day','রাত':'Night','সকাল':'Morning',
  'বিকাল':'Afternoon','সন্ধ্যা':'Evening','বছর':'Year',
  'মাস':'Month','সপ্তাহ':'Week','আজ':'Today',
  'কাল':'Tomorrow','গতকাল':'Yesterday',
  // Education / Profession
  'বই':'Book','কলম':'Pen','কাগজ':'Paper',
  'শিক্ষক':'Teacher','ছাত্র':'Student','ছাত্রী':'Student',
  'ডাক্তার':'Doctor','ওষুধ':'Medicine','নার্স':'Nurse',
  'পুলিশ':'Police','সৈনিক':'Soldier',
  'কৃষক':'Farmer','ব্যবসায়ী':'Businessman',
  // Misc
  'টাকা':'Money','নাম':'Name','বয়স':'Age',
  'জীবন':'Life','সমাজ':'Society','জগৎ':'World','পৃথিবী':'Earth',
  'খবর':'News','তথ্য':'Information',
  'প্রশ্ন':'Question','উত্তর':'Answer',
  'সাহায্য':'Help','ধন্যবাদ':'Thank','স্বাগতম':'Hello','নমস্কার':'Hello',
  'বিপদ':'Danger','নিরাপদ':'Safe',
  'সত্য':'True','মিথ্যা':'False',
  'ভালোবাসা':'Love','ঘৃণা':'Hate',
  'আনন্দ':'Happy','দুঃখ':'Sad','রাগ':'Angry',
  'ভয়':'Fear','আশা':'Hope',
  'স্বাস্থ্য':'Health','রোগ':'Disease','অসুস্থ':'Sick',
}

const BN_TO_EN_OVERRIDES: Record<string, string> = {
  '\u09AC\u09B0\u09AB': 'Ice',
  '\u09AC\u09B0\u09AB\u09C7': 'Ice',
  '\u09AC\u09B0\u09AB\u09C7\u09B0': 'Ice',
  '\u09A4\u09C8\u09B0\u09BF': 'Create',
  '\u09A4\u09C8\u09B0\u09C0': 'Create',
  '\u09A4\u09C8\u09B0\u09BF\u09B0': 'Create',
  '\u09B9\u09BF\u09AE\u09BE\u0999\u09CD\u0995': 'Deep Freeze',
  '\u09B9\u09BF\u09AE\u09BE\u0999\u09CD\u0995\u09C7': 'Deep Freeze',
  '\u09AB\u09CD\u09B0\u09BF\u099C\u09C7': 'Deep Freeze',
  '\u09AB\u09CD\u09B0\u09BF\u099C': 'Deep Freeze',
  '\u09A4\u09B0\u09B2': 'Liquid',
  '\u09A4\u09B0\u09B2\u09C7': 'Liquid',
  '\u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8': 'change',
  '\u09AA\u09B0\u09BF\u09AC\u09B0\u09CD\u09A4\u09A8\u09C7': 'change',
  '\u09A4\u09BE\u09AA': 'Hot',
  '\u09A4\u09BE\u09AA\u09C7': 'Hot',
  '\u09A4\u09BE\u09AA\u09C7\u09B0': 'Hot',
  '\u09A4\u09BE\u09AA\u09AE\u09BE\u09A4\u09CD\u09B0\u09BE': 'Hot',
  '\u09A4\u09BE\u09AA\u09AE\u09BE\u09A4\u09CD\u09B0\u09BE\u09B0': 'Hot',
  '\u09A4\u09BE\u09AA\u09AE\u09BE\u09A4\u09CD\u09B0\u09BE\u09AF\u09BC': 'Hot',
  '\u09A4\u09BE\u09AA\u09AE\u09BE\u09A4\u09CD\u09B0\u09BE\u09DF': 'Hot',
  '\u09A8\u09C7\u0993\u09AF\u09BC\u09BE': 'Take',
  '\u09A8\u09C7\u0993\u09DF\u09BE': 'Take',
  '\u0995\u09AE\u09A4\u09C7': 'Less',
  '\u0995\u09AE\u09C7': 'Less',
  '\u09B6\u09C1\u09B0\u09C1': 'Start',
  '\u09A6\u09B6\u09BE': 'Condition',
  '\u09A6\u09B6\u09BE\u09AF\u09BC': 'Condition',
  '\u09A6\u09B6\u09BE\u09DF': 'Condition',
}

// Bengali suffix stripping (longest first for greedy match)
const BN_SUFFIXES = [
  'গুলোর','গুলিতে','গুলিকে','গুলির','গুলো','গুলি',
  'দের','ের','কে','তে','য়ে','য়','ে','টার','টির','টা','টি','র',
]

function stripBnSuffix(word: string): string {
  for (const sfx of BN_SUFFIXES) {
    if (word.endsWith(sfx) && word.length - sfx.length >= 2) {
      return word.slice(0, -sfx.length)
    }
  }
  return word
}

// ─── English suffix stripping ────────────────────────────────────────────────
const EN_SUFFIXES = [
  'tion','sion','ness','ment','ings','tion','ers','ies',
  'ing','ed','er','es','ly','al','ful','less','s','e',
]

function stripEnSuffix(n: string): string[] {
  const stems: string[] = []
  for (const sfx of EN_SUFFIXES) {
    if (n.length > sfx.length + 3 && n.endsWith(sfx)) {
      const stem = n.slice(0, -sfx.length)
      stems.push(stem)
      stems.push(stem + 'e')
      stems.push(stem + 'y')
      stems.push(stem + 'i')
    }
  }
  return [...new Set(stems)]
}

// ─── Dataset ──────────────────────────────────────────────────────────────────
const DATASET_URL = '/data/Sections/dataset.json'

async function loadDataset(): Promise<DatasetEntry[]> {
  const res = await fetch(DATASET_URL)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const raw = await res.json() as Record<string, string>[]
  return raw
    .filter((item) => !!item && typeof item === 'object')
    .map((item) => ({
      gloss:      item.gloss     ?? '',
      english:    item.english   ?? item.gloss ?? '',
      category:   item.sectionEn ?? item.category ?? 'Unknown',
      sigmlPath:  item.sigmlPath ?? '',
      datasetRoot: item.datasetRoot ?? item.root ?? item.folder ?? '',
    }))
    .map(cleanEntry)
    .filter((e) => e.english.trim() || e.gloss.trim())
}

// ─── SiGML URL builder ────────────────────────────────────────────────────────
// FIX: was previously imported from @/lib/bdsl/sigmlParser but never defined here.
// We now build the URL from the dataset entry directly.
function sigmlUrlForEntry(token: SignToken): string | null {
  if (!token.sigmlPath) return null

  // Absolute URL — use as-is
  if (/^https?:\/\//i.test(token.sigmlPath)) return token.sigmlPath

  const rootBase = DATASET_URL.replace('/dataset.json', '')

  // Normalise Windows-style paths
  const cleanPath = token.sigmlPath.replace(/\\/g, '/')

  if (token.datasetRoot) {
    // Try to avoid double-encoding: build path segments individually
    const rootSegment = encodeURIComponent(token.datasetRoot)
    const fileSegment = cleanPath.split('/').map(encodeURIComponent).join('/')
    return `${rootBase}/${rootSegment}/${fileSegment}`
  }

  // No datasetRoot — try direct path relative to dataset base
  const fileSegment = cleanPath.split('/').map(encodeURIComponent).join('/')
  return `${rootBase}/${fileSegment}`
}

// ─── Index building ───────────────────────────────────────────────────────────
function buildIndex(entries: DatasetEntry[]): Map<string, DatasetEntry> {
  const idx = new Map<string, DatasetEntry>()

  const setIndex = (key: string, entry: DatasetEntry) => {
    const n = norm(key)
    if (!n) return

    const clean = cleanEntry(entry)
    const current = idx.get(n)
    if (!current) {
      idx.set(n, clean)
      return
    }

    const currentIsMojibake = looksMojibake(`${current.gloss} ${current.english}`)
    const nextIsMojibake = looksMojibake(`${clean.gloss} ${clean.english}`)
    if (currentIsMojibake && !nextIsMojibake) idx.set(n, clean)
  }

  for (const e of entries) {
    const clean = cleanEntry(e)
    setIndex(e.english, clean)
    setIndex(e.gloss, clean)
    setIndex(clean.english, clean)
    setIndex(clean.gloss, clean)

    /*
    // Index by english gloss (primary key)
    if (e.english) idx.set(norm(e.english), e)
    // Index by gloss field (may differ from english)
    if (e.gloss && e.gloss !== e.english) idx.set(norm(e.gloss), e)

    // Also index individual words in multi-word glosses
    // e.g. "Water Cycle" → also index "cycle" separately
    const words = (e.english || e.gloss).split(/\s+/)
    if (words.length > 1) {
      for (const w of words) {
        const nw = norm(w)
        if (nw.length > 2 && !idx.has(nw)) idx.set(nw, e)
      }
    }
    */
  }

  return idx
}

// ─── Word lookup with aggressive fallback chain ───────────────────────────────
function lookupWord(
  idx: Map<string, DatasetEntry>,
  word: string,
  llmTranslations: LlmTranslations = {},
): DatasetEntry | null {
  const n = norm(word)
  if (!n || n.length < 2) return null

  // 1. Direct normalised match
  if (idx.has(n)) return idx.get(n)!

  // 2. English suffix stripping
  for (const stem of stripEnSuffix(n)) {
    if (idx.has(stem)) return idx.get(stem)!
  }

  // 3. Bengali → English direct lookup
  const directBn = BN_TO_EN_OVERRIDES[word.trim()] ?? BN_TO_EN_OVERRIDES[norm(word)] ?? BN_TO_EN[word.trim()] ?? BN_TO_EN[norm(word)]
  if (directBn) {
    const e = idx.get(norm(directBn))
    if (e) return e
    // Also try stem of the translation
    for (const stem of stripEnSuffix(norm(directBn))) {
      if (idx.has(stem)) return idx.get(stem)!
    }
  }

  // 4. Bengali suffix stripping → lookup
  const stripped = stripBnSuffix(word.trim())
  if (stripped !== word.trim()) {
    const strippedBn = BN_TO_EN_OVERRIDES[stripped] ?? BN_TO_EN_OVERRIDES[norm(stripped)] ?? BN_TO_EN[stripped] ?? BN_TO_EN[norm(stripped)]
    if (strippedBn) {
      const e = idx.get(norm(strippedBn))
      if (e) return e
    }
    // Also try direct index lookup on stripped Bengali
    const strippedN = norm(stripped)
    if (idx.has(strippedN)) return idx.get(strippedN)!
    for (const stem of stripEnSuffix(strippedN)) {
      if (idx.has(stem)) return idx.get(stem)!
    }
  }

  // 5. LLM translation candidates
  const llmCandidates = llmTranslations[n] ?? llmTranslations[norm(stripped)] ?? []
  for (const candidate of llmCandidates) {
    const cn = norm(candidate)
    if (idx.has(cn)) return idx.get(cn)!
    for (const stem of stripEnSuffix(cn)) {
      if (idx.has(stem)) return idx.get(stem)!
    }
  }

  // 6. Substring match (last resort for short words)
  // Only for words ≥ 4 chars to avoid false positives
  if (n.length >= 4) {
    for (const [key, entry] of idx) {
      if (key.startsWith(n) && key.length - n.length <= 3) return entry
      if (n.startsWith(key) && n.length - key.length <= 3) return entry
    }
  }

  return null
}

// ─── Tokeniser ────────────────────────────────────────────────────────────────
function tokeniseText(
  rawText: string,
  idx: Map<string, DatasetEntry>,
  llmTranslations: LlmTranslations = {},
): SignToken[] {
  const cleaned = cleanLLMText(rawText)
  if (!cleaned) return []

  const rawWords = cleaned.split(/\s+/).filter((w) => w.length > 0)
  const tokens: SignToken[] = []
  let i = 0

  while (i < rawWords.length && tokens.length < 20) {
    const w1 = rawWords[i]
    const w2 = rawWords[i + 1]
    const w3 = rawWords[i + 2]

    // Try 3-word phrase first
    if (w2 && w3) {
      const phrase3 = `${w1} ${w2} ${w3}`
      const e3 = lookupWord(idx, phrase3, llmTranslations)
      if (e3) {
        tokens.push({ word: phrase3, gloss: e3.gloss, english: e3.english, category: e3.category, sigmlPath: e3.sigmlPath, datasetRoot: e3.datasetRoot, known: true })
        i += 3
        continue
      }
    }

    // Try 2-word phrase
    if (w2) {
      const phrase2 = `${w1} ${w2}`
      const e2 = lookupWord(idx, phrase2, llmTranslations)
      if (e2) {
        tokens.push({ word: phrase2, gloss: e2.gloss, english: e2.english, category: e2.category, sigmlPath: e2.sigmlPath, datasetRoot: e2.datasetRoot, known: true })
        i += 2
        continue
      }
    }

    // Single word
    const entry = lookupWord(idx, w1, llmTranslations)
    const inIndex = entry !== null

    // Skip stop words only if they have no sign
    if (!inIndex && isStopWord(w1)) { i++; continue }
    if (w1.length < 2) { i++; continue }

    if (entry) {
      tokens.push({ word: w1, gloss: entry.gloss, english: entry.english, category: entry.category, sigmlPath: entry.sigmlPath, datasetRoot: entry.datasetRoot, known: true })
    } else {
      // Include unknown content words as fingerspell
      tokens.push({ word: w1, gloss: w1, english: w1, category: 'Unknown', sigmlPath: '', known: false })
    }
    i++
  }

  return tokens
}

// ─── SiGML XML parser for hand motion ────────────────────────────────────────
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

const f = (
  left: [number, number, number],
  right: [number, number, number],
  leftRot: [number, number, number] = [0, -18, -8],
  rightRot: [number, number, number] = [0, 18, 8],
): RigFrame => ({ left, right, leftRot, rightRot })

const LOCATION_POINTS: Record<string, [number, number, number]> = {
  neutral:  [0,    1.35, 0.25],
  shoulder: [0.78, 1.7,  0.18],
  chest:    [0.18, 1.35, 0.42],
  sternum:  [0.16, 1.42, 0.42],
  head:     [0.32, 2.08, 0.18],
  face:     [0.18, 1.92, 0.46],
  mouth:    [0.1,  1.84, 0.58],
  chin:     [0.1,  1.76, 0.55],
  hand:     [0.54, 1.42, 0.35],
}

const DEFAULT_MOTIONS: Record<HandVariant, RigMotion> = {
  open:  { leftHand: 'open',  rightHand: 'open',  speed: 1, source: 'fallback', frames: [f([-0.8, 1.25, 0.18], [0.62, 1.5, 0.58]), f([-0.78, 1.3, 0.2], [0.92, 1.62, 0.68], [0, -18, -8], [-12, 32, 18]), f([-0.8, 1.25, 0.18], [0.62, 1.5, 0.58])] },
  point: { leftHand: 'open',  rightHand: 'point', speed: 1, source: 'fallback', frames: [f([-0.82, 1.22, 0.16], [0.48, 1.58, 0.7]), f([-0.82, 1.22, 0.16], [0.68, 1.8, 0.85], [0, -18, -8], [-24, 18, 5]), f([-0.82, 1.22, 0.16], [0.48, 1.58, 0.7])] },
  flat:  { leftHand: 'flat',  rightHand: 'flat',  speed: 1, source: 'fallback', frames: [f([-0.58, 1.28, 0.45], [0.58, 1.28, 0.45], [8, -20, -8], [8, 20, 8]), f([-0.24, 1.58, 0.62], [0.24, 1.58, 0.62], [-4, -6, 6], [-4, 6, -6]), f([-0.58, 1.28, 0.45], [0.58, 1.28, 0.45], [8, -20, -8], [8, 20, 8])] },
  peace: { leftHand: 'open',  rightHand: 'peace', speed: 1, source: 'fallback', frames: [f([-0.72, 1.24, 0.16], [0.45, 1.48, 0.62]), f([-0.72, 1.24, 0.16], [0.78, 1.62, 0.76], [0, -18, -8], [-12, 28, 18]), f([-0.72, 1.24, 0.16], [0.45, 1.48, 0.62])] },
  fist:  { leftHand: 'fist',  rightHand: 'fist',  speed: 1, source: 'fallback', frames: [f([-0.48, 1.24, 0.42], [0.48, 1.24, 0.42]), f([-0.34, 1.48, 0.62], [0.34, 1.48, 0.62]), f([-0.48, 1.24, 0.42], [0.48, 1.24, 0.42])] },
  thumb: { leftHand: 'fist',  rightHand: 'thumb', speed: 1, source: 'fallback', frames: [f([-0.72, 1.24, 0.16], [0.48, 1.44, 0.62]), f([-0.72, 1.24, 0.16], [0.72, 1.62, 0.72], [0, -18, -8], [-22, 18, 18]), f([-0.72, 1.24, 0.16], [0.48, 1.44, 0.62])] },
}

function handFromHam(tags: string, fallback: HandVariant): HandVariant {
  if (/hamfist|hamceeall|hamclose/.test(tags)) return 'fist'
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
  const dy = tags.includes('hamup') ? 0.32 : tags.includes('hamdown') ? -0.28 : 0.08
  const dz = tags.includes('hamclose') ? -0.18 : tags.includes('hamforward') ? 0.32 : 0.16
  const both = /hambetween|hamboth|hamcircle|hamrepeat/.test(tags)
  const midR: [number, number, number] = [rightBase[0] + dx, rightBase[1] + dy, rightBase[2] + dz]
  const midL: [number, number, number] = both ? [leftBase[0] - dx, leftBase[1] + dy, leftBase[2] + dz] : [-0.82, 1.22, 0.16]
  const frames = tags.includes('hamcircle')
    ? [f(leftBase, rightBase), f(midL, midR, [8, -24, -18], [8, 24, 18]), f([leftBase[0], leftBase[1] - 0.12, leftBase[2] + 0.22], [rightBase[0], rightBase[1] - 0.12, rightBase[2] + 0.22], [-8, -12, 18], [-8, 12, -18]), f(leftBase, rightBase)]
    : [f(leftBase, rightBase), f(midL, midR), f(leftBase, rightBase)]
  return { frames, leftHand: both ? hand : 'open', rightHand: hand, speed: tags.includes('hamslow') ? 1.35 : tags.includes('hamfast') ? 0.7 : 1, source: 'sigml' }
}

function sampleBdslFrame(frames: RigFrame[], phase: number) {
  const scaled = (phase % 1) * (frames.length - 1)
  const i = Math.floor(scaled)
  const ni = Math.min(i + 1, frames.length - 1)
  const t = scaled - i
  const mix = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t,
  ]
  return { left: mix(frames[i].left, frames[ni].left), right: mix(frames[i].right, frames[ni].right), leftRot: mix(frames[i].leftRot, frames[ni].leftRot), rightRot: mix(frames[i].rightRot, frames[ni].rightRot) }
}

// ─── Waveform ──────────────────────────────────────────────────────────────────
function SignWaveform({ color, playing }: { color: string; playing: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '3px', height: '44px' }}>
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

// ─── 3D Rig ────────────────────────────────────────────────────────────────────
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
    const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.22 + (i === 1 ? 0.06 : 0), 8), material)
    lower.position.y = 0.12
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.18 + (i === 1 ? 0.04 : 0), 8), material)
    upper.position.y = 0.34
    finger.add(lower, upper)
    hand.add(finger)
    fingers.push(finger)
  }
  const thumb = new THREE.Group()
  thumb.position.set(-0.23, -0.02, 0.04)
  const thumbMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.28, 8), material)
  thumbMesh.position.y = 0.12
  thumb.add(thumbMesh)
  hand.add(thumb)
  hand.userData.fingers = fingers
  hand.userData.thumb = thumb
  return hand
}

function applyRigHandShape(hand: THREE.Group, shape: HandVariant) {
  const fingers = hand.userData.fingers as THREE.Group[]
  const thumb = hand.userData.thumb as THREE.Group
  if (!fingers) return
  fingers.forEach((finger, i) => {
    const isPoint = shape === 'point' && i === 1
    const isPeace = shape === 'peace' && (i === 1 || i === 2)
    const curl = shape === 'fist' ? 1.35 : shape === 'thumb' ? 1.25 : isPoint || isPeace || shape === 'flat' || shape === 'open' ? 0.05 : 1.1
    finger.rotation.x = curl
    finger.rotation.z = degToRad((i - 1.5) * (shape === 'open' ? -8 : 3))
  })
  if (thumb) {
    thumb.rotation.z = shape === 'thumb' ? degToRad(-72) : shape === 'fist' ? degToRad(-12) : degToRad(-42)
    thumb.rotation.x = shape === 'fist' ? degToRad(42) : 0
  }
}

function ThreeSignRig({ token, fallbackShape, accent, playing }: {
  token: SignToken; fallbackShape: HandVariant; accent: string; playing: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const motionRef = useRef<RigMotion>(DEFAULT_MOTIONS[fallbackShape])

  // Load SiGML and parse motion
  useEffect(() => {
    motionRef.current = DEFAULT_MOTIONS[fallbackShape]
    const url = sigmlUrlForEntry(token)
    if (!url || !token.known) return
    let cancelled = false
    fetch(url)
      .then((res) => (res.ok ? res.text() : null))
      .then((xml) => { if (!cancelled && xml) motionRef.current = parseSigmlMotion(xml, fallbackShape) })
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
      scene.traverse((obj) => { (obj as THREE.Mesh).geometry?.dispose() })
      if (renderer.domElement.parentNode === host) host.removeChild(renderer.domElement)
    }
  }, [accent, playing])

  return <div ref={hostRef} style={{ width: '100%', height: '196px' }} aria-label="3D BdSL SiGML hand rig" />
}

// ─── CWASA Avatar ──────────────────────────────────────────────────────────────
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
        const playButton = controls.find((btn) => {
          const value = btn instanceof HTMLInputElement ? btn.value : ''
          const title = btn.getAttribute('title') ?? btn.getAttribute('aria-label') ?? ''
          const label = `${btn.textContent ?? ''} ${value} ${title}`.toLowerCase()
          return label.includes('play') || label.includes('sign')
        }) ?? controls.find((btn) => typeof btn.click === 'function')
        if (playButton) { playButton.click(); setStatus('Playing IsharaKotha SiGML'); return }
        setStatus('CWASA play button not ready'); return
      }
      setStatus('CWASA URL field not ready'); return
    }
    try {
      window.CWASA?.playSiGMLURL?.(absoluteUrl)
      setStatus('Playing IsharaKotha SiGML')
    } catch {
      try { window.CWASA?.playSiGMLURL?.(0, absoluteUrl); setStatus('Playing IsharaKotha SiGML') }
      catch { setStatus('Playback failed') }
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
            if (!cancelled && pendingUrlRef.current) { playUrl(pendingUrlRef.current); pendingUrlRef.current = null }
          }, 700)
        }
      })
      .catch(() => { if (!cancelled) setStatus('CWASA could not load') })
    return () => { cancelled = true }
  }, [playUrl])

  useEffect(() => {
    if (!token.known || !currentUrl) { setStatus('No sign found'); return }
    if (!initializedRef.current) { pendingUrlRef.current = currentUrl; return }
    if (!playing) return
    const timer = window.setTimeout(() => playUrl(currentUrl), 400)
    return () => window.clearTimeout(timer)
  }, [currentUrl, token.known, playing, playUrl])

  useEffect(() => { if (!playing) window.CWASA?.stopSiGML?.(0) }, [playing])

  return (
    <div ref={hostRef} style={{ position: 'relative', width: '100%', height: '340px', overflow: 'hidden' }} aria-label="CWASA BdSL signing avatar">
      <div style={{ width: '100%', height: '306px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        <div className="CWASAAvatar av0" style={{ textAlign: 'center' }} />
      </div>
      <div style={{ position: 'absolute', left: '-9999px', top: '0', width: '360px', height: '1px', overflow: 'hidden' }}>
        <span className="CWASAAvMenu av0" /><span className="CWASAAmbBox av0" /><span className="CWASASpeed av0" />
        <div className="CWASASiGMLURL av0" /><div className="CWASASiGMLText av0" />
        <div className="CWASAPlay av0" /><span className="CWASAPlayExtra av0" /><span className="CWASAFrames av0" />
        <div className="CWASAProgress av0" /><div className="CWASAStatus av0" />
        <div className="SToCA" style={{ textAlign: 'center' }} />
      </div>
      <div style={{ position: 'absolute', left: '10px', right: '10px', bottom: '2px', textAlign: 'center', fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
        {status}
      </div>
    </div>
  )
}

// ─── Sign card ─────────────────────────────────────────────────────────────────
function SignCard({ token, index, playing }: { token: SignToken; index: number; playing: boolean }) {
  const col = getColor(token.category)
  return (
    <motion.div
      key={token.gloss + index}
      initial={{ opacity: 0, scale: 0.93, y: 14 }}
      animate={{ opacity: 1, scale: 1,    y: 0  }}
      exit={{    opacity: 0, scale: 0.88, y: -12 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
      style={{ background: col.bg, border: `2px solid ${col.dot}`, borderRadius: '16px', padding: '18px 20px 14px', display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', boxSizing: 'border-box' }}
    >
      <SignWaveform color={col.dot} playing={playing} />
      <div>
        <div style={{ fontSize: '20px', fontWeight: 500, color: col.text, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '3px' }}>{token.gloss}</div>
        {token.word && token.word.toLowerCase() !== token.gloss.toLowerCase() && (
          <div style={{ fontSize: '12px', color: col.text, lineHeight: 1.25, marginBottom: '3px' }}>
            Matched word: <span style={{ fontWeight: 500 }}>{token.word}</span>
          </div>
        )}
        {token.english !== token.gloss && (
          <div style={{ fontSize: '12px', color: col.dot, fontStyle: 'italic' }}>{token.english}</div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontWeight: 500, background: `${col.dot}22`, color: col.text, padding: '3px 7px', borderRadius: '5px' }}>{token.category}</span>
        <span style={{ fontSize: '10px', fontWeight: 500, background: `${col.dot}11`, color: col.text, padding: '3px 7px', borderRadius: '5px' }}>{token.known ? 'lexical' : 'fingerspell'}</span>
        {!token.sigmlPath && token.known && (
          <span style={{ fontSize: '10px', fontWeight: 500, background: '#FFF3CD', color: '#856404', padding: '3px 7px', borderRadius: '5px' }}>no SiGML</span>
        )}
      </div>
    </motion.div>
  )
}

// ─── Token pills ───────────────────────────────────────────────────────────────
function TokenStrip({ tokens, activeIndex, onSelect }: { tokens: SignToken[]; activeIndex: number; onSelect: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', paddingTop: '4px' }}>
      {tokens.map((t, i) => {
        const c = getColor(t.category)
        const active = i === activeIndex
        return (
          <button key={i} onClick={() => onSelect(i)} style={{
            fontSize: '12px', fontWeight: active ? 500 : 400,
            padding: '4px 11px', borderRadius: '20px', cursor: 'pointer',
            border: active ? `1.5px solid ${c.dot}` : '0.5px solid var(--color-border-tertiary)',
            background: active ? c.bg : 'transparent',
            color: active ? c.text : 'var(--color-text-secondary)',
            transition: 'all 0.15s',
            display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '1px',
            lineHeight: 1.1, minHeight: '28px',
          }}>
            <span>{t.word}</span>
            {t.known && t.word.toLowerCase() !== t.gloss.toLowerCase() && (
              <span style={{ fontSize: '10px', opacity: 0.75 }}>{t.gloss}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Progress bar ──────────────────────────────────────────────────────────────
function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round(((current + 1) / total) * 100) : 0
  return (
    <div style={{ height: '3px', background: 'var(--color-border-tertiary)', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
      <motion.div animate={{ width: `${pct}%` }} transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{ height: '100%', background: color, borderRadius: '2px' }} />
    </div>
  )
}

// ─── Match stats banner ────────────────────────────────────────────────────────
function MatchStatsBanner({ tokens }: { tokens: SignToken[] }) {
  if (tokens.length === 0) return null
  const known = tokens.filter(t => t.known)
  const withSigml = known.filter(t => t.sigmlPath)
  const pct = Math.round((known.length / tokens.length) * 100)
  const col = pct >= 75 ? '#1D9E75' : pct >= 40 ? '#BA7517' : '#A32D2D'
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
      {[
        { label: 'Total tokens', value: tokens.length, bg: '#E6F1FB', text: '#185FA5' },
        { label: 'Matched', value: `${known.length} (${pct}%)`, bg: '#E1F5EE', text: '#0F6E56' },
        { label: 'With SiGML', value: withSigml.length, bg: '#EEEDFE', text: '#3C3489' },
        { label: 'Fingerspell', value: tokens.length - known.length, bg: '#F1EFE8', text: '#5F5E5A' },
      ].map(s => (
        <div key={s.label} style={{ background: s.bg, color: s.text, borderRadius: '8px', padding: '4px 10px', fontSize: '11px', fontWeight: 500 }}>
          {s.label}: <strong>{s.value}</strong>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function BdslAvatar({ active, text }: Props) {
  const [entries, setEntries]     = useState<DatasetEntry[]>([])
  const [loadState, setLoadState] = useState<'idle'|'loading'|'done'|'error'>('idle')
  const [loadError, setLoadError] = useState<string|null>(null)
  const [playing, setPlaying]     = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [llmTranslations, setLlmTranslations] = useState<LlmTranslations>({})
  const [resolvingSigns, setResolvingSigns] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval>|null>(null)

  // Load IsharaKotha dataset
  useEffect(() => {
    if (!active || loadState !== 'idle') return
    setLoadState('loading')
    loadDataset()
      .then((data) => {
        // Deduplicate by english+gloss key, dataset entries take priority over seed
        const seen = new Set<string>()
        const deduped = data.filter((e) => {
          const key = `${norm(e.english)}:${norm(e.gloss)}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        setEntries(deduped)
        setLoadState('done')
      })
      .catch((err) => {
        setLoadError(String(err))
        setLoadState('error')
      })
  }, [active, loadState])

  const idx = useMemo(() => buildIndex(entries), [entries])

  const rawTokens = useMemo(() => {
    if (!text?.trim() || entries.length === 0) return []
    return tokeniseText(text, idx, llmTranslations)
  }, [text, idx, llmTranslations, entries.length])

  // Prefer tokens that have a SiGML file, but don't hide the others
  const tokens = useMemo(() => {
    if (rawTokens.length === 0) return []
    const playable = rawTokens.filter(t => t.known && t.sigmlPath)
    // Show all matched tokens regardless of SiGML availability
    return rawTokens
  }, [rawTokens])

  const preparing = resolvingSigns || loadState === 'loading' || loadState === 'idle'

  // Reset when text changes
  useEffect(() => {
    setActiveIndex(0)
    setPlaying(false)
    setLlmTranslations({})
    setResolvingSigns(!!text?.trim())
  }, [text])

  // Resolve unknown words via LLM translation API then start playback
  useEffect(() => {
    if (!active || !text?.trim()) { setResolvingSigns(false); return }
    if (loadState === 'loading' || loadState === 'idle') { setResolvingSigns(true); return }
    if (loadState === 'error') { setResolvingSigns(false); setPlaying(true); return }

    const localTokens = tokeniseText(text, idx)
    const unknownWords = localTokens
      .filter(t => !t.known)
      .map(t => t.word)
      .filter((w, i, a) => a.indexOf(w) === i)
      .slice(0, 10)

    if (unknownWords.length === 0) { setResolvingSigns(false); setPlaying(true); return }

    let cancelled = false
    setResolvingSigns(true)
    fetch('/api/bdsl-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: unknownWords, context: text }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(payload => {
        if (cancelled || !payload || !Array.isArray(payload.translations)) return
        setLlmTranslations(prev => {
          const next = { ...prev }
          for (const item of payload.translations) {
            if (!item || typeof item.word !== 'string' || !Array.isArray(item.candidates)) continue
            const key = norm(item.word)
            const candidates = item.candidates.filter((c: unknown): c is string => typeof c === 'string')
            if (key && candidates.length > 0) next[key] = candidates
          }
          return next
        })
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) { setResolvingSigns(false); setPlaying(true) } })

    return () => { cancelled = true }
  }, [active, idx, loadState, text])

  // Auto-advance
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (preparing || !playing || tokens.length <= 1) return
    intervalRef.current = setInterval(() => {
      setActiveIndex(i => (i + 1) % tokens.length)
    }, 6500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [playing, preparing, tokens.length])

  useEffect(() => {
    if (activeIndex >= tokens.length) setActiveIndex(0)
  }, [activeIndex, tokens.length])

  const handleSelect = useCallback((i: number) => { setActiveIndex(i); setPlaying(false) }, [])
  const togglePlay   = useCallback(() => setPlaying(p => !p), [])
  const restart      = useCallback(() => { setActiveIndex(0); setPlaying(true) }, [])

  if (!active) return null

  const current = tokens[activeIndex]
  const currentColor = current ? getColor(current.category) : getColor('Unknown')
  const knownCount = tokens.filter(t => t.known).length

  return (
    <div style={{ fontFamily: 'var(--font-sans)', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-primary)' }}>BdSL Finger Signs</span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)', padding: '2px 8px', borderRadius: '10px' }}>
            {loadState === 'done' ? `${entries.length.toLocaleString()} signs` : loadState === 'loading' ? 'Loading IsharaKotha…' : loadState === 'idle' ? 'Waiting…' : 'Error'}
          </span>
          {tokens.length > 0 && (
            <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-background-secondary)', padding: '2px 8px', borderRadius: '10px' }}>
              {preparing ? 'Preparing…' : `${knownCount}/${tokens.length} matched`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'} disabled={preparing || tokens.length === 0}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', cursor: (preparing || tokens.length === 0) ? 'not-allowed' : 'pointer', opacity: (preparing || tokens.length === 0) ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'var(--color-text-primary)' }}>
            {playing ? '⏸' : '▶'}
          </button>
          <button onClick={restart} aria-label="Restart" disabled={preparing || tokens.length === 0}
            style={{ width: '32px', height: '32px', borderRadius: '8px', border: '0.5px solid var(--color-border-secondary)', background: 'var(--color-background-primary)', cursor: (preparing || tokens.length === 0) ? 'not-allowed' : 'pointer', opacity: (preparing || tokens.length === 0) ? 0.55 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', color: 'var(--color-text-primary)' }}>
            ↺
          </button>
        </div>
      </div>

      {/* Error banner */}
      {loadError && (
        <div style={{ marginBottom: '10px', padding: '8px 12px', borderRadius: '8px', background: 'var(--color-background-warning)', color: 'var(--color-text-warning)', fontSize: '12px', border: '0.5px solid var(--color-border-warning)' }}>
          ⚠ Dataset load error: {loadError}
        </div>
      )}

      {/* Match stats */}
      {!preparing && tokens.length > 0 && <MatchStatsBanner tokens={tokens} />}

      {/* Main body */}
      {!preparing && tokens.length > 0 && current ? (
        <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', gap: '16px', alignItems: 'start' }}>

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ height: '340px', overflow: 'hidden', borderRadius: '12px', background: `linear-gradient(180deg, ${currentColor.bg} 0%, rgba(255,255,255,0.45) 100%)`, border: `2px solid ${currentColor.dot}` }}>
              <CwasaSignAvatar token={current} playing={playing} />
            </div>
            <AnimatePresence mode="wait">
              <SignCard key={`${current.gloss}-${activeIndex}`} token={current} index={activeIndex} playing={playing} />
            </AnimatePresence>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

            <div style={{ background: 'var(--color-background-secondary)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>
                IsharaKotha · {activeIndex + 1} of {tokens.length}
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={`info-${activeIndex}`}
                  initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.18 }}>
                  <div style={{ fontSize: '26px', fontWeight: 500, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1, marginBottom: '5px' }}>{current.gloss}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '6px' }}>
                    Matched word: <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{current.word}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                    {current.category}{current.english !== current.gloss ? ` · ${current.english}` : ''}
                  </div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', fontWeight: 500, background: current.known ? currentColor.bg : 'var(--color-background-warning)', color: current.known ? currentColor.text : 'var(--color-text-warning)' }}>
                      {current.known ? 'lexical sign' : 'fingerspell'}
                    </span>
                    {current.sigmlPath && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: 'var(--color-background-primary)', color: 'var(--color-text-tertiary)', border: '0.5px solid var(--color-border-tertiary)' }}>
                        SiGML: {current.sigmlPath}
                      </span>
                    )}
                    {!current.sigmlPath && current.known && (
                      <span style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', background: '#FFF3CD', color: '#856404' }}>
                        No SiGML file in dataset
                      </span>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <ProgressBar current={activeIndex} total={tokens.length} color={currentColor.dot} />
            <TokenStrip tokens={tokens} activeIndex={activeIndex} onSelect={handleSelect} />
          </div>
        </div>

      ) : (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '14px', background: 'var(--color-background-secondary)', borderRadius: '12px' }}>
          {loadState === 'loading' || loadState === 'idle'
            ? 'Loading IsharaKotha dataset…'
            : resolvingSigns
              ? 'Preparing all BdSL signs…'
              : !text?.trim()
                ? 'Waiting for text…'
                : entries.length === 0
                  ? 'Dataset empty — check /data/Sections/dataset.json'
                  : 'No signs matched. Try more content words.'}
        </div>
      )}
    </div>
  )
}
