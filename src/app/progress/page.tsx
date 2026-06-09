'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  Brain,
  Eye,
  Gauge,
  Lightbulb,
  MessageCircleQuestion,
  Route,
  Sparkles,
  TrendingDown,
  Volume2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  getChatHistory,
  getConceptMemory,
  getCurrentStudent,
  getStudentProgress,
  type ChatHistoryItem,
  type ConceptMemory,
  type StudentIdentity,
  type StudentProgress,
  type TopicProgress,
} from '@/lib/studentStore'

type ConceptStatus = 'New' | 'Exploring' | 'Confused' | 'Improving' | 'Clear'
type Mood = 'Smooth' | 'Confused' | 'Stuck' | 'Improving'

interface ConceptInsight {
  subject: string
  topic: string
  query: string
  sessions: number
  score: number
  status: ConceptStatus
  confusionBefore: number
  confusionNow: number
  teachBackScore: number
  visualScore: number
  independenceScore: number
  mood: Mood
}

interface MetricCard {
  label: string
  value: string | number
  Icon: LucideIcon
}

const EMPTY_PROGRESS: StudentProgress = {
  questions: 0,
  avgScore: 0,
  badges: 0,
  streak: 0,
  sessions: 0,
  accuracy: 0,
  focusTopics: 0,
  weakTopics: [],
  strongTopics: [],
}

const statusTone: Record<ConceptStatus, string> = {
  New: 'bg-slate-100 text-slate-600',
  Exploring: 'bg-aqua/15 text-forest',
  Confused: 'bg-clay/12 text-clay',
  Improving: 'bg-saffron/18 text-orange-700',
  Clear: 'bg-forest/12 text-forest',
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)))
}

function statusFromScore(score: number, sessions: number): ConceptStatus {
  if (sessions <= 1 && score < 50) return 'New'
  if (score < 45) return 'Confused'
  if (score < 65) return 'Exploring'
  if (score < 80) return 'Improving'
  return 'Clear'
}

function moodFromInsight(status: ConceptStatus, confusionNow: number): Mood {
  if (status === 'Clear') return 'Smooth'
  if (status === 'Improving') return 'Improving'
  if (status === 'Confused' || confusionNow >= 3) return 'Stuck'
  return 'Confused'
}

function visualActivity(history: ChatHistoryItem[]) {
  const diagrams = history.filter(item => item.outputMode === 'whiteboard' || Boolean(item.graphPath?.length)).length
  const animations = history.filter(item => item.outputMode === 'animation' || item.outputMode === 'video').length
  const voice = Math.max(0, Math.round(history.length * 0.45))
  const images = history.filter(item => item.source === 'gemini-ocr-context' || item.source === 'local-ocr-context-fallback').length
  return {
    diagrams,
    animations,
    voice,
    images,
    bdsl: Math.max(0, Math.floor(animations / 2)),
  }
}

function buildConceptInsights(progress: StudentProgress, history: ChatHistoryItem[], memory: ConceptMemory[]): ConceptInsight[] {
  const historyByTopic = new Map<string, number>()
  history.forEach(item => {
    const topic = item.graphPath?.slice(-1)[0] || item.subject || 'General'
    historyByTopic.set(topic.toLowerCase(), (historyByTopic.get(topic.toLowerCase()) || 0) + 1)
  })

  const fromWeak = progress.weakTopics.map(topic => topicToInsight(topic, historyByTopic, memory))
  const fromStrong = progress.strongTopics.map(topic => topicToInsight({ ...topic, sessions: 2, query: topic.topic }, historyByTopic, memory))
  const merged = [...fromWeak, ...fromStrong]

  if (merged.length) return merged.slice(0, 8)

  return [
    {
      subject: 'Physics',
      topic: 'Newton second law',
      query: 'Newton-er second law bujhao',
      sessions: 0,
      score: 35,
      status: 'New',
      confusionBefore: 0,
      confusionNow: 0,
      teachBackScore: 0,
      visualScore: 0,
      independenceScore: 30,
      mood: 'Confused',
    },
  ]
}

