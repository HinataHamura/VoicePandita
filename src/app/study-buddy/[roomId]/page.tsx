'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, WifiOff } from 'lucide-react'
import AIHostMessage from '@/components/study-buddy/AIHostMessage'
import ConceptDependencyMap from '@/components/study-buddy/ConceptDependencyMap'
import ConfettiBurst from '@/components/study-buddy/ConfettiBurst'
import QuickReactionBar from '@/components/study-buddy/QuickReactionBar'
import ReportUserDialog from '@/components/study-buddy/ReportUserDialog'
import StudyExplanationPanel from '@/components/study-buddy/StudyExplanationPanel'
import StudyQuestionCard from '@/components/study-buddy/StudyQuestionCard'
import StudyRoomDiscussion from '@/components/study-buddy/StudyRoomDiscussion'
import StudyRoomHeader from '@/components/study-buddy/StudyRoomHeader'
import StudyRoomLeaderboard from '@/components/study-buddy/StudyRoomLeaderboard'
import StudyRoomProgress from '@/components/study-buddy/StudyRoomProgress'
import StudyRoomSummary from '@/components/study-buddy/StudyRoomSummary'
import StudyRoomWaiting from '@/components/study-buddy/StudyRoomWaiting'
import { useStudyRoom } from '@/hooks/useStudyRoom'
import type { StudyRoomMessage, StudyRoomQuestion } from '@/lib/study-buddy/types'

const WAIT_TIMEOUT_MS = 90000
const AUTO_HINT_MS = 30000

function isCorrect(question: StudyRoomQuestion, optionId: string) {
  return question.correct_answer.id.toUpperCase() === optionId.toUpperCase()
}

function sortAdaptiveQuestions(questions: StudyRoomQuestion[], results: Record<string, boolean>) {
  const base = [...questions].sort((a, b) => a.question_order - b.question_order)
  const firstTwoCorrect = base.slice(0, 2).length === 2 && base.slice(0, 2).every(question => results[question.id] === true)
  if (!firstTwoCorrect) return base

  const answered = base.filter(question => results[question.id] !== undefined)
  const remaining = base
    .filter(question => results[question.id] === undefined)
    .sort((a, b) => {
      if (a.difficulty !== b.difficulty) return a.difficulty === 'medium' ? -1 : 1
      return a.question_order - b.question_order
    })
  return [...answered, ...remaining]
}

function updateStudyBuddyStreak() {
  const today = new Date().toISOString().slice(0, 10)
  const stored = window.localStorage.getItem('vp_study_buddy_streak')
  const parsed = stored ? JSON.parse(stored) as { lastDate?: string; count?: number } : {}
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const count = parsed.lastDate === today
    ? parsed.count || 1
    : parsed.lastDate === yesterday
      ? (parsed.count || 1) + 1
      : 1
  window.localStorage.setItem('vp_study_buddy_streak', JSON.stringify({ lastDate: today, count }))
  return count
}

