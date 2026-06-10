'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ChevronDown, ChevronUp, Clipboard, FileText, Loader2, Upload, X } from 'lucide-react'
import LanguageSwitcher from '@/components/LanguageSwitcher'
import { useLanguage } from '@/components/LanguageProvider'

type PdfSummaryResponse = {
  success: boolean
  error?: string
  fileName?: string
  pages?: number
  pdfType?: 'text_pdf' | 'scanned_or_empty'
  summaryLanguage?: 'bn' | 'en'
  shortSummary?: string
  detailedSummary?: string
  keyPoints?: string[]
  importantTerms?: string[]
  studyNotes?: string[]
  source?: 'pdf-summary'
  extractedText?: string
  warning?: string
  fallbackReason?: string
}

function SummaryList({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm leading-6 text-ink/50">এই অংশে আলাদা তথ্য পাওয়া যায়নি।</p>
  return (
    <ul className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-7 text-ink/70">
          <span className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-forest" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function NumberedNotes({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm leading-6 text-ink/50">Study note পাওয়া যায়নি।</p>
  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-3 text-sm leading-7 text-ink/70">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-forest/10 text-xs font-bold text-forest">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

function TermChips({ items }: { items?: string[] }) {
  if (!items?.length) return <p className="text-sm leading-6 text-ink/50">Important term পাওয়া যায়নি।</p>
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="rounded-2xl border border-forest/10 bg-forest/10 px-3 py-2 text-sm font-semibold leading-5 text-ink/70">
          {item}
        </span>
      ))}
    </div>
  )
}

function Paragraphs({ text }: { text?: string }) {
  const paragraphs = (text || '')
    .split(/\n{2,}/)
    .map(item => item.trim())
    .filter(Boolean)

  if (!paragraphs.length) return <p className="text-sm leading-7 text-ink/50">Summary পাওয়া যায়নি।</p>

  return (
    <div className="space-y-4">
      {paragraphs.map((paragraph, index) => (
        <p key={`${paragraph}-${index}`} className="bangla text-sm leading-8 text-ink/70">
          {paragraph}
        </p>
      ))}
    </div>
  )
}

