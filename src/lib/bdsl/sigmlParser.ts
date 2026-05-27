export type BdslHandVariant = 'open' | 'point' | 'fist' | 'flat' | 'peace' | 'thumb'

export type BdslRigFrame = {
  left: [number, number, number]
  right: [number, number, number]
  leftRot: [number, number, number]
  rightRot: [number, number, number]
}

export type BdslRigMotion = {
  frames: BdslRigFrame[]
  leftHand: BdslHandVariant
  rightHand: BdslHandVariant
  speed: number
  source: 'sigml' | 'fallback'
  unsupportedTags: string[]
}

export type BdslSigmlEntry = {
  sigmlPath?: string
  datasetRoot?: string
}

const DATASET_ROOT = '/data/Sections'

const frame = (
  left: [number, number, number],
  right: [number, number, number],
  leftRot: [number, number, number] = [0, -18, -8],
  rightRot: [number, number, number] = [0, 18, 8],
): BdslRigFrame => ({ left, right, leftRot, rightRot })

export const DEFAULT_BDSL_MOTIONS: Record<BdslHandVariant, BdslRigMotion> = {
  open: {
    leftHand: 'open', rightHand: 'open', speed: 1, source: 'fallback', unsupportedTags: [],
    frames: [
      frame([-0.8, 1.25, 0.18], [0.62, 1.5, 0.58]),
      frame([-0.78, 1.3, 0.2], [0.92, 1.62, 0.68], [0, -18, -8], [-12, 32, 18]),
      frame([-0.8, 1.25, 0.18], [0.62, 1.5, 0.58]),
    ],
  },
  point: {
    leftHand: 'open', rightHand: 'point', speed: 1, source: 'fallback', unsupportedTags: [],
    frames: [
      frame([-0.82, 1.22, 0.16], [0.48, 1.58, 0.7]),
      frame([-0.82, 1.22, 0.16], [0.68, 1.8, 0.85], [0, -18, -8], [-24, 18, 5]),
      frame([-0.82, 1.22, 0.16], [0.48, 1.58, 0.7]),
    ],
  },
  flat: {
    leftHand: 'flat', rightHand: 'flat', speed: 1, source: 'fallback', unsupportedTags: [],
    frames: [
      frame([-0.58, 1.28, 0.45], [0.58, 1.28, 0.45], [8, -20, -8], [8, 20, 8]),
      frame([-0.24, 1.58, 0.62], [0.24, 1.58, 0.62], [-4, -6, 6], [-4, 6, -6]),
      frame([-0.58, 1.28, 0.45], [0.58, 1.28, 0.45], [8, -20, -8], [8, 20, 8]),
    ],
  },
  peace: {
    leftHand: 'open', rightHand: 'peace', speed: 1, source: 'fallback', unsupportedTags: [],
    frames: [
      frame([-0.72, 1.24, 0.16], [0.45, 1.48, 0.62]),
      frame([-0.72, 1.24, 0.16], [0.78, 1.62, 0.76], [0, -18, -8], [-12, 28, 18]),
      frame([-0.72, 1.24, 0.16], [0.45, 1.48, 0.62]),
    ],
  },
  fist: {
    leftHand: 'fist', rightHand: 'fist', speed: 1, source: 'fallback', unsupportedTags: [],
    frames: [
      frame([-0.48, 1.24, 0.42], [0.48, 1.24, 0.42]),
      frame([-0.34, 1.48, 0.62], [0.34, 1.48, 0.62]),
      frame([-0.48, 1.24, 0.42], [0.48, 1.24, 0.42]),
    ],
  },
  thumb: {
    leftHand: 'fist', rightHand: 'thumb', speed: 1, source: 'fallback', unsupportedTags: [],
    frames: [
      frame([-0.72, 1.24, 0.16], [0.48, 1.44, 0.62]),
      frame([-0.72, 1.24, 0.16], [0.72, 1.62, 0.72], [0, -18, -8], [-22, 18, 18]),
      frame([-0.72, 1.24, 0.16], [0.48, 1.44, 0.62]),
    ],
  },
}

const LOCATION_POINTS: Array<[RegExp, [number, number, number]]> = [
  [/hamshoulders?|hamlrbeside/, [0.78, 1.7, 0.18]],
  [/hamchest|hamsternum/, [0.16, 1.36, 0.42]],
  [/hamneck/, [0.18, 1.68, 0.34]],
  [/hamhead/, [0.32, 2.02, 0.2]],
  [/hamface/, [0.18, 1.9, 0.44]],
  [/hammouth/, [0.1, 1.82, 0.56]],
  [/hamchin/, [0.1, 1.74, 0.54]],
  [/hamhand/, [0.54, 1.42, 0.35]],
]

const SUPPORTED_TAGS = [
  /^hamnosys_/, /^hampar/, /^hamseq/, /^hamplus$/, /^hamreplace$/, /^hambetween$/,
  /^hamflathand$/, /^hamfist$/, /^hamfinger/, /^hamextfinger/, /^hamindexfinger$/,
  /^hammiddlefinger$/, /^hamthumb/, /^hampalm/, /^hamshoulders?$/, /^hamchest$/,
  /^hamsternum$/, /^hamneck$/, /^hamhead$/, /^hamface$/, /^hammouth$/, /^hamchin$/,
  /^hamclose$/, /^hamtouch$/, /^hammove/, /^hamcircle/, /^hamslow$/, /^hamfast$/,
  /^hamrepeat/, /^hamsymm/, /^hamlr/, /^hamnomotion$/, /^hamsmallmod$/, /^hamlargemod$/,
]

