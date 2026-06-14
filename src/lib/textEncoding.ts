const CP1252_TO_BYTE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
}

const MOJIBAKE_MARKER_RE = /\u00e0\u00a6|\u00e0\u00a7|\u00c3|\u00c2|\u00e2[\u02c6\u20ac\u2122\u201c\u201d\u2022\u2013\u2014]/
const MOJIBAKE_RUN_RE =
  /[\u0080-\u00ff\u0192\u02c6\u02dc\u0160\u0161\u0178\u017d\u017e\u0152\u0153\u201a\u201e\u2026\u2020\u2021\u2030\u2039\u203a\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u20ac\u2122]+/g

function decodeWindows1252Run(run: string) {
  const bytes = Uint8Array.from(Array.from(run, char => {
    const code = char.charCodeAt(0)
    return CP1252_TO_BYTE[code] ?? (code & 0xff)
  }))

  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

export function looksLikeMojibakeText(value: string) {
  return MOJIBAKE_MARKER_RE.test(value)
}

export function repairMojibakeText(value: string) {
  if (!looksLikeMojibakeText(value)) return value

  return value.replace(MOJIBAKE_RUN_RE, run => {
    const decoded = decodeWindows1252Run(run)
    return decoded.includes('\uFFFD') ? run : decoded
  })
}
