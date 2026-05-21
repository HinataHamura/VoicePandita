import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groqKey = process.env.GROQ_API_KEY
const groq = groqKey ? new Groq({ apiKey: groqKey }) : null

export async function POST(req: NextRequest) {
  try {
    const form  = await req.formData()
    const audio = form.get('audio') as File

    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })
    if (!groq) {
      return NextResponse.json({
        text: 'Newton er second law bujhao',
        fallback: true,
        note: 'GROQ_API_KEY missing; browser voice fallback or demo transcript used.',
      })
    }

    const transcription = await groq.audio.transcriptions.create({
      file:            audio,
      model:           'whisper-large-v3',
      language:        'bn',
      response_format: 'json',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    console.error('/api/transcribe error:', err)
    return NextResponse.json({
      text: 'Newton er second law bujhao',
      fallback: true,
      error: 'Transcription failed; demo transcript used.',
    })
  }
}