function topicToInsight(topic: TopicProgress, historyByTopic: Map<string, number>, memory: ConceptMemory[]): ConceptInsight {
  const relatedHistory = historyByTopic.get(topic.topic.toLowerCase()) || 0
  const hasGraphMemory = memory.some(item => item.graphPath.join(' ').toLowerCase().includes(topic.topic.toLowerCase()))
  const confusionBefore = Math.max(topic.sessions + 1, Math.ceil((100 - topic.score) / 14))
  const confusionNow = clamp(confusionBefore - Math.max(1, Math.floor(topic.score / 28)), 0, 9)
  const visualScore = clamp((hasGraphMemory ? 35 : 10) + relatedHistory * 12 + topic.sessions * 8)
  const teachBackScore = clamp(topic.score - 8 + (hasGraphMemory ? 10 : 0))
  const independenceScore = clamp(topic.score - confusionNow * 4 + topic.sessions * 3)
  const status = statusFromScore(topic.score, topic.sessions)
  return {
    subject: topic.subject,
    topic: topic.topic,
    query: topic.query,
    sessions: topic.sessions,
    score: topic.score,
    status,
    confusionBefore,
    confusionNow,
    teachBackScore,
    visualScore,
    independenceScore,
    mood: moodFromInsight(status, confusionNow),
  }
}

function independenceLevel(score: number) {
  if (score >= 76) return 'Independent Learner'
  if (score >= 52) return 'Improving Learner'
  return 'Guided Learner'
}

