'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Accessibility, ArrowRight, Globe, Languages, Video } from 'lucide-react'
import { getAuthenticatedStudent, nextRouteForStudent } from '@/lib/authFlow'

const paths = [
  {
    title: 'Bangla student',
    sub: 'বাংলায় video-style visual explanation চাই',
    href: '/learn?mode=animation&language=bn',
    icon: Video,
    badge: 'Visual tutor',
  },
  {
    title: 'Ethnic learner',
    sub: 'Chakma / Marma / Garo mother-language texting',
    href: '/chakma',
    icon: Languages,
    badge: 'MELD bridge',
  },
  {
    title: 'Deaf learner',
    sub: 'BdSL avatar mode দিয়ে explanation দেখতে চাই',
    href: '/learn?deaf=1&mode=animation',
    icon: Accessibility,
    badge: 'Avatar mode',
  },
]

export default function StudentPathPage() {
  const router = useRouter()

  useEffect(() => {
    getAuthenticatedStudent().then(student => {
      if (!student) {
        router.replace('/login?next=/student-path')
        return
      }
      if (nextRouteForStudent(student.id, '/onboarding') === '/onboarding') {
        router.replace('/onboarding')
      }
    })
  }, [router])

  return (
    <div className="min-h-dvh bg-cream px-4 py-10">
      <main className="mx-auto flex min-h-[calc(100dvh-80px)] max-w-4xl flex-col justify-center">
        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
          <Link href="/" className="font-display text-2xl font-bold">
            Voice<span className="text-saffron">Pandita</span>
          </Link>
          <div className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-forest to-indigo text-white shadow-xl shadow-forest/20">
            <Globe size={24} />
          </div>
          <h1 className="bangla mt-5 font-display text-3xl font-bold">তুমি কোনভাবে শিখতে চাও?</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink/58">
            Login complete. এখন learner type বেছে নাও, VoicePandita তোমাকে সেই dedicated page-এ নিয়ে যাবে।
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-3">
          {paths.map((path, index) => (
            <motion.div key={path.title} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
              <Link href={path.href} className="card group flex h-full flex-col p-5 hover:-translate-y-1">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest/8 text-forest group-hover:bg-saffron/10 group-hover:text-saffron">
                    <path.icon size={22} />
                  </div>
                  <span className="rounded-full bg-saffron/10 px-2.5 py-1 text-xs font-semibold text-saffron">{path.badge}</span>
                </div>
                <h2 className="text-lg font-semibold">{path.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-ink/58">{path.sub}</p>
                <div className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-forest group-hover:text-saffron">
                  Continue <ArrowRight size={15} className="group-hover:translate-x-0.5" />
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-5 text-center">
          <Link href="/onboarding" className="text-sm font-medium text-ink/45 hover:text-ink">
            Need SSC/HSC setup first?
          </Link>
        </div>
      </main>
    </div>
  )
}