export default function StudyBuddyRoomPage() {
  const params = useParams<{ roomId: string }>()
  const search = useSearchParams()
  const demoQuery = search.get('demo') === '1' ? `?demo=1&topic=${encodeURIComponent(search.get('topic') || 'Bondhu Study Room')}` : ''
  const { data, loading, error, refresh } = useStudyRoom(params.roomId, demoQuery)
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [answerResults, setAnswerResults] = useState<Record<string, boolean>>({})
  const [currentIndex, setCurrentIndex] = useState(0)
  const [hintFor, setHintFor] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [solo, setSolo] = useState(Boolean(demoQuery))
  const [waitExpired, setWaitExpired] = useState(Boolean(demoQuery))
  const [actionError, setActionError] = useState('')
  const [chatError, setChatError] = useState('')
  const [localMessages, setLocalMessages] = useState<StudyRoomMessage[]>([])
  const [showConfetti, setShowConfetti] = useState(false)
  const [streakDays, setStreakDays] = useState(1)
  const [streakSaved, setStreakSaved] = useState(false)

  useEffect(() => {
    if (demoQuery) return
    const timer = window.setTimeout(() => setWaitExpired(true), WAIT_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [demoQuery])

  const adaptiveQuestions = useMemo(
    () => sortAdaptiveQuestions(data?.questions || [], answerResults),
    [data?.questions, answerResults],
  )
  const totalQuestions = adaptiveQuestions.length || 5
  const activeMembers = data?.members.filter(member => member.member_status === 'active') || []
  const roomStatus = solo ? 'active' : data?.room.room_status
  const currentQuestion = adaptiveQuestions[currentIndex]
  const currentSelected = currentQuestion ? selected[currentQuestion.id] : undefined
  const currentAnswered = currentQuestion ? Boolean(currentSelected || answerResults[currentQuestion.id] !== undefined) : false
  const completed = roomStatus === 'completed' || (Boolean(adaptiveQuestions.length) && currentIndex >= totalQuestions)
  const latestAiMessage = [...(data?.messages || [])].reverse().find(message => message.sender_type === 'ai_host')

  useEffect(() => {
    if (!currentQuestion || currentAnswered) return
    setHintFor(null)
    const timer = window.setTimeout(() => setHintFor(currentQuestion.id), AUTO_HINT_MS)
    return () => window.clearTimeout(timer)
  }, [currentQuestion, currentAnswered])

  useEffect(() => {
    if (!completed || streakSaved) return
    setStreakDays(updateStudyBuddyStreak())
    setStreakSaved(true)
  }, [completed, streakSaved])

  async function submitAnswer(questionId: string, optionId: string) {
    const question = adaptiveQuestions.find(item => item.id === questionId)
    if (!question || selected[questionId] || submitting) return

    setSelected(prev => ({ ...prev, [questionId]: optionId }))
    setActionError('')

    if (demoQuery || solo) {
      const correct = isCorrect(question, optionId)
      setAnswerResults(prev => ({ ...prev, [questionId]: correct }))
      if (correct) {
        setShowConfetti(true)
        window.setTimeout(() => setShowConfetti(false), 950)
      }
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/study-buddy/room/${params.roomId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId, answer: { id: optionId } }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Answer submit failed')
      setAnswerResults(prev => ({ ...prev, [questionId]: Boolean(json.isCorrect) }))
      if (json.isCorrect) {
        setShowConfetti(true)
        window.setTimeout(() => setShowConfetti(false), 950)
      }
      await refresh()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Answer submit failed')
    } finally {
      setSubmitting(false)
    }
  }

  async function nextStep() {
    setActionError('')
    if (!currentQuestion) return

    if (!demoQuery && !solo) {
      const res = await fetch(`/api/study-buddy/room/${params.roomId}/next`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setActionError(json.error || 'Could not move to next question')
        return
      }
      await refresh()
    }

    setHintFor(null)
    setCurrentIndex(index => index + 1)
  }

  async function startSoloPractice() {
    setSolo(true)
    setWaitExpired(true)
    if (demoQuery) return

    const res = await fetch(`/api/study-buddy/room/${params.roomId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ solo: true }),
    })
    if (res.ok) await refresh()
  }

  async function reportRoom() {
    if (demoQuery) return
    await fetch(`/api/study-buddy/room/${params.roomId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'unsafe_behavior' }),
    })
  }

  async function sendDiscussionMessage(content: string) {
    setChatError('')
    if (demoQuery || solo) {
      setLocalMessages(messages => [...messages, {
        id: crypto.randomUUID(),
        room_id: params.roomId,
        sender_type: 'student',
        sender_session_id: 'local',
        message_type: 'text',
        content,
        safe_content: content,
        metadata: { local: true },
        created_at: new Date().toISOString(),
      }])
      return
    }

    const res = await fetch(`/api/study-buddy/room/${params.roomId}/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setChatError(json.error || 'Message পাঠানো যায়নি')
      return
    }
    await refresh()
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

  return (
    <div className="ai-shell min-h-dvh">
      <ConfettiBurst show={showConfetti} />
      <StudyRoomHeader topicTitle={data.room.topic_title} status={roomStatus || 'waiting'} memberCount={activeMembers.length || 1} />
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {roomStatus === 'waiting' && !solo ? (
            <StudyRoomWaiting
              topicTitle={data.room.topic_title}
              members={activeMembers}
              minMembers={data.room.min_members}
              waitExpired={waitExpired}
              onSolo={startSoloPractice}
            />
          ) : completed ? (
            <StudyRoomSummary
              topicTitle={data.room.topic_title}
              questions={adaptiveQuestions}
              results={answerResults}
              members={activeMembers}
              streakDays={streakDays}
            />
          ) : (
            <>
              <AIHostMessage>
                {latestAiMessage?.safe_content || latestAiMessage?.content || 'ব্যক্তিগত তথ্য শেয়ার করো না। চলো concept বুঝে practice করি।'}
              </AIHostMessage>
              <StudyRoomProgress current={Math.min(currentIndex + 1, totalQuestions)} total={totalQuestions} />
              {currentQuestion && (
                <StudyQuestionCard
                  question={currentQuestion}
                  selected={currentSelected}
                  revealAnswer={currentAnswered}
                  answeredCount={(data.answers.filter(answer => answer.question_id === currentQuestion.id).length || 0) + (currentSelected ? 1 : 0)}
                  memberCount={Math.max(1, activeMembers.length)}
                  showHint={hintFor === currentQuestion.id}
                  submitting={submitting}
                  onHint={() => setHintFor(currentQuestion.id)}
                  onSelect={optionId => submitAnswer(currentQuestion.id, optionId)}
                />
              )}
              {currentQuestion && currentAnswered && (
                <StudyExplanationPanel
                  question={currentQuestion}
                  selected={currentSelected}
                  isCorrect={answerResults[currentQuestion.id]}
                  onNext={nextStep}
                  isLast={currentIndex + 1 >= totalQuestions}
                />
              )}
              {actionError && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</p>}
              <QuickReactionBar onReact={sendDiscussionMessage} />
            </>
          )}
        </div>
        <aside className="space-y-4">
          <StudyRoomLeaderboard members={activeMembers} answers={data.answers} />
          <ConceptDependencyMap topicTitle={data.room.topic_title} activeIndex={Math.min(currentIndex, 4)} />
          <StudyRoomDiscussion
            messages={[...data.messages, ...localMessages]}
            disabled={roomStatus === 'waiting' && !solo}
            error={chatError}
            onSend={sendDiscussionMessage}
          />
          <div className="rounded-3xl border border-white/60 bg-white/75 p-4 text-sm text-ink/60">
            <p className="bangla leading-6">Child-safe discussion: topic chat on আছে। Phone, link, social id, abusive কথা block হবে।</p>
            <div className="mt-3">
              <ReportUserDialog onReport={reportRoom} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
