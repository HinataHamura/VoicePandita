import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Browser SpeechSynthesis handles TTS on the frontend.
  // This endpoint exists as a fallback signal only.
  // On Vercel, Python/gTTS is unavailable - return fallback flag.
  // Frontend in learn/page.tsx checks for { fallback: true } and
  // uses browser TTS instead.
  return NextResponse.json({ fallback: true })
}
