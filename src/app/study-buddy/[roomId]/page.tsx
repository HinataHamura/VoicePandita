'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, Sparkles, WifiOff } from 'lucide-react'
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

export default function StudyBuddyRoomPage() {
  const params = useParams<{ roomId: string }>()
  const search = useSearchParams()
  const demoQuery = search.get('demo') === '1' ? `?demo=1&topic=${encodeURIComponent(search.get('topic') || 'Bondhu Study Room')}` : ''
  const { data, loading, error, refresh } = useStudyRoom(params.roomId, demoQuery)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [hintFor, setHintFor] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [solo, setSolo] = useState(false)
  const [waitExpired, setWaitExpired] = useState(false)
  const [localStep, setLocalStep] = useState(0)

  useEffect(() => {
    const timer = window.setTimeout(() => setWaitExpired(true), 90000)
    return () => window.clearTimeout(timer)
  }, [])

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
      setLocalStep(step => Math.min(step + 1, data?.questions.length || 5))
      return
    }
    await fetch(`/api/study-buddy/room/${params.roomId}/next`, { method: 'POST' })
    await refresh()
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
        <Loader2 className="animate-spin text-forest" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="ai-shell flex min-h-dvh items-center justify-center px-4">
        <div className="rounded-3xl border border-red-100 bg-white/85 p-6 text-center shadow-xl">
          <WifiOff className="mx-auto mb-3 text-red-500" />
          <h1 className="font-display text-xl font-bold">Room load করা যায়নি</h1>
          <p className="mt-2 text-sm text-ink/55">{error || 'Please reconnect and try again.'}</p>
        </div>
      </div>
    )
  }

  const activeMembers = data.members.filter(member => member.member_status === 'active')
  const roomStatus = solo ? 'active' : data.room.room_status
  const totalQuestions = data.questions.length || 5
  const localScore = data.questions.filter(question => selected[question.id] === question.correct_answer.id).length
  const weakConcepts = data.questions
    .filter(question => selected[question.id] && selected[question.id] !== question.correct_answer.id)
    .map(question => question.concept_tag || question.prompt_bn.slice(0, 48))
  const explainedCount = data.messages.filter(message => message.message_type === 'explanation').length
  const currentIndex = demoQuery
    ? Math.min(localStep, Math.max(0, totalQuestions - 1))
    : Math.min(explainedCount, Math.max(0, totalQuestions - 1))
  const currentQuestion = data.questions[currentIndex]
  const currentAnsweredCount = currentQuestion
    ? data.answers.filter(answer => answer.question_id === currentQuestion.id).length + (demoQuery && selected[currentQuestion.id] ? 1 : 0)
    : 0
  const completed = roomStatus === 'completed' || (demoQuery ? localStep >= totalQuestions : explainedCount >= totalQuestions)
  const latestAiMessage = [...data.messages].reverse().find(message => message.sender_type === 'ai_host')

  return (
    <div className="ai-shell min-h-dvh">
      <StudyRoomHeader topicTitle={data.room.topic_title} status={roomStatus} memberCount={activeMembers.length || 1} />
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
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
              score={demoQuery ? localScore : undefined}
              total={demoQuery ? totalQuestions : undefined}
              weakConcepts={weakConcepts}
            />
          ) : (
            <>
              <AIHostMessage>
                {latestAiMessage?.safe_content || latestAiMessage?.content || 'ব্যক্তিগত তথ্য শেয়ার করো না। চলো concept বুঝে practice করি।'}
              </AIHostMessage>
              <StudyRoomProgress current={currentIndex + 1} total={totalQuestions} />
              {currentQuestion && (
                <StudyQuestionCard
                  question={currentQuestion}
                  selected={selected[currentQuestion.id]}
                  answeredCount={currentAnsweredCount}
                  memberCount={Math.max(1, activeMembers.length)}
                  showHint={hintFor === currentQuestion.id}
                  submitting={submitting}
                  onHint={() => setHintFor(currentQuestion.id)}
                  onSelect={optionId => submitAnswer(currentQuestion.id, optionId)}
                />
              )}
              {!currentQuestion && (
                <div className="rounded-3xl border border-white/60 bg-white/82 p-5 shadow-xl shadow-forest/10 backdrop-blur-xl">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-forest">
                    <Sparkles size={16} />
                    Preparing concept checks
                  </div>
                  <p className="bangla text-sm leading-6 text-ink/60">
                    AI host এই room-এর প্রশ্ন বানাচ্ছে। কয়েক সেকেন্ড পরও না এলে refresh চাপো।
                  </p>
                  <button
                    type="button"
                    onClick={refresh}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white/75 px-4 py-2 text-sm font-semibold text-forest shadow-sm hover:bg-white"
                  >
                    <Loader2 size={14} />
                    Refresh room
                  </button>
                </div>
              )}
              {currentQuestion && selected[currentQuestion.id] && (
                <button type="button" onClick={nextStep} className="rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white">
                  {currentIndex + 1 >= totalQuestions ? 'Finish room' : 'Next concept check'}
                </button>
              )}
              <QuickReactionBar onReact={() => undefined} />
            </>
          )}
        </div>
        <aside className="space-y-4">
          <StudyRoomLeaderboard members={activeMembers} answers={data.answers} />
          <div className="rounded-3xl border border-white/60 bg-white/75 p-4 text-sm text-ink/60">
            <p className="bangla leading-6">Child-safe v1: free chat বন্ধ। Quick reactions আর guided answers allowed.</p>
            <div className="mt-3">
              <ReportUserDialog onReport={reportRoom} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