export function sigmlUrlForEntry(entry: BdslSigmlEntry) {
  if (!entry.sigmlPath || !entry.datasetRoot) return null
  if (/^https?:\/\//i.test(entry.sigmlPath)) return entry.sigmlPath
  const file = encodeURIComponent(entry.sigmlPath.replaceAll('\\', '/').split('/').pop() ?? entry.sigmlPath)
  return `${DATASET_ROOT}/${encodeURIComponent(entry.datasetRoot)}/${file}`
}

export function extractHamnosysTags(xml: string) {
  return Array.from(xml.matchAll(/<\s*(ham[a-z0-9_:-]+)/gi)).map((match) => match[1].toLowerCase())
}

function unsupportedTags(tags: string[]) {
  return Array.from(new Set(tags.filter((tag) => !SUPPORTED_TAGS.some((pattern) => pattern.test(tag)))))
}

function handFromTags(tagText: string, fallback: BdslHandVariant): BdslHandVariant {
  if (/hamfist|hamceeall|hamfingerbendmod|hamthumbacrossmod|hamclose/.test(tagText)) return 'fist'
  if (/hamfinger23|hamvsign/.test(tagText)) return 'peace'
  if (/hamflathand|hamfinger2345|hampalmd|hamfingerstraightmod/.test(tagText)) return 'flat'
  if (/hamindexfinger|hamfinger2|hamextfingeru|hamextfingerl|hamextfingero/.test(tagText)) return 'point'
  if (/hamthumboutmod|hamthumbopenmod|hamthumb/.test(tagText)) return 'thumb'
  return fallback
}

function locationFromTags(tagText: string): [number, number, number] {
  return LOCATION_POINTS.find(([pattern]) => pattern.test(tagText))?.[1] ?? [0, 1.35, 0.25]
}

function movementFromTags(tagText: string) {
  let dx = /hammovel|hamextfingerl|hampalml/.test(tagText) ? -0.28 : /hammover|hampalmr/.test(tagText) ? 0.28 : 0.18
  let dy = /hammoveu|hampalmu/.test(tagText) ? 0.32 : /hammoved|hampalmd/.test(tagText) ? -0.28 : 0.08
  let dz = /hamclose|hamtouch/.test(tagText) ? -0.22 : /hammoveo|hamextfingero|hamfar/.test(tagText) ? 0.34 : 0.16
  if (/hamcircle/.test(tagText)) {
    dx *= 1.15
    dy = Math.max(dy, 0.18)
    dz = Math.max(dz, 0.22)
  }
  return { dx, dy, dz }
}

export function parseIsharaKothaSigml(xml: string, fallback: BdslHandVariant): BdslRigMotion {
  const tags = extractHamnosysTags(xml)
  const tagText = tags.join(' ')
  const hand = handFromTags(tagText, fallback)
  const base = locationFromTags(tagText)
  const leftBase: [number, number, number] = [-Math.abs(base[0] || 0.64), base[1], base[2]]
  const rightBase: [number, number, number] = [Math.abs(base[0] || 0.64), base[1], base[2]]
  const { dx, dy, dz } = movementFromTags(tagText)
  const both = /hambetween|hamboth|hamcircle|hamrepeat|hamsymm|hamlr/.test(tagText)
  const midR: [number, number, number] = [rightBase[0] + dx, rightBase[1] + dy, rightBase[2] + dz]
  const midL: [number, number, number] = both ? [leftBase[0] - dx, leftBase[1] + dy, leftBase[2] + dz] : [-0.82, 1.22, 0.16]

  const frames = /hamcircle/.test(tagText)
    ? [
        frame(leftBase, rightBase),
        frame(midL, midR, [8, -24, -18], [8, 24, 18]),
        frame([leftBase[0], leftBase[1] - 0.12, leftBase[2] + 0.22], [rightBase[0], rightBase[1] - 0.12, rightBase[2] + 0.22], [-8, -12, 18], [-8, 12, -18]),
        frame(leftBase, rightBase),
      ]
    : /hamtouch|hamclose/.test(tagText)
      ? [
          frame(leftBase, rightBase),
          frame(midL, midR, [0, -10, -4], [0, 10, 4]),
          frame([midL[0] * 0.92, midL[1], midL[2] - 0.08], [midR[0] * 0.92, midR[1], midR[2] - 0.08], [4, -8, -2], [4, 8, 2]),
        ]
      : [frame(leftBase, rightBase), frame(midL, midR), frame(leftBase, rightBase)]

  return {
    frames,
    leftHand: both ? hand : 'open',
    rightHand: hand,
    speed: /hamslow/.test(tagText) ? 1.35 : /hamfast/.test(tagText) ? 0.7 : 1,
    source: 'sigml',
    unsupportedTags: unsupportedTags(tags),
  }
}

export function sampleBdslFrame(frames: BdslRigFrame[], phase: number) {
  const scaled = (phase % 1) * (frames.length - 1)
  const i = Math.floor(scaled)
  const ni = Math.min(i + 1, frames.length - 1)
  const t = scaled - i
  const mix = (a: [number, number, number], b: [number, number, number]): [number, number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ]
  return {
    left: mix(frames[i].left, frames[ni].left),
    right: mix(frames[i].right, frames[ni].right),
    leftRot: mix(frames[i].leftRot, frames[ni].leftRot),
    rightRot: mix(frames[i].rightRot, frames[ni].rightRot),
  }
}
