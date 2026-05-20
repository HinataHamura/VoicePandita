import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const form  = await req.formData()
    const audio = form.get('audio') as File

    if (!audio) return NextResponse.json({ error: 'No audio' }, { status: 400 })

    const transcription = await groq.audio.transcriptions.create({
      file:            audio,
      model:           'whisper-large-v3',
      language:        'bn',
      response_format: 'json',
    })

    return NextResponse.json({ text: transcription.text })
  } catch (err) {
    console.error('/api/transcribe error:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 500 })
  }
}
