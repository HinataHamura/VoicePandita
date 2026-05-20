import { NextRequest, NextResponse } from 'next/server'

const HOTSPOTS = [
  {
    topic: 'Newton second law',
    subject: 'physics',
    count: 47,
    clarification: 'F = ma means force changes motion through acceleration. More force gives more acceleration; more mass needs more force.',
  },
  {
    topic: 'Photosynthesis',
    subject: 'biology',
    count: 38,
    clarification: 'Plants use sunlight, water and carbon dioxide to make glucose. Oxygen is released as a result.',
  },
  {
    topic: 'Ionic bonding',
    subject: 'chemistry',
    count: 31,
    clarification: 'One atom gives an electron, another receives it. Opposite charges attract and form the ionic bond.',
  },
  {
    topic: 'Quadratic equation',
    subject: 'math',
    count: 29,
    clarification: 'First identify a, b and c in ax²+bx+c=0. Then use x = (-b ± √(b²-4ac)) / 2a.',
  },
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const subject = searchParams.get('subject')
  const hotspots = subject ? HOTSPOTS.filter(item => item.subject === subject) : HOTSPOTS
  return NextResponse.json({ hotspots, total: hotspots.length })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const question = String(body.question || '').slice(0, 500)
  const subject = String(body.subject || 'unknown')
  const sessionId = String(body.sessionId || 'anonymous')

  return NextResponse.json({
    stored: Boolean(question),
    sessionId,
    subject,
    anonymized: true,
  })
}
