'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Accessibility, Database, Pause, Play, RotateCcw } from 'lucide-react'
import * as THREE from 'three'

interface Props {
  active: boolean
  text: string
}

type MotionKind = 'greeting' | 'learning' | 'question' | 'positive' | 'thanks' | 'home' | 'book' | 'digit' | 'spell'
type HandShape = 'open' | 'flat' | 'point' | 'fist'

type IsharaKothaEntry = {
  gloss: string
  bangla?: string
  english?: string
  category?: string
  hamnosys?: string
  sigml?: string
  sigmlPath?: string
  aliases?: string[]
  motion?: MotionKind
}

type LimbTrack = {
  rotateZ: number[]
  rotateY: number[]
  rotateX: number[]
  x: number[]
  y: number[]
  z: number[]
}

type AvatarPose = {
  key: MotionKind
  label: string
  leftUpper: LimbTrack
  rightUpper: LimbTrack
  leftLower: LimbTrack
  rightLower: LimbTrack
  head: { rotateZ: number[]; rotateY: number[]; y: number[] }
  leftHand: HandShape
  rightHand: HandShape
  mouth: number[]
}

type SignToken = {
  token: string
  entry: IsharaKothaEntry
  pose: AvatarPose
  known: boolean
}

type ParsedSignMotion = {
  frames: GestureFrame[]
  leftHand: HandShape
  rightHand: HandShape
  source: 'preset' | 'sigml'
}

const DATASET_URLS = [
  '/data/isharakotha/lexicon.json',
  '/data/isharakotha/dataset.json',
  '/data/isharakotha/isharakotha.json',
]
const BN_SALAM = '\u09B8\u09BE\u09B2\u09BE\u09AE'
const BN_QUESTION = '\u09AA\u09CD\u09B0\u09B6\u09CD\u09A8'

const track = (
  rotateZ: number[],
  rotateY: number[],
  rotateX: number[],
  x: number[],
  y: number[],
  z: number[],
): LimbTrack => ({ rotateZ, rotateY, rotateX, x, y, z })

