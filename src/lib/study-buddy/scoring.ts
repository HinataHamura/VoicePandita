import type { StudyRoomAnswer } from './types'

export function isCorrectAnswer(answer: { id?: string }, correctAnswer: { id?: string }) {
  return String(answer?.id || '').trim().toUpperCase() === String(correctAnswer?.id || '').trim().toUpperCase()
}

export function scoreAnswer(params: { isCorrect: boolean; isFirstCorrect?: boolean; usedHint?: boolean }) {
  let score = 2
  if (params.isCorrect) score += 10
  if (params.isCorrect && params.isFirstCorrect) score += 3
  if (params.usedHint) score -= 2
  return Math.max(0, score)
}

export function buildLeaderboard(answers: StudyRoomAnswer[], aliases: Map<string, string>) {
  const scores = new Map<string, number>()
  for (const answer of answers) {
    scores.set(answer.anonymous_session_id, (scores.get(answer.anonymous_session_id) || 0) + scoreAnswer({ isCorrect: answer.is_correct }))
  }
  return Array.from(scores.entries())
    .map(([sessionId, score]) => ({ sessionId, alias: aliases.get(sessionId) || 'Bondhu', score }))
    .sort((a, b) => b.score - a.score)
}
