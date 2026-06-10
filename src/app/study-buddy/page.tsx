'use client'

import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import StudyBuddyInviteCard from '@/components/study-buddy/StudyBuddyInviteCard'

export default function StudyBuddyPage() {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_STUDY_BUDDY === 'true'

  return (
    <div className="ai-shell min-h-dvh px-4 py-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/learn" className="soft-button mb-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold">
          <ArrowLeft size={16} />
          Back to Learn
        </Link>
        <section className="rounded-[2rem] border border-white/60 bg-white/82 p-6 shadow-2xl shadow-forest/10 backdrop-blur-xl">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-forest to-indigo text-white">
            <Users size={24} />
          </div>
          <h1 className="font-display text-3xl font-bold text-ink">Bondhu Study Room</h1>
          <p className="bangla mt-3 leading-7 text-ink/65">
            একই concept নিয়ে কয়েকজন student একসাথে practice করতে পারবে। AI host ভালো question, hint, explanation আর moderated discussion চালাবে।
          </p>
          {!enabled ? (
            <div className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Feature flag off আছে। `.env.local` এ `NEXT_PUBLIC_ENABLE_STUDY_BUDDY=true` দিলে entry point দেখা যাবে।
            </div>
          ) : (
            <div className="mt-6">
              <StudyBuddyInviteCard
                questionText="Newton-er second law bujhi na"
                subject="physics"
                language="bn"
                emotionLabel="confused"
                conceptHint="Newton's Second Law"
              />
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