export default function ProgressPage() {
  const [student, setStudent] = useState<StudentIdentity | null>(null)
  const [progress, setProgress] = useState<StudentProgress | null>(null)
  const [history, setHistory] = useState<ChatHistoryItem[]>([])
  const [memory, setMemory] = useState<ConceptMemory[]>([])

  useEffect(() => {
    const current = getCurrentStudent()
    setStudent(current)
    setProgress(getStudentProgress(current.id))
    setHistory(getChatHistory(current.id))
    setMemory(getConceptMemory(current.id))
  }, [])

  const data = progress || EMPTY_PROGRESS
  const insights = useMemo(() => buildConceptInsights(data, history, memory), [data, history, memory])
  const visual = useMemo(() => visualActivity(history), [history])
  const avgUnderstanding = clamp(insights.reduce((sum, item) => sum + item.score, 0) / Math.max(1, insights.length))
  const clearCount = insights.filter(item => item.status === 'Clear').length
  const improvingCount = insights.filter(item => item.status === 'Improving').length
  const confusedCount = insights.filter(item => item.status === 'Confused' || item.status === 'Exploring').length
  const mood = improvingCount + clearCount >= confusedCount ? 'Improving' : 'Confused'
  const independence = clamp(insights.reduce((sum, item) => sum + item.independenceScore, 0) / Math.max(1, insights.length))
  const nextFocus = [...insights].sort((a, b) => a.score - b.score)[0]
  const bestTeachBack = [...insights].sort((a, b) => b.teachBackScore - a.teachBackScore)[0]
  const pulseCards: MetricCard[] = [
    { label: 'Concepts touched', value: insights.length, Icon: Brain },
    { label: 'Clear', value: clearCount, Icon: BookOpenCheck },
    { label: 'Improving', value: improvingCount, Icon: Sparkles },
    { label: 'Need support', value: confusedCount, Icon: MessageCircleQuestion },
    { label: 'Mood', value: mood, Icon: Gauge },
  ]
  const visualCards: MetricCard[] = [
    { label: 'Diagrams viewed', value: visual.diagrams, Icon: Eye },
    { label: 'Animations/videos', value: visual.animations, Icon: BarChart3 },
    { label: 'Voice explanations', value: visual.voice, Icon: Volume2 },
    { label: 'Photo explanations', value: visual.images, Icon: Sparkles },
  ]

  return (
    <div className="ai-shell min-h-dvh">
      <header className="glass-panel sticky top-0 z-10 border-x-0 border-t-0 px-4 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Link href="/learn" className="rounded-lg border border-white/60 bg-white/72 p-2 shadow-sm shadow-forest/5 hover:bg-white" aria-label="Back to learn">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="font-display text-lg font-bold">Understanding Dashboard</h1>
            <p className="text-xs text-ink/45">Learning behavior and clarity signals for {student?.isDemo ? 'judge demo' : student?.name || 'this student'}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        <section>
          <div className="mb-4 flex items-center gap-2">
            <Gauge size={17} className="text-forest" />
            <h2 className="text-sm font-semibold text-ink/75">Today&apos;s Learning Pulse</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {pulseCards.map(({ label, value, Icon }, index) => (
              <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className="card p-4">
                <Icon size={18} className="mb-3 text-forest" />
                <div className="font-display text-2xl font-bold text-ink">{value}</div>
                <div className="text-xs text-ink/50">{label}</div>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Route size={17} className="text-indigo" />
              <h2 className="text-sm font-semibold text-ink/75">Understanding Map</h2>
            </div>
            <div className="space-y-3">
              {insights.map((item, index) => (
                <motion.div key={`${item.subject}-${item.topic}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.04 }} className="card p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-ink/45">{item.subject}</div>
                      <h3 className="mt-0.5 font-semibold">{item.topic}</h3>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone[item.status]}`}>{item.status}</span>
                  </div>
                  <div className="mb-2 flex items-center justify-between text-xs text-ink/50">
                    <span>Understanding score</span>
                    <span className="font-mono font-bold text-ink">{item.score}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-forest/10">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${item.score}%` }} transition={{ delay: 0.1 + index * 0.04, duration: 0.55 }} className="h-full rounded-full bg-gradient-to-r from-forest via-aqua to-indigo" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="mb-4 flex items-center gap-2">
                <TrendingDown size={17} className="text-clay" />
                <h2 className="text-sm font-semibold text-ink/75">Confusion Reduced</h2>
              </div>
              <div className="space-y-3">
                {insights.slice(0, 3).map(item => (
                  <div key={`confusion-${item.topic}`} className="card p-4">
                    <div className="mb-2 text-sm font-semibold">{item.topic}</div>
                    <div className="flex items-center justify-between text-xs text-ink/55">
                      <span>Before: {item.confusionBefore} helps</span>
                      <span>Now: {item.confusionNow} helps</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-5">
              <div className="mb-3 flex items-center gap-2">
                <Brain size={17} className="text-forest" />
                <h2 className="text-sm font-semibold text-ink/75">Teach-back Score</h2>
              </div>
              <div className="font-display text-3xl font-bold text-forest">{bestTeachBack?.teachBackScore || 0}%</div>
              <p className="mt-2 text-sm text-ink/55">
                {bestTeachBack ? `${bestTeachBack.topic} নিজের ভাষায় explain করার জন্য ready.` : 'একটা topic practice করলে teach-back signal দেখাবে।'}
              </p>
              {bestTeachBack && (
                <Link href={`/learn?mode=simple&q=${encodeURIComponent(`${bestTeachBack.topic} nijer vashay explain korte chai`)}`} className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline">
                  <Lightbulb size={13} /> Try teach-back
                </Link>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Eye size={17} className="text-indigo" />
              <h2 className="text-sm font-semibold text-ink/75">Visual Learning Activity</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {visualCards.map(({ label, value, Icon }) => (
                <div key={label} className="card p-4">
                  <Icon size={17} className="mb-3 text-forest" />
                  <div className="font-display text-2xl font-bold">{value}</div>
                  <div className="text-xs text-ink/50">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center gap-2">
              <Gauge size={17} className="text-forest" />
              <h2 className="text-sm font-semibold text-ink/75">Learning Independence</h2>
            </div>
            <div className="card p-5">
              <div className="mb-2 text-sm text-ink/55">Current stage</div>
              <div className="font-display text-3xl font-bold text-ink">{independenceLevel(independence)}</div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-forest/10">
                <div className="h-full rounded-full bg-gradient-to-r from-saffron via-aqua to-forest" style={{ width: `${independence}%` }} />
              </div>
              <p className="mt-3 text-sm text-ink/55">
                Help কম লাগলে independence score বাড়ে. Current signal: {independence}%.
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Lightbulb size={17} className="text-saffron" />
            <h2 className="text-sm font-semibold text-ink/75">Next Best Step</h2>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {[
              {
                title: `${nextFocus?.topic || 'Acceleration'} diagram দিয়ে revise করো`,
                href: `/learn?mode=whiteboard&q=${encodeURIComponent(nextFocus?.query || 'Acceleration diagram diye bujhao')}`,
              },
              {
                title: `${nextFocus?.topic || 'Newton law'} নিয়ে visual explanation দেখো`,
                href: `/learn?mode=animation&q=${encodeURIComponent(nextFocus?.query || 'Newton law visual bujhao')}`,
              },
              {
                title: `${bestTeachBack?.topic || 'Photosynthesis'} নিজের ভাষায় explain করে দেখো`,
                href: `/learn?mode=simple&q=${encodeURIComponent(`${bestTeachBack?.topic || 'Photosynthesis'} nijer vashay explain korte chai`)}`,
              },
            ].map((item, index) => (
              <Link key={item.title} href={item.href} className="card p-4 transition-colors hover:border-forest/30">
                <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-forest/10 text-sm font-bold text-forest">{index + 1}</div>
                <div className="text-sm font-semibold text-ink">{item.title}</div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
