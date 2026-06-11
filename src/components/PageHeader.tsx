'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
}

export default function PageHeader({
  title,
  subtitle,
  backHref = '/learn',
  backLabel = 'Back to learn',
}: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-10 border-b border-black/5 bg-cream/85 px-4 py-4 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <Link
          href={backHref}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/70 text-ink shadow-sm shadow-forest/5 transition-colors hover:bg-white"
          aria-label={backLabel}
          title={backLabel}
        >
          <ArrowLeft size={18} className="text-forest" />
        </Link>
        <div className="min-w-0">
          <h1 className="truncate font-display text-lg font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="truncate text-xs text-ink/45">{subtitle}</p>}
        </div>
      </div>
    </header>
  )
}