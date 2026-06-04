const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

export function validateImageFile(file: File | null) {
  if (!file) {
    return { ok: false, error: 'No image uploaded', status: 400 }
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, error: 'Only PNG, JPG, or WEBP images are supported.', status: 415 }
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, error: 'Image must be smaller than 5MB.', status: 413 }
  }

  return { ok: true, error: null, status: 200 }
}

export function cleanOcrText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, block => block.replace(/```(?:text|markdown)?/gi, '').replace(/```/g, ''))
    .replace(/^\s*(extracted\s*text|ocr\s*text|transcribed\s*text|text\s*extracted|question|প্রশ্ন|লেখা|পাঠ্য)\s*:\s*/i, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim()
}

export async function imageFileToGenerativePart(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer())

  return {
    inlineData: {
      data: bytes.toString('base64'),
      mimeType: file.type,
    },
  }
}
