// Single source of truth for model names.
//
// Google retires Gemini aliases fairly aggressively: gemini-2.5-flash and
// gemini-2.0-flash both 404 with "no longer available", and the rolling
// gemini-flash-latest alias can return a transient 503 when the model behind it
// is under load. The lists below therefore keep several *currently reachable*
// models so one bad response does not take the whole request down.

function dedupe(models: Array<string | undefined>) {
  return models.filter(
    (model, index, all): model is string => Boolean(model) && all.indexOf(model) === index,
  )
}

const GEMINI_TEXT_FALLBACKS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-flash-lite-latest']
const GEMINI_VISION_FALLBACKS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-flash-lite-latest']

export const DEFAULT_GEMINI_MODEL = GEMINI_TEXT_FALLBACKS[0]
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b'

export function geminiTextModels() {
  return dedupe([process.env.GEMINI_MODEL?.trim(), ...GEMINI_TEXT_FALLBACKS])
}

export function geminiVisionModels() {
  return dedupe([process.env.GEMINI_VISION_MODEL?.trim(), ...GEMINI_VISION_FALLBACKS])
}

export function geminiSummaryModels() {
  return dedupe([process.env.GEMINI_SUMMARY_MODEL?.trim(), ...GEMINI_TEXT_FALLBACKS])
}

export function groqModel() {
  return process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL
}
