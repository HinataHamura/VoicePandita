'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Loader2, WifiOff } from 'lucide-react'
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
    if (demoQuery) return
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
  const currentIndex = Math.min(Object.keys(selected).length || data.answers.length, Math.max(0, data.questions.length - 1))
  const currentQuestion = data.questions[currentIndex]
  const completed = roomStatus === 'completed' || Object.keys(selected).length >= 5
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
            <StudyRoomSummary topicTitle={data.room.topic_title} />
          ) : (
            <>
              <AIHostMessage>
                {latestAiMessage?.safe_content || latestAiMessage?.content || 'Personal info share করো না। চলো concept বুঝে practice করি।'}
              </AIHostMessage>
              <StudyRoomProgress current={currentIndex + 1} total={5} />
              {currentQuestion && (
                <StudyQuestionCard
                  question={currentQuestion}
                  selected={selected[currentQuestion.id]}
                  answeredCount={data.answers.filter(answer => answer.question_id === currentQuestion.id).length}
                  memberCount={Math.max(1, activeMembers.length)}
                  showHint={hintFor === currentQuestion.id}
                  submitting={submitting}
                  onHint={() => setHintFor(currentQuestion.id)}
                  onSelect={optionId => submitAnswer(currentQuestion.id, optionId)}
                />
              )}
              {currentQuestion && selected[currentQuestion.id] && (
                <button type="button" onClick={nextStep} className="rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white">
                  Explanation / next
                </button>
              )}
              <QuickReactionBar onReact={() => undefined} />
            </>
          )}
        </div>
        <aside className="space-y-4">
          <StudyRoomLeaderboard members={activeMembers} answers={data.answers} />
          <div className="rounded-3xl border border-white/60 bg-white/75 p-4 text-sm text-ink/60">
            <p className="bangla leading-6">Child-safe v1: free chat বন্ধ। Quick reactions আর answers allowed.</p>
            <div className="mt-3">
              <ReportUserDialog onReport={reportRoom} />
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