const POSES: Record<MotionKind, AvatarPose> = {
  greeting: {
    key: 'greeting',
    label: 'Greeting',
    leftUpper: track([-10, -10, -10], [-10, -10, -10], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightUpper: track([-76, -42, -76], [22, 42, 22], [-8, -18, -8], [12, 26, 12], [-18, -38, -18], [22, 46, 22]),
    leftLower: track([8, 8, 8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightLower: track([-16, 28, -16], [8, -18, 8], [0, -10, 0], [2, 16, 2], [-8, -18, -8], [20, 34, 20]),
    head: { rotateZ: [0, 3, 0], rotateY: [0, -8, 0], y: [0, -2, 0] },
    leftHand: 'open',
    rightHand: 'open',
    mouth: [1, 1.2, 1],
  },
  learning: {
    key: 'learning',
    label: 'Education',
    leftUpper: track([-78, -44, -78], [-28, -6, -28], [8, -2, 8], [-30, -8, -30], [-6, -18, -6], [8, 30, 8]),
    rightUpper: track([78, 44, 78], [28, 6, 28], [8, -2, 8], [30, 8, 30], [-6, -18, -6], [8, 30, 8]),
    leftLower: track([34, 16, 34], [-12, 6, -12], [0, 10, 0], [-8, 4, -8], [-2, -10, -2], [12, 32, 12]),
    rightLower: track([-34, -16, -34], [12, -6, 12], [0, 10, 0], [8, -4, 8], [-2, -10, -2], [12, 32, 12]),
    head: { rotateZ: [0, 0, 0], rotateY: [0, 0, 0], y: [0, -1, 0] },
    leftHand: 'flat',
    rightHand: 'flat',
    mouth: [1, 1, 1],
  },
  question: {
    key: 'question',
    label: 'Question',
    leftUpper: track([-12, -12, -12], [-8, -8, -8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightUpper: track([-88, -52, -88], [28, 14, 28], [-12, -28, -12], [18, 8, 18], [-26, -46, -26], [24, 54, 24]),
    leftLower: track([8, 8, 8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightLower: track([18, -10, 18], [14, 0, 14], [0, -16, 0], [6, 0, 6], [-12, -24, -12], [22, 38, 22]),
    head: { rotateZ: [-5, 7, -5], rotateY: [0, 10, 0], y: [0, 0, 0] },
    leftHand: 'open',
    rightHand: 'point',
    mouth: [1, 0.65, 1],
  },
  positive: {
    key: 'positive',
    label: 'Positive',
    leftUpper: track([-48, -28, -48], [-18, -8, -18], [4, -4, 4], [-10, -2, -10], [-8, -20, -8], [10, 30, 10]),
    rightUpper: track([48, 28, 48], [18, 8, 18], [4, -4, 4], [10, 2, 10], [-8, -20, -8], [10, 30, 10]),
    leftLower: track([24, 8, 24], [-8, 2, -8], [0, 8, 0], [-4, 0, -4], [-4, -12, -4], [10, 28, 10]),
    rightLower: track([-24, -8, -24], [8, -2, 8], [0, 8, 0], [4, 0, 4], [-4, -12, -4], [10, 28, 10]),
    head: { rotateZ: [0, -2, 0], rotateY: [0, 0, 0], y: [0, -2, 0] },
    leftHand: 'fist',
    rightHand: 'fist',
    mouth: [1, 1.16, 1],
  },
  thanks: {
    key: 'thanks',
    label: 'Thanks',
    leftUpper: track([-10, -10, -10], [-8, -8, -8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightUpper: track([-66, -18, -66], [12, 34, 12], [-12, -4, -12], [4, 28, 4], [-34, -10, -34], [32, 58, 32]),
    leftLower: track([8, 8, 8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightLower: track([-8, -26, -8], [2, 18, 2], [0, 8, 0], [0, 10, 0], [-12, 0, -12], [14, 32, 14]),
    head: { rotateZ: [0, 2, 0], rotateY: [0, -4, 0], y: [0, -1, 0] },
    leftHand: 'open',
    rightHand: 'flat',
    mouth: [1, 1.12, 1],
  },
  home: {
    key: 'home',
    label: 'Household',
    leftUpper: track([-70, -48, -70], [-24, -4, -24], [4, -6, 4], [-28, -6, -28], [-22, -36, -22], [20, 42, 20]),
    rightUpper: track([70, 48, 70], [24, 4, 24], [4, -6, 4], [28, 6, 28], [-22, -36, -22], [20, 42, 20]),
    leftLower: track([36, 18, 36], [-12, -2, -12], [0, 8, 0], [-10, 2, -10], [-10, -18, -10], [14, 28, 14]),
    rightLower: track([-36, -18, -36], [12, 2, 12], [0, 8, 0], [10, -2, 10], [-10, -18, -10], [14, 28, 14]),
    head: { rotateZ: [0, 0, 0], rotateY: [0, 0, 0], y: [0, 0, 0] },
    leftHand: 'flat',
    rightHand: 'flat',
    mouth: [1, 1, 1],
  },
  book: {
    key: 'book',
    label: 'Education',
    leftUpper: track([-36, -72, -36], [-14, -38, -14], [8, -2, 8], [-8, -36, -8], [-8, -16, -8], [18, 34, 18]),
    rightUpper: track([36, 72, 36], [14, 38, 14], [8, -2, 8], [8, 36, 8], [-8, -16, -8], [18, 34, 18]),
    leftLower: track([20, 6, 20], [-4, -16, -4], [0, 10, 0], [-4, -12, -4], [-4, -8, -4], [12, 26, 12]),
    rightLower: track([-20, -6, -20], [4, 16, 4], [0, 10, 0], [4, 12, 4], [-4, -8, -4], [12, 26, 12]),
    head: { rotateZ: [0, 1, 0], rotateY: [0, 0, 0], y: [0, -1, 0] },
    leftHand: 'flat',
    rightHand: 'flat',
    mouth: [1, 1, 1],
  },
  digit: {
    key: 'digit',
    label: 'Digit',
    leftUpper: track([-12, -12, -12], [-8, -8, -8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightUpper: track([-44, -26, -44], [16, 22, 16], [-8, -18, -8], [8, 14, 8], [-18, -28, -18], [22, 42, 22]),
    leftLower: track([8, 8, 8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightLower: track([-10, 10, -10], [8, -4, 8], [0, -12, 0], [0, 8, 0], [-8, -16, -8], [14, 28, 14]),
    head: { rotateZ: [0, 0, 0], rotateY: [0, -2, 0], y: [0, 0, 0] },
    leftHand: 'open',
    rightHand: 'point',
    mouth: [1, 1, 1],
  },
  spell: {
    key: 'spell',
    label: 'Fingerspell',
    leftUpper: track([-12, -12, -12], [-8, -8, -8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightUpper: track([-34, -18, -34], [16, 26, 16], [-8, -14, -8], [4, 12, 4], [-16, -24, -16], [18, 34, 18]),
    leftLower: track([8, 8, 8], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]),
    rightLower: track([-8, 14, -8], [6, -6, 6], [0, -10, 0], [0, 7, 0], [-6, -14, -6], [10, 24, 10]),
    head: { rotateZ: [0, 0, 0], rotateY: [0, 0, 0], y: [0, 0, 0] },
    leftHand: 'open',
    rightHand: 'open',
    mouth: [1, 1, 1],
  },
}

const ISHARAKOTHA_SEED: IsharaKothaEntry[] = [
  { gloss: BN_SALAM, english: 'hello', category: 'Social', motion: 'greeting', aliases: ['hello', 'hi', 'salam', '\u09B9\u09CD\u09AF\u09BE\u09B2\u09CB'] },
  { gloss: '\u09B8\u09CD\u09AC\u09BE\u0997\u09A4\u09AE', english: 'welcome', category: 'Social', motion: 'greeting', aliases: ['welcome', '\u09B8\u09CD\u09AC\u09BE\u0997\u09A4'] },
  { gloss: '\u09B6\u09BF\u0995\u09CD\u09B7\u09BE', english: 'education', category: 'Education', motion: 'learning', aliases: ['learn', 'learning', '\u09B6\u09BF\u0996\u09BF', '\u09B6\u09C7\u0996\u09BE'] },
  { gloss: BN_QUESTION, english: 'question', category: 'Education', motion: 'question', aliases: ['question', 'ask', '\u0995\u09BF', '\u0995\u09C0', '\u0995\u09C7\u09A8', '\u0995\u09BF\u09AD\u09BE\u09AC\u09C7'] },
  { gloss: '\u09AD\u09BE\u09B2\u09CB', english: 'good', category: 'Human characteristics', motion: 'positive', aliases: ['good', '\u09AD\u09BE\u09B2'] },
  { gloss: '\u09A7\u09A8\u09CD\u09AF\u09AC\u09BE\u09A6', english: 'thanks', category: 'Social', motion: 'thanks', aliases: ['thanks', 'thank'] },
  { gloss: '\u09AC\u09BE\u09DC\u09BF', english: 'home', category: 'Household items', motion: 'home', aliases: ['home', '\u09AC\u09BE\u09B8\u09BE', '\u09AC\u09BE\u09A1\u09BC\u09BF'] },
  { gloss: '\u09AC\u0987', english: 'book', category: 'Education', motion: 'book', aliases: ['book'] },
  { gloss: '\u09E6', english: 'zero', category: 'Digits', motion: 'digit', aliases: ['0', 'zero'] },
  { gloss: '\u09E7', english: 'one', category: 'Digits', motion: 'digit', aliases: ['1', 'one'] },
  { gloss: '\u09E8', english: 'two', category: 'Digits', motion: 'digit', aliases: ['2', 'two'] },
  { gloss: '\u09E9', english: 'three', category: 'Digits', motion: 'digit', aliases: ['3', 'three'] },
]

const FALLBACK_ENTRY: IsharaKothaEntry = {
  gloss: 'Fingerspell',
  english: 'fallback',
  category: 'Fallback',
  motion: 'spell',
}

const normalizeToken = (value: string) =>
  value
    .normalize('NFC')
    .toLowerCase()
    .replace(/[\u0964,.;:!()[\]{}"']/g, '')
    .trim()

const stringValue = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined)

const firstString = (record: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = stringValue(record[key])
    if (value) return value
  }
  return undefined
}

const aliasesFrom = (value: unknown) => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string')
  if (typeof value === 'string') {
    return value
      .split(/[|,;/]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

const inferMotionFromRecord = (record: Record<string, unknown>, entry: IsharaKothaEntry): MotionKind | undefined => {
  const motion = stringValue(record.motion) as MotionKind | undefined
  if (motion && POSES[motion]) return motion
  return inferMotion(entry, entry.gloss)
}

const coerceEntry = (value: unknown): IsharaKothaEntry | null => {
  if (!value || typeof value !== 'object') return null

  const record = value as Record<string, unknown>
  const gloss = firstString(record, ['gloss', 'word', 'bn', 'bangla', 'bengali', 'sign', 'label', 'name'])
  if (!gloss) return null

  const entry: IsharaKothaEntry = {
    gloss,
    bangla: firstString(record, ['bangla', 'bn', 'bengali']),
    english: firstString(record, ['english', 'en', 'translation', 'meaning']),
    category: firstString(record, ['category', 'class', 'domain', 'group']),
    hamnosys: firstString(record, ['hamnosys', 'hamNoSys', 'hns']),
    sigml: firstString(record, ['sigml', 'SiGML', 'xml']),
    sigmlPath: firstString(record, ['sigmlPath', 'sigml_path', 'file', 'filename', 'path', 'url']),
    aliases: [
      ...aliasesFrom(record.aliases),
      ...aliasesFrom(record.synonyms),
      ...aliasesFrom(record.keywords),
    ],
  }

  entry.motion = inferMotionFromRecord(record, entry)
  return entry
}

const findEntryArrays = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  const direct = ['entries', 'data', 'records', 'signs', 'items', 'lexicon']
    .map((key) => record[key])
    .find(Array.isArray)

  if (Array.isArray(direct)) return direct

  return Object.values(record).flatMap((value) => {
    if (Array.isArray(value)) return value
    if (value && typeof value === 'object') return findEntryArrays(value)
    return []
  })
}

const readDataset = (payload: unknown): IsharaKothaEntry[] => {
  return findEntryArrays(payload).map(coerceEntry).filter((entry): entry is IsharaKothaEntry => Boolean(entry))
}

const isEntry = (value: unknown): value is IsharaKothaEntry => {
  return Boolean(value && typeof value === 'object' && typeof (value as IsharaKothaEntry).gloss === 'string')
}

const buildIndex = (entries: IsharaKothaEntry[]) => {
  const index = new Map<string, IsharaKothaEntry>()

  entries.forEach((entry) => {
    const keys = [entry.gloss, entry.bangla, entry.english, ...(entry.aliases ?? [])].filter(Boolean) as string[]
    keys.forEach((key) => index.set(normalizeToken(key), entry))
  })

  return index
}

const lookupEntry = (index: Map<string, IsharaKothaEntry>, token: string) => {
  const normalized = normalizeToken(token)
  const exact = index.get(normalized)
  if (exact) return exact

  const variants = [
    normalized.replace(/(\u09C7\u09B0|\u09B0|\u0995\u09C7|\u09A4\u09C7|\u09DF|\u09BE\u09DF)$/, ''),
    normalized.replace(/(\u09BE\u09B0)$/, '\u09BE'),
  ].filter((variant) => variant && variant !== normalized)

  for (const variant of variants) {
    const entry = index.get(variant)
    if (entry) return entry
  }

  return undefined
}

const inferMotion = (entry: IsharaKothaEntry, token: string): MotionKind => {
  if (entry.motion && POSES[entry.motion]) return entry.motion

  const haystack = `${entry.category ?? ''} ${entry.english ?? ''} ${entry.gloss} ${token}`.toLowerCase()
  if (/\d|[\u09E6-\u09EF]|digit|number/.test(haystack)) return 'digit'
  if (/question|ask/.test(haystack)) return 'question'
  if (/book/.test(haystack)) return 'book'
  if (/home|house/.test(haystack)) return 'home'
  if (/thanks|thank/.test(haystack)) return 'thanks'
  if (/good/.test(haystack)) return 'positive'
  if (/learn|education/.test(haystack)) return 'learning'
  if (/hello|hi|salam/.test(haystack)) return 'greeting'

  return 'spell'
}

const buildSignSequence = (text: string, entries: IsharaKothaEntry[]): SignToken[] => {
  const index = buildIndex(entries)
  const tokens = text
    .replace(/[^\u0980-\u09FFa-zA-Z0-9\s?]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 14)

  if (tokens.length === 0) {
    const entry = index.get(normalizeToken(BN_SALAM)) ?? ISHARAKOTHA_SEED[0]
    return [{ token: entry.gloss, entry, pose: POSES[inferMotion(entry, entry.gloss)], known: true }]
  }

  return tokens.map((token) => {
    const entry = lookupEntry(index, token) ?? (token.includes('?') ? index.get(normalizeToken(BN_QUESTION)) : undefined) ?? FALLBACK_ENTRY
    const motion = inferMotion(entry, token)

    return {
      token,
      entry,
      pose: POSES[motion],
      known: entry !== FALLBACK_ENTRY,
    }
  })
}

const degToRad = (value: number) => (value * Math.PI) / 180

const sample = (values: number[], phase: number) => {
  if (values.length === 0) return 0
  if (values.length === 1) return values[0]

  const wrapped = phase % 1
  const scaled = wrapped * (values.length - 1)
  const index = Math.floor(scaled)
  const nextIndex = Math.min(index + 1, values.length - 1)
  const amount = scaled - index

  return values[index] + (values[nextIndex] - values[index]) * amount
}

const setTrack = (group: THREE.Group, trackValue: LimbTrack, phase: number, direction = 1) => {
  group.rotation.set(
    degToRad(sample(trackValue.rotateX, phase)),
    degToRad(sample(trackValue.rotateY, phase)) * direction,
    degToRad(sample(trackValue.rotateZ, phase)) * direction,
  )
  group.position.x += (sample(trackValue.x, phase) / 100) * direction
  group.position.y += -sample(trackValue.y, phase) / 100
  group.position.z += sample(trackValue.z, phase) / 100
}

const capsule = (radius: number, length: number, material: THREE.Material) => {
  const group = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 18), material)
  mesh.position.y = -length / 2
  mesh.castShadow = true
  group.add(mesh)
  return group
}

const makeHand = (material: THREE.Material) => {
  const hand = new THREE.Group()
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.42, 28, 18), material)
  palm.scale.set(0.9, 1.08, 0.34)
  palm.castShadow = true
  hand.add(palm)

  const fingers: THREE.Group[] = []
  for (let index = 0; index < 4; index += 1) {
    const finger = new THREE.Group()
    finger.position.set(-0.23 + index * 0.15, 0.34, 0.03)
    finger.rotation.z = degToRad((index - 1.5) * -4)

    const base = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.32, 8, 12), material)
    base.position.y = 0.16
    base.castShadow = true
    finger.add(base)

    const tip = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.25, 8, 12), material)
    tip.position.y = 0.44
    tip.castShadow = true
    finger.add(tip)

    hand.add(finger)
    fingers.push(finger)
  }

  const thumb = new THREE.Group()
  thumb.position.set(-0.36, 0.02, 0.05)
  thumb.rotation.set(0, 0, degToRad(58))
  const thumbMesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.36, 8, 12), material)
  thumbMesh.position.y = 0.16
  thumbMesh.castShadow = true
  thumb.add(thumbMesh)
  hand.add(thumb)

  hand.userData.fingers = fingers
  hand.userData.thumb = thumb
  return hand
}

const applyHandShape = (hand: THREE.Group, shape: HandShape) => {
  const fingers = hand.userData.fingers as THREE.Group[] | undefined
  const thumb = hand.userData.thumb as THREE.Group | undefined
  if (!fingers) return

  fingers.forEach((finger, index) => {
    const isPointingIndex = shape === 'point' && index === 1
    const curl = shape === 'fist' ? 82 : shape === 'point' && !isPointingIndex ? 76 : shape === 'flat' ? 8 : -8
    finger.visible = true
    finger.rotation.x = degToRad(curl)
    finger.rotation.z = degToRad((index - 1.5) * (shape === 'open' ? -9 : -4))
    finger.scale.y = shape === 'flat' || isPointingIndex ? 1.14 : 1
  })

  if (thumb) {
    thumb.rotation.z = degToRad(shape === 'fist' ? 22 : shape === 'point' ? 40 : 58)
    thumb.rotation.x = degToRad(shape === 'fist' ? 38 : 0)
  }
}

type GestureFrame = {
  left: [number, number, number]
  right: [number, number, number]
  leftRot?: [number, number, number]
  rightRot?: [number, number, number]
}

const gesture = (
  left: [number, number, number],
  right: [number, number, number],
  leftRot: [number, number, number] = [0, 0, 0],
  rightRot: [number, number, number] = [0, 0, 0],
): GestureFrame => ({ left, right, leftRot, rightRot })

const GESTURE_PATHS: Record<MotionKind, GestureFrame[]> = {
  greeting: [
    gesture([-0.8, 1.45, 0.25], [0.82, 2.42, 0.55], [0, -20, -8], [0, 20, -18]),
    gesture([-0.8, 1.45, 0.25], [1.12, 2.55, 0.68], [0, -20, -8], [0, 42, 18]),
    gesture([-0.8, 1.45, 0.25], [0.78, 2.35, 0.55], [0, -20, -8], [0, 18, -18]),
  ],
  learning: [
    gesture([-1.1, 1.32, 0.45], [1.1, 1.32, 0.45], [20, -28, -18], [20, 28, 18]),
    gesture([-0.35, 1.7, 0.75], [0.35, 1.7, 0.75], [0, -5, 4], [0, 5, -4]),
    gesture([-0.18, 1.45, 0.72], [0.18, 1.45, 0.72], [10, 0, 0], [10, 0, 0]),
  ],
  question: [
    gesture([-0.72, 1.38, 0.3], [0.62, 2.25, 0.72], [0, -18, -8], [-18, 18, -8]),
    gesture([-0.72, 1.38, 0.3], [0.82, 2.52, 0.82], [0, -18, -8], [-34, 12, 8]),
    gesture([-0.72, 1.38, 0.3], [0.64, 2.32, 0.76], [0, -18, -8], [-18, 18, -8]),
  ],
  positive: [
    gesture([-0.45, 1.48, 0.62], [0.45, 1.48, 0.62], [0, -12, 0], [0, 12, 0]),
    gesture([-0.32, 1.72, 1.02], [0.32, 1.72, 1.02], [-8, -5, 0], [-8, 5, 0]),
    gesture([-0.45, 1.48, 0.62], [0.45, 1.48, 0.62], [0, -12, 0], [0, 12, 0]),
  ],
  thanks: [
    gesture([-0.78, 1.38, 0.28], [0.15, 2.18, 0.86], [0, -20, -8], [-8, 0, 0]),
    gesture([-0.78, 1.38, 0.28], [0.65, 1.85, 1.18], [0, -20, -8], [-18, 18, 16]),
    gesture([-0.78, 1.38, 0.28], [0.25, 2.08, 0.95], [0, -20, -8], [-8, 6, 0]),
  ],
  home: [
    gesture([-0.9, 1.75, 0.55], [0.9, 1.75, 0.55], [0, -30, -24], [0, 30, 24]),
    gesture([-0.28, 2.18, 0.72], [0.28, 2.18, 0.72], [0, -8, 42], [0, 8, -42]),
    gesture([-0.9, 1.75, 0.55], [0.9, 1.75, 0.55], [0, -30, -24], [0, 30, 24]),
  ],
  book: [
    gesture([-0.18, 1.5, 0.86], [0.18, 1.5, 0.86], [0, 12, 0], [0, -12, 0]),
    gesture([-0.72, 1.5, 0.92], [0.72, 1.5, 0.92], [0, -38, -10], [0, 38, 10]),
    gesture([-0.18, 1.5, 0.86], [0.18, 1.5, 0.86], [0, 12, 0], [0, -12, 0]),
  ],
  digit: [
    gesture([-0.82, 1.35, 0.25], [0.48, 1.9, 0.9], [0, -20, -8], [-22, 10, 0]),
    gesture([-0.82, 1.35, 0.25], [0.55, 2.05, 1.03], [0, -20, -8], [-26, 6, 0]),
    gesture([-0.82, 1.35, 0.25], [0.48, 1.9, 0.9], [0, -20, -8], [-22, 10, 0]),
  ],
  spell: [
    gesture([-0.82, 1.35, 0.25], [0.42, 1.75, 0.82], [0, -20, -8], [-18, 18, 0]),
    gesture([-0.82, 1.35, 0.25], [0.58, 1.82, 0.95], [0, -20, -8], [-24, -6, 10]),
    gesture([-0.82, 1.35, 0.25], [0.42, 1.75, 0.82], [0, -20, -8], [-18, 18, 0]),
  ],
}

const sampleVec = (frames: GestureFrame[], side: 'left' | 'right', phase: number) => {
  const values = frames.map((frame) => frame[side])
  const wrapped = phase % 1
  const scaled = wrapped * (values.length - 1)
  const index = Math.floor(scaled)
  const nextIndex = Math.min(index + 1, values.length - 1)
  const amount = scaled - index

  return new THREE.Vector3(
    values[index][0] + (values[nextIndex][0] - values[index][0]) * amount,
    values[index][1] + (values[nextIndex][1] - values[index][1]) * amount,
    values[index][2] + (values[nextIndex][2] - values[index][2]) * amount,
  )
}

const sampleRot = (frames: GestureFrame[], side: 'left' | 'right', phase: number) => {
  const key = side === 'left' ? 'leftRot' : 'rightRot'
  const values = frames.map((frame) => frame[key] ?? [0, 0, 0])
  const wrapped = phase % 1
  const scaled = wrapped * (values.length - 1)
  const index = Math.floor(scaled)
  const nextIndex = Math.min(index + 1, values.length - 1)
  const amount = scaled - index

  return new THREE.Euler(
    degToRad(values[index][0] + (values[nextIndex][0] - values[index][0]) * amount),
    degToRad(values[index][1] + (values[nextIndex][1] - values[index][1]) * amount),
    degToRad(values[index][2] + (values[nextIndex][2] - values[index][2]) * amount),
  )
}

const pointSegment = (mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3, radius: number) => {
  const direction = new THREE.Vector3().subVectors(to, from)
  const length = direction.length()
  mesh.scale.set(radius, length, radius)
  mesh.position.copy(from).addScaledVector(direction, 0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
}

const LOCATION_POINTS: Record<string, [number, number, number]> = {
  neutral: [0, 1.48, 0.92],
  chest: [0, 1.42, 0.9],
  sternum: [0, 1.5, 0.9],
  chin: [0.1, 2.1, 0.9],
  mouth: [0.08, 2.2, 0.95],
  face: [0.18, 2.28, 0.92],
  head: [0.4, 2.48, 0.72],
  shoulder: [0.78, 1.92, 0.55],
  book: [0, 1.45, 0.95],
  roof: [0, 2.16, 0.72],
  forward: [0.5, 1.68, 1.25],
  question: [0.58, 2.28, 0.92],
}

const motionOffset = (direction: string): [number, number, number] => {
  const value = direction.toLowerCase()
  if (value.includes('up')) return [0, 0.32, 0.02]
  if (value.includes('down')) return [0, -0.3, 0.02]
  if (value.includes('left')) return [-0.36, 0, 0.02]
  if (value.includes('right')) return [0.36, 0, 0.02]
  if (value.includes('in')) return [0, 0, -0.3]
  if (value.includes('out') || value.includes('forward')) return [0, 0, 0.36]
  return [0, 0.08, 0.16]
}

const addVec = (point: [number, number, number], offset: [number, number, number]): [number, number, number] => [
  point[0] + offset[0],
  point[1] + offset[1],
  point[2] + offset[2],
]

const mirrorPoint = (point: [number, number, number], side: 'left' | 'right'): [number, number, number] => {
  const direction = side === 'left' ? -1 : 1
  return [Math.abs(point[0]) * direction, point[1], point[2]]
}

const attr = (element: Element, names: string[]) => {
  for (const name of names) {
    const value = element.getAttribute(name)
    if (value) return value
  }
  return ''
}

const handShapeFromSiGML = (value: string): HandShape => {
  const normalized = value.toLowerCase()
  if (normalized.includes('fist') || normalized.includes('hamfist') || normalized.includes('closed')) return 'fist'
  if (normalized.includes('index') || normalized.includes('point') || normalized.includes('1')) return 'point'
  if (normalized.includes('flat') || normalized.includes('bent') || normalized.includes('b')) return 'flat'
  return 'open'
}

const locationFromSiGML = (value: string): [number, number, number] => {
  const normalized = value.toLowerCase()
  const key = Object.keys(LOCATION_POINTS).find((candidate) => normalized.includes(candidate))
  return key ? LOCATION_POINTS[key] : LOCATION_POINTS.neutral
}

const sideFromElement = (element: Element) => {
  const value = attr(element, ['hand', 'lr', 'side', 'laterality']).toLowerCase()
  if (value.includes('left') || value === 'l' || value.includes('non')) return 'left'
  if (value.includes('both') || value.includes('two')) return 'both'
  return 'right'
}

const parseSiGML = (xml: string, fallback: AvatarPose): ParsedSignMotion | null => {
  const parser = new DOMParser()
  const document = parser.parseFromString(xml, 'application/xml')
  if (document.querySelector('parsererror')) return null

  const elements = Array.from(document.querySelectorAll('*'))
  const handConfigs = elements.filter((element) => element.localName.toLowerCase().includes('handconfig'))
  const locations = elements.filter((element) => element.localName.toLowerCase().includes('location'))
  const motions = elements.filter((element) => element.localName.toLowerCase().includes('motion'))

  const firstHandConfig = handConfigs[0]
  const firstHandShape = firstHandConfig
    ? handShapeFromSiGML(attr(firstHandConfig, ['handshape', 'shape', 'mainbend', 'fingerconfig']))
    : fallback.rightHand

  const firstLocation = locations[0]
  const basePoint = firstLocation
    ? locationFromSiGML(attr(firstLocation, ['location', 'bodypart', 'contact', 'name']))
    : LOCATION_POINTS.neutral

  const firstMotion = motions[0]
  const direction = firstMotion
    ? attr(firstMotion, ['direction', 'dir', 'motion', 'axis', 'curve'])
    : fallback.key
  const offset = motionOffset(direction)

  const bothHands =
    elements.some((element) => sideFromElement(element) === 'both') ||
    xml.toLowerCase().includes('both_hands') ||
    xml.toLowerCase().includes('two_hands')

  const rightStart = mirrorPoint(basePoint, 'right')
  const rightEnd = addVec(rightStart, offset)
  const leftStart = bothHands ? mirrorPoint(basePoint, 'left') : [-0.9, 1.32, 0.42] as [number, number, number]
  const leftEnd = bothHands ? addVec(leftStart, [-offset[0], offset[1], offset[2]]) : leftStart

  return {
    frames: [
      gesture(leftStart, rightStart, [0, -18, 0], [0, 18, 0]),
      gesture(leftEnd, rightEnd, [0, -8, 10], [0, 8, -10]),
      gesture(leftStart, rightStart, [0, -18, 0], [0, 18, 0]),
    ],
    leftHand: bothHands ? firstHandShape : fallback.leftHand,
    rightHand: firstHandShape,
    source: 'sigml',
  }
}

const presetMotion = (pose: AvatarPose): ParsedSignMotion => ({
  frames: GESTURE_PATHS[pose.key],
  leftHand: pose.leftHand,
  rightHand: pose.rightHand,
  source: 'preset',
})

const sigmlUrlForEntry = (entry: IsharaKothaEntry) => {
  if (entry.sigml) return null
  if (!entry.sigmlPath) return null
  if (/^https?:\/\//i.test(entry.sigmlPath)) return entry.sigmlPath
  const path = entry.sigmlPath
    .replaceAll('\\', '/')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')
  return `/data/isharakotha/${path}`
}

function ThreeBdslAvatar({ motion }: { motion: ParsedSignMotion }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const motionRef = useRef(motion)

  useEffect(() => {
    motionRef.current = motion
  }, [motion])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 1.65, 5.1)
    camera.lookAt(0, 1.65, 0)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    host.appendChild(renderer.domElement)

    const key = new THREE.DirectionalLight(0xffffff, 2.5)
    key.position.set(3, 5, 5)
    key.castShadow = true
    scene.add(key)
    scene.add(new THREE.HemisphereLight(0xeaf3ec, 0x263c7a, 1.4))

    const skin = new THREE.MeshStandardMaterial({ color: 0xf27457, roughness: 0.48, metalness: 0.02 })
    const guide = new THREE.MeshBasicMaterial({ color: 0x0f6b5c, transparent: true, opacity: 0.08 })

    const hands = new THREE.Group()
    hands.position.set(0, -0.1, 0)
    scene.add(hands)

    const leftHand = makeHand(skin)
    const rightHand = makeHand(skin)
    leftHand.scale.setScalar(1.45)
    rightHand.scale.setScalar(1.45)
    leftHand.rotation.y = degToRad(-12)
    rightHand.rotation.y = degToRad(12)
    hands.add(leftHand, rightHand)

    const targetPad = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), guide)
    targetPad.position.set(0, 1.48, -0.28)
    scene.add(targetPad)

    const resize = () => {
      const rect = host.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()

    let frame = 0
    let raf = 0
    const animate = () => {
      const activeMotion = motionRef.current
      const phase = (performance.now() % 1100) / 1100

      const frames = activeMotion.frames
      const leftWrist = sampleVec(frames, 'left', phase).sub(new THREE.Vector3(0, 1.45, 0.45))
      const rightWrist = sampleVec(frames, 'right', phase).sub(new THREE.Vector3(0, 1.45, 0.45))

      leftHand.position.set(leftWrist.x * 1.15 - 0.18, leftWrist.y * 1.05 + 1.45, leftWrist.z * 0.5)
      rightHand.position.set(rightWrist.x * 1.15 + 0.18, rightWrist.y * 1.05 + 1.45, rightWrist.z * 0.5)
      leftHand.rotation.copy(sampleRot(frames, 'left', phase))
      rightHand.rotation.copy(sampleRot(frames, 'right', phase))
      leftHand.rotation.y += degToRad(-18)
      rightHand.rotation.y += degToRad(18)
      applyHandShape(leftHand, activeMotion.leftHand)
      applyHandShape(rightHand, activeMotion.rightHand)

      renderer.render(scene, camera)
      frame += 1
      raf = window.requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.cancelAnimationFrame(raf)
      observer.disconnect()
      renderer.dispose()
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh
        mesh.geometry?.dispose()
      })
      host.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={hostRef} className="h-full w-full" aria-label="Three.js BdSL signing avatar" />
}

export default function BdslAvatar({ active, text }: Props) {
  const [datasetEntries, setDatasetEntries] = useState<IsharaKothaEntry[]>(ISHARAKOTHA_SEED)
  const [datasetSource, setDatasetSource] = useState<'seed' | 'local'>('seed')
  const sequence = useMemo(() => buildSignSequence(text, datasetEntries), [datasetEntries, text])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [sigmlMotions, setSigmlMotions] = useState<Record<string, ParsedSignMotion>>({})

  useEffect(() => {
    if (!active) return

    let cancelled = false

    Promise.all(
      DATASET_URLS.map((url) =>
        fetch(url)
          .then((response) => (response.ok ? response.json() : null))
          .catch(() => null),
      ),
    )
      .then((payloads) => {
        if (cancelled) return
        const entries = payloads.flatMap((payload) => (payload ? readDataset(payload) : []))
        if (entries.length > 0) {
          setDatasetEntries([...ISHARAKOTHA_SEED, ...entries])
          setDatasetSource('local')
        }
      })
      .catch(() => {
        if (!cancelled) setDatasetSource('seed')
      })

    return () => {
      cancelled = true
    }
  }, [active])

  useEffect(() => {
    setCurrentIndex(0)
    setPlaying(true)
  }, [text, active])

  useEffect(() => {
    if (!active || !playing || sequence.length <= 1) return

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => (index + 1) % sequence.length)
    }, 1350)

    return () => window.clearInterval(timer)
  }, [active, playing, sequence.length])

  const current = sequence[currentIndex] ?? sequence[0]
  const pose = current.pose
  const motionKey = current.entry.sigmlPath ?? current.entry.gloss

  useEffect(() => {
    if (!active || !current.known || sigmlMotions[motionKey]) return

    let cancelled = false
    const inlineSigml = current.entry.sigml

    const storeMotion = (sigml: string) => {
      const parsed = parseSiGML(sigml, pose)
      if (!cancelled && parsed) {
        setSigmlMotions((previous) => ({ ...previous, [motionKey]: parsed }))
      }
    }

    if (inlineSigml) {
      storeMotion(inlineSigml)
      return () => {
        cancelled = true
      }
    }

    const url = sigmlUrlForEntry(current.entry)
    if (!url) return

    fetch(url)
      .then((response) => (response.ok ? response.text() : null))
      .then((sigml) => {
        if (sigml) {
          storeMotion(sigml)
          return
        }
        if (!cancelled) {
          setSigmlMotions((previous) => ({ ...previous, [motionKey]: presetMotion(pose) }))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSigmlMotions((previous) => ({ ...previous, [motionKey]: presetMotion(pose) }))
        }
      })

    return () => {
      cancelled = true
    }
  }, [active, current.entry, current.known, motionKey, pose, sigmlMotions])

  if (!active) return null

  const currentMotion = sigmlMotions[motionKey] ?? {
    ...presetMotion(pose),
  }
  const progress = Math.round(((currentIndex + 1) / sequence.length) * 100)
  const datasetLabel =
    currentMotion.source === 'sigml'
      ? 'IsharaKotha SiGML'
      : datasetSource === 'local'
        ? 'IsharaKotha corpus'
        : 'IsharaKotha seed'

  return (
    <div className="card overflow-hidden p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-xs font-semibold text-forest">
          <Accessibility size={14} />
          <span className="truncate">BdSL Finger Signs</span>
          <span className="rounded-full bg-forest/8 px-2 py-0.5 text-[10px] font-medium text-forest/70">
            {datasetEntries.length} signs
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPlaying((value) => !value)}
            aria-label={playing ? 'Pause BdSL avatar' : 'Play BdSL avatar'}
            title={playing ? 'Pause' : 'Play'}
            className="grid h-8 w-8 place-items-center rounded-md border border-forest/15 bg-white text-forest hover:bg-forest hover:text-white"
          >
            {playing ? <Pause size={15} /> : <Play size={15} />}
          </button>
          <button
            type="button"
            onClick={() => setCurrentIndex(0)}
            aria-label="Restart BdSL avatar"
            title="Restart"
            className="grid h-8 w-8 place-items-center rounded-md border border-forest/15 bg-white text-forest hover:bg-forest hover:text-white"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
        <div className="relative mx-auto h-72 w-64 overflow-hidden rounded-lg border border-forest/10 bg-gradient-to-b from-paper to-white shadow-inner">
          <ThreeBdslAvatar motion={currentMotion} />
          <div className="absolute inset-x-4 bottom-3 h-1.5 overflow-hidden rounded-full bg-forest/10">
            <motion.div className="h-full rounded-full bg-saffron" animate={{ width: `${progress}%` }} transition={{ duration: 0.25 }} />
          </div>
        </div>

        <div className="min-w-0">
          <div className="rounded-lg border border-forest/10 bg-paper/55 p-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase text-forest/70">
              <Database size={12} />
              <span>{datasetLabel}</span>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${current.token}-${currentIndex}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >
                <div className="bangla truncate text-2xl font-semibold text-ink">
                  {current.known ? current.entry.gloss : current.token}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-ink/60">
                  <span className="rounded bg-white/70 px-2 py-0.5">{pose.label}</span>
                  <span className="rounded bg-white/70 px-2 py-0.5">{current.entry.category ?? 'Unmapped'}</span>
                  <span className="rounded bg-white/70 px-2 py-0.5">{current.known ? 'lexical sign' : 'fingerspell'}</span>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {sequence.map((item, index) => (
              <button
                key={`${item.token}-${index}`}
                type="button"
                onClick={() => {
                  setCurrentIndex(index)
                  setPlaying(false)
                }}
                className={`bangla rounded-md border px-2.5 py-1 text-xs ${
                  index === currentIndex
                    ? 'border-forest bg-forest text-white'
                    : item.known
                      ? 'border-forest/15 bg-forest/8 text-forest'
                      : 'border-saffron/25 bg-saffron/10 text-clay'
                }`}
              >
                {item.known ? item.entry.gloss : item.token}
              </button>
            ))}
          </div>

          {current.entry.sigmlPath && (
            <div className="mt-3 truncate rounded-md border border-forest/10 bg-white/72 px-2.5 py-2 text-[11px] text-ink/60">
              SiGML: {current.entry.sigmlPath}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
