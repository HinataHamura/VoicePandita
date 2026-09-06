'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import AIHostMessage from '@/components/study-buddy/AIHostMessage'
import QuickReactionBar from '@/components/study-buddy/QuickReactionBar'
import ReportUserDialog from '@/components/study-buddy/ReportUserDialog'
import StudyQuestionCard from '@/components/study-buddy/StudyQuestionCard'
import StudyRoomHeader from '@/components/study-buddy/StudyRoomHeader'
import StudyRoomLeaderboard from '@/components/study-buddy/StudyRoomLeaderboard'
import StudyRoomProgress from '@/components/study-buddy/StudyRoomProgress'
import StudyRoomSummary from '@/components/study-buddy/StudyRoomSummary'
import StudyRoomWaiting from '@/components/study-buddy/StudyRoomWaiting'
import { useStudyRoom } from '@/hooks/useStudyRoom'
import { recordStudyRoomResult } from '@/lib/studentStore'

export default function StudyBuddyRoomPage() {
  const params = useParams<{ roomId: string }>()
  const search = useSearchParams()
  const demoQuery = search.get('demo') === '1'
    ? `?demo=1&topic=${encodeURIComponent(search.get('topic') || 'Bondhu Study Room')}`
    : ''
  const { data, loading, error, refresh } = useStudyRoom(params.roomId, demoQuery)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [hintFor, setHintFor] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [nexting, setNexting] = useState(false)
  const [solo, setSolo] = useState(false)
  const [waitExpired, setWaitExpired] = useState(false)
  const [localStep, setLocalStep] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setWaitExpired(true), 90_000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (demoQuery || !data) return
    const questions = data.questions
    if (!questions.length) return
    const explained = data.messages.filter(m => m.message_type === 'explanation').length
    const isComplete = data.room.room_status === 'completed' || explained >= questions.length
    if (!isComplete) return

    recordStudyRoomResult({
      roomId: params.roomId,
      topicTitle: data.room.topic_title,
      score: questions.filter(q => selected[q.id] === q.correct_answer.id).length,
      total: questions.length,
      weakConcepts: questions
        .filter(q => selected[q.id] && selected[q.id] !== q.correct_answer.id)
        .map(q => q.concept_tag || q.prompt_bn.slice(0, 48)),
    })
  }, [data, demoQuery, params.roomId, selected])

  async function submitAnswer(questionId: string, optionId: string) {
    setSelected(prev => ({ ...prev, [questionId]: optionId }))
    if (demoQuery) return
    setSubmitting(true)
    try {
      await fetch(`/api/study-buddy/room/${params.roomId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer: { id: optionId } }),
      })
      await refresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function nextStep() {
    if (demoQuery) {
      setLocalStep(s => Math.min(s + 1, data?.questions.length || 5))
      return
    }
    setNexting(true)
    try {
      await fetch(`/api/study-buddy/room/${params.roomId}/next`, { method: 'POST' })
      await refresh()
    } finally {
      setNexting(false)
    }
  }

  async function reportRoom() {
    if (demoQuery) return
    await fetch(`/api/study-buddy/room/${params.roomId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'unsafe_behavior' }),
    })
  }

  if (loading) {
    return (
      <div className="ai-shell flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-ink/50">
          <div className="flex gap-1.5">
            <span className="thinking-dot" />
            <span className="thinking-dot" />
            <span className="thinking-dot" />
          </div>
          <span className="text-sm font-semibold">Room load হচ্ছে…</span>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="ai-shell flex min-h-dvh items-center justify-center px-4">
        <div className="rounded-3xl border border-red-100 bg-white/85 p-6 text-center shadow-xl">
          <WifiOff className="mx-auto mb-3 text-red-500" />
          <h1 className="font-display text-xl font-bold">Room load করা যায়নি</h1>
          <p className="mt-2 text-sm text-ink/55">{error || 'Please reconnect and try again.'}</p>
          <button onClick={refresh} className="mt-4 rounded-xl bg-forest px-4 py-2 text-sm font-bold text-white">
            আবার চেষ্টা করো
          </button>
        </div>
      </div>
    )
  }

  const activeMembers = data.members.filter(m => m.member_status === 'active')
  const roomStatus = solo ? 'active' : data.room.room_status
  const totalQuestions = data.questions.length || 5
  const localScore = data.questions.filter(q => selected[q.id] === q.correct_answer.id).length
  const weakConcepts = data.questions
    .filter(q => selected[q.id] && selected[q.id] !== q.correct_answer.id)
    .map(q => q.concept_tag || q.prompt_bn.slice(0, 48))
  const explainedCount = data.messages.filter(m => m.message_type === 'explanation').length
  const currentIndex = demoQuery
    ? Math.min(localStep, Math.max(0, totalQuestions - 1))
    : Math.min(explainedCount, Math.max(0, totalQuestions - 1))
  const currentQuestion = data.questions[currentIndex]
  const currentAnsweredCount = currentQuestion
    ? data.answers.filter(a => a.question_id === currentQuestion.id).length +
      (demoQuery && selected[currentQuestion.id] ? 1 : 0)
    : 0
  const completed =
    roomStatus === 'completed' ||
    (demoQuery ? localStep >= totalQuestions : explainedCount >= totalQuestions)
  const latestAiMessage = [...data.messages].reverse().find(m => m.sender_type === 'ai_host')
  const hasAnswered = currentQuestion ? Boolean(selected[currentQuestion.id]) : false
  const isLastQuestion = currentIndex + 1 >= totalQuestions

  return (
    <div className="ai-shell min-h-dvh">
      <StudyRoomHeader
        topicTitle={data.room.topic_title}
        status={roomStatus}
        memberCount={activeMembers.length || 1}
      />

      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          {roomStatus === 'waiting' && !solo ? (
            <StudyRoomWaiting
              topicTitle={data.room.topic_title}
              members={activeMembers}
              minMembers={data.room.min_members}
              waitExpired={waitExpired}
              onSolo={() => setSolo(true)}
            />
          ) : completed ? (
            <StudyRoomSummary
              topicTitle={data.room.topic_title}
              score={localScore}
              total={totalQuestions}
              weakConcepts={weakConcepts}
            />
          ) : (
            <>
              {/* AI host message */}
              <AIHostMessage>
                {latestAiMessage?.safe_content ||
                  latestAiMessage?.content ||
                  'ব্যক্তিগত তথ্য শেয়ার করো না। চলো concept বুঝে practice করি।'}
              </AIHostMessage>

              {/* Progress */}
              <StudyRoomProgress current={currentIndex + 1} total={totalQuestions} />

              {/* Question */}
              <AnimatePresence mode="wait">
                {currentQuestion ? (
                  <motion.div key={currentQuestion.id}>
                    <StudyQuestionCard
                      question={currentQuestion}
                      selected={selected[currentQuestion.id]}
                      answeredCount={currentAnsweredCount}
                      memberCount={Math.max(1, activeMembers.length)}
                      showHint={hintFor === currentQuestion.id}
                      submitting={submitting}
                      questionNumber={currentIndex + 1}
                      totalQuestions={totalQuestions}
                      onHint={() => setHintFor(currentQuestion.id)}
                      onSelect={optionId => submitAnswer(currentQuestion.id, optionId)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="loading-q"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="rounded-3xl border border-white/60 bg-white/82 p-6 shadow-xl backdrop-blur-xl"
                  >
                    <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-forest">
                      <RefreshCw size={15} className="animate-spin" />
                      AI প্রশ্ন তৈরি করছে…
                    </div>
                    <p className="bangla text-sm text-ink/55">কয়েক সেকেন্ড পরও না এলে refresh করো।</p>
                    <button
                      type="button"
                      onClick={refresh}
                      className="mt-4 inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-4 py-2 text-sm font-semibold text-forest hover:bg-white"
                    >
                      <RefreshCw size={14} />
                      Refresh
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Next button */}
              <AnimatePresence>
                {hasAnswered && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <motion.button
                      type="button"
                      onClick={nextStep}
                      disabled={nexting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-forest to-indigo px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-forest/20 disabled:opacity-60"
                    >
                      {nexting ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : isLastQuestion ? (
                        <CheckCircle2 size={16} />
                      ) : (
                        <ArrowRight size={16} />
                      )}
                      {nexting
                        ? 'লোড হচ্ছে…'
                        : isLastQuestion
                        ? 'Room শেষ করো'
                        : 'পরের concept check →'}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              <QuickReactionBar onReact={() => undefined} />
            </>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-4">
          <StudyRoomLeaderboard members={activeMembers} answers={data.answers} />
          <div className="rounded-3xl border border-white/60 bg-white/75 p-4 text-sm text-ink/60">
            <p className="bangla leading-6">
              Child-safe v1: free chat বন্ধ। Quick reactions আর guided answers allowed।
            </p>
            <div className="mt-3">
              <ReportUserDialog onReport={reportRoom} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