export default function PdfSummaryPage() {
  const { language, t } = useLanguage()
  const fileRef = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<PdfSummaryResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedExtracted, setCopiedExtracted] = useState(false)
  const [showExtractedText, setShowExtractedText] = useState(false)

  async function handlePdf(file?: File) {
    if (!file) return
    setLoading(true)
    setError('')
    setSummary(null)
    setCopied(false)
    setCopiedExtracted(false)
    setShowExtractedText(false)

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('language', language)
      const res = await fetch('/api/pdf-summary', { method: 'POST', body: form })
      const data = (await res.json()) as PdfSummaryResponse

      if (!data.success) {
        setError(data.pdfType === 'scanned_or_empty' ? t('pdf.scannedError') : data.error || t('pdf.scannedError'))
        setSummary(data)
        return
      }

      setSummary(data)
    } catch {
      setError(t('pdf.genericError'))
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function clearSummary() {
    setSummary(null)
    setError('')
    setCopied(false)
    setCopiedExtracted(false)
    setShowExtractedText(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function copySummary() {
    if (!summary?.success) return
    const text = [
      `File: ${summary.fileName || 'PDF'}`,
      `Pages: ${summary.pages || 0}`,
      '',
      'Short Summary:',
      summary.shortSummary,
      '',
      'Detailed Summary:',
      summary.detailedSummary,
      '',
      'Key Points:',
      ...(summary.keyPoints || []).map(item => `- ${item}`),
      '',
      'Important Terms / Formulas:',
      ...(summary.importantTerms || []).map(item => `- ${item}`),
      '',
      'Study Notes:',
      ...(summary.studyNotes || []).map(item => `- ${item}`),
    ].filter(Boolean).join('\n')

    await navigator.clipboard.writeText(text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  async function copyExtractedText() {
    if (!summary?.extractedText) return
    await navigator.clipboard.writeText(summary.extractedText)
    setCopiedExtracted(true)
    window.setTimeout(() => setCopiedExtracted(false), 1600)
  }

  const fallbackActive = Boolean(summary?.fallbackReason)

  return (
    <main className="ai-shell min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link href="/learn" className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/75 px-4 py-2 text-sm font-semibold text-ink/70 shadow-sm hover:text-forest">
            <ArrowLeft size={16} /> {t('common.backToLearn')}
          </Link>
          <LanguageSwitcher />
          <div className="rounded-full border border-forest/15 bg-white/75 px-4 py-2 text-xs font-semibold text-forest">
            {t('pdf.badge')}
          </div>
        </div>

        <section className="mx-auto max-w-3xl text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-forest to-indigo text-white shadow-lg shadow-forest/20">
            <FileText size={28} />
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-ink md:text-5xl">{t('pdf.title')}</h1>
          <p className="mt-3 text-sm leading-6 text-ink/60 md:text-base">
            {t('pdf.subtitle')}
          </p>
        </section>

        <section className="mx-auto mt-8 max-w-3xl rounded-3xl border border-white/70 bg-white/80 p-4 shadow-xl shadow-forest/5 backdrop-blur-xl">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={event => handlePdf(event.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={loading}
            className="flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-forest/25 bg-paper/70 px-6 py-10 text-center transition hover:border-forest/45 hover:bg-white disabled:opacity-60"
          >
            {loading ? <Loader2 size={30} className="mb-3 animate-spin text-forest" /> : <Upload size={30} className="mb-3 text-forest" />}
            <span className="text-base font-bold text-ink">{loading ? t('pdf.generating') : t('pdf.uploadTitle')}</span>
            <span className="mt-2 text-xs text-ink/50">{t('pdf.limits')}</span>
          </button>

          {error && (
            <div className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}
        </section>

        {summary?.success && (
          <section className="mt-8 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-white/70 bg-white/80 px-5 py-4 shadow-lg shadow-forest/5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-forest">{t('pdf.generated')}</p>
                <h2 className="mt-1 text-lg font-bold text-ink">{summary.fileName}</h2>
                <p className="text-sm text-ink/60">{summary.pages} pages · {summary.pdfType}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={copySummary} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-forest to-indigo px-4 py-2 text-sm font-semibold text-white shadow-sm">
                  {copied ? <Check size={15} /> : <Clipboard size={15} />}
                  {copied ? t('common.copied') : t('pdf.copySummary')}
                </button>
                <button onClick={clearSummary} className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-4 py-2 text-sm font-semibold text-ink/60 shadow-sm hover:bg-white">
                  <X size={15} /> {t('common.clear')}
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {fallbackActive && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 lg:col-span-2">
                  <strong className="font-semibold">{t('pdf.fallback')}</strong>
                  <span className="ml-1">{t('pdf.fallbackDetail')}</span>
                </div>
              )}

              {!fallbackActive && summary.warning && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800 lg:col-span-2">
                  {summary.warning}
                </div>
              )}

              <article className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-forest/5">
                <h3 className="mb-3 font-display text-2xl font-bold text-ink">{t('pdf.shortSummary')}</h3>
                <Paragraphs text={summary.shortSummary} />
              </article>

              <article className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-forest/5 lg:row-span-2">
                <h3 className="mb-3 font-display text-2xl font-bold text-ink">{t('pdf.detailedSummary')}</h3>
                <Paragraphs text={summary.detailedSummary} />
              </article>

              <article className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-forest/5">
                <h3 className="mb-3 font-display text-2xl font-bold text-ink">{t('pdf.keyPoints')}</h3>
                <SummaryList items={summary.keyPoints} />
              </article>

              <article className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-forest/5">
                <h3 className="mb-3 font-display text-2xl font-bold text-ink">{t('pdf.terms')}</h3>
                <TermChips items={summary.importantTerms} />
              </article>

              <article className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-forest/5">
                <h3 className="mb-3 font-display text-2xl font-bold text-ink">{t('pdf.studyNotes')}</h3>
                <NumberedNotes items={summary.studyNotes} />
              </article>

              {summary.extractedText && (
                <article className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-lg shadow-forest/5 lg:col-span-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowExtractedText(value => !value)}
                      className="inline-flex items-center gap-2 text-sm font-bold text-forest"
                    >
                      {showExtractedText ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      {showExtractedText ? t('pdf.hideExtracted') : t('pdf.showExtracted')}
                    </button>
                    {showExtractedText && (
                      <button
                        type="button"
                        onClick={copyExtractedText}
                        className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-xs font-semibold text-ink/60 shadow-sm hover:bg-white"
                      >
                        {copiedExtracted ? <Check size={14} /> : <Clipboard size={14} />}
                        {copiedExtracted ? t('common.copied') : t('pdf.copyText')}
                      </button>
                    )}
                  </div>

                  {showExtractedText && (
                    <textarea
                      readOnly
                      value={summary.extractedText}
                      className="mt-4 min-h-64 w-full resize-y rounded-2xl border border-black/10 bg-paper/75 p-4 text-sm leading-7 text-ink/70 outline-none"
                    />
                  )}
                </article>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
