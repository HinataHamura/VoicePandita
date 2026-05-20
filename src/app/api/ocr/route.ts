import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const geminiKey = process.env.GEMINI_API_KEY
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const image = form.get('image') as File | null
    if (!image) return NextResponse.json({ error: 'No image uploaded' }, { status: 400 })

    if (!genAI) {
      return NextResponse.json({
        text: 'ছবির প্রশ্নটি এখানে টাইপ করো। OCR চালাতে GEMINI_API_KEY দরকার।',
        fallback: true,
      })
    }

    const bytes = Buffer.from(await image.arrayBuffer())
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_VISION_MODEL || 'gemini-2.0-flash' })
    const result = await model.generateContent([
      {
        inlineData: {
          data: bytes.toString('base64'),
          mimeType: image.type || 'image/jpeg',
        },
      },
      'Extract only the student question from this textbook or handwritten image. Return Bangla text if present. No explanation.',
    ])

    return NextResponse.json({ text: result.response.text().trim() })
  } catch (err) {
    console.error('/api/ocr error:', err)
    return NextResponse.json({ error: 'OCR failed' }, { status: 500 })
  }
}
