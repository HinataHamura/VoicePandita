export type OllamaRole = 'system' | 'user' | 'assistant'

export interface OllamaMessage {
  role: OllamaRole
  content: string
}

export interface OllamaChatOptions {
  model?: string
  baseUrl?: string
  stream?: boolean
  timeoutMs?: number
  temperature?: number
  topP?: number
  maxTokens?: number
}

export interface OllamaChatResult {
  content: string
  model: string
  done: boolean
}

export interface OllamaHealthResult {
  ok: boolean
  baseUrl: string
  error?: string
}

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_MODEL = 'qwen2.5:0.5b'
const DEFAULT_EMBED_MODEL = 'embeddinggemma:300m-qat-q4_0'
const DEFAULT_TIMEOUT_MS = 12000

function ollamaBaseUrl() {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/$/, '')
}

function friendlyOllamaError(error: unknown) {
  if (error instanceof Error && error.name === 'AbortError') {
    return 'Ollama model load হতে সময় নিচ্ছে. একবার warm up হলে আবার প্রশ্ন করলে দ্রুত উত্তর আসবে।'
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/aborted/i.test(message)) {
    return 'Ollama model load হতে সময় নিচ্ছে. একবার warm up হলে আবার প্রশ্ন করলে দ্রুত উত্তর আসবে।'
  }
  if (/fetch failed|ECONNREFUSED|Failed to fetch|terminated/i.test(message)) {
    return 'Ollama চালু নেই. Terminal এ `ollama run qwen2.5:0.5b` চালাও।'
  }
  return `Ollama response পাওয়া যায়নি: ${message}`
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export async function chatWithOllama(
  messages: OllamaMessage[],
  options: OllamaChatOptions = {}
): Promise<OllamaChatResult> {
  const baseUrl = (options.baseUrl || ollamaBaseUrl()).replace(/\/$/, '')
  const model = options.model || process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL
  const response = await fetchWithTimeout(
    `${baseUrl}/api/chat`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: options.stream ?? false,
        keep_alive: '10m',
        options: {
          temperature: options.temperature ?? 0.2,
          top_p: options.topP ?? 0.85,
          num_predict: options.maxTokens ?? 320,
        },
      }),
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  ).catch(error => {
    throw new Error(friendlyOllamaError(error))
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Ollama chat failed (${response.status}). ${detail || friendlyOllamaError('chat failed')}`)
  }

  const data = (await response.json()) as {
    model?: string
    done?: boolean
    message?: { content?: string }
    response?: string
  }
  const content = String(data.message?.content || data.response || '').trim()
  if (!content) throw new Error('Ollama empty answer দিয়েছে. Model pull করা আছে কিনা দেখো।')

  return {
    content,
    model: data.model || model,
    done: Boolean(data.done ?? true),
  }
}

export async function embedWithOllama(text: string, options: Pick<OllamaChatOptions, 'baseUrl' | 'timeoutMs'> = {}) {
  const baseUrl = (options.baseUrl || ollamaBaseUrl()).replace(/\/$/, '')
  const model = process.env.OLLAMA_EMBED_MODEL?.trim() || DEFAULT_EMBED_MODEL
  const response = await fetchWithTimeout(
    `${baseUrl}/api/embeddings`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt: text }),
    },
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  ).catch(error => {
    throw new Error(friendlyOllamaError(error))
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Ollama embedding failed (${response.status}). ${detail || friendlyOllamaError('embedding failed')}`)
  }

  const data = (await response.json()) as { embedding?: number[] }
  if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
    throw new Error('Ollama embedding খালি এসেছে. embeddinggemma model pull করা আছে কিনা দেখো।')
  }
  return data.embedding
}

export async function checkOllamaHealth(options: Pick<OllamaChatOptions, 'baseUrl' | 'timeoutMs'> = {}): Promise<OllamaHealthResult> {
  const baseUrl = (options.baseUrl || ollamaBaseUrl()).replace(/\/$/, '')
  try {
    const response = await fetchWithTimeout(`${baseUrl}/api/tags`, { method: 'GET' }, options.timeoutMs ?? 2500)
    if (!response.ok) return { ok: false, baseUrl, error: friendlyOllamaError(`HTTP ${response.status}`) }
    return { ok: true, baseUrl }
  } catch (error) {
    return { ok: false, baseUrl, error: friendlyOllamaError(error) }
  }
}

export const OLLAMA_DEFAULTS = {
  baseUrl: DEFAULT_BASE_URL,
  model: DEFAULT_MODEL,
  embeddingModel: DEFAULT_EMBED_MODEL,
}
