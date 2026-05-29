import Link from 'next/link'
import { Lock } from 'lucide-react'
import DocsClient from '@/components/docs/DocsClient'
import { isDocsVisible } from '@/lib/docs/defaults'
import { readDocsConfig } from '@/lib/docs/store'

export const dynamic = 'force-dynamic'

export default async function DocsPage() {
  const config = await readDocsConfig()
  const visible = isDocsVisible(config)

  if (!visible) {
    return (
      <main className="min-h-screen px-4 py-10">
        <div className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-center justify-center text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo/10 text-forest">
            <Lock size={24} />
          </div>
          <h1 className="font-display text-4xl font-bold text-ink">Docs Not Available</h1>
          <p className="mt-3 text-sm leading-6 text-ink/60">
            VoicePandita docs are currently restricted. The public window is {config.startAt.replace('T', ' ')} to {config.endAt.replace('T', ' ')}.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <Link href="/" className="rounded-full border border-white/70 bg-white/80 px-5 py-2 text-sm font-semibold text-ink/70">
              Back to app
            </Link>
            <Link href="/docs/admin" className="rounded-full bg-forest px-5 py-2 text-sm font-semibold text-white">
              Admin preview
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return <DocsClient initialConfig={config} adminMode={false} initialVisible={visible} />
}
