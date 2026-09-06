'use client'

import type { StudentProfile, Subject } from '@/types'

export interface StudentIdentity {
  id: string
  email: string
  name: string
  isDemo?: boolean
  isGuest?: boolean
}

export interface TopicProgress {
  subject: string
  topic: string
  score: number
  sessions: number
  query: string
}

export interface StudentProgress {
  questions: number
  avgScore: number
  badges: number
  streak: number
  sessions: number
  accuracy: number
  focusTopics: number
  weakTopics: TopicProgress[]
  strongTopics: Omit<TopicProgress, 'sessions' | 'query'>[]
}

export interface ConceptMemory {
  id: string
  question: string
  subject: string
  graphPath: string[]
  createdAt: string
}

export interface ChatHistoryItem {
  id: string
  question: string
  answer: string
  subject: string
  outputMode: string
  language: string
  graphPath?: string[]
  source?: string
  createdAt: string
}

export const DEMO_EMAIL = 'demo@voicepandita.app'
export const DEMO_PASSWORD = 'Demo@1234'

export const DEMO_STUDENT: StudentIdentity = {
  id: 'demo-student-hsc-admission',
  email: DEMO_EMAIL,
  name: 'Nusrat Jahan',
  isDemo: true,
}

export const DEMO_PROFILE: StudentProfile = {
  level: 'hsc',
  goal: 'admission',
  group: 'science',
}

const DEMO_PROGRESS: StudentProgress = {
  questions: 47,
  avgScore: 82,
  badges: 4,
  streak: 7,
  sessions: 15,
  accuracy: 82,
  focusTopics: 4,
  weakTopics: [
    { subject: 'Physics', topic: 'Force and acceleration', score: 38, sessions: 4, query: 'Newton-er 2nd law bujhi na' },
    { subject: 'Chemistry', topic: 'Ionic bonding', score: 45, sessions: 3, query: 'ionic bond bujhao' },
    { subject: 'Biology', topic: 'Photosynthesis', score: 51, sessions: 6, query: 'photosynthesis explain koro' },
    { subject: 'Math', topic: 'Quadratic equation', score: 62, sessions: 2, query: 'quadratic formula bujhao' },
  ],
  strongTopics: [
    { subject: 'Physics', topic: 'Motion basics', score: 91 },
    { subject: 'Biology', topic: 'Food chain', score: 88 },
    { subject: 'English', topic: 'Simple sentence', score: 85 },
  ],
}

const DEFAULT_PROGRESS: StudentProgress = {
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

const subjectLabels: Record<Subject | string, string> = {
  physics: 'Physics',
  chemistry: 'Chemistry',
  biology: 'Biology',
  math: 'Math',
  bangla: 'Bangla',
  english: 'English',
}

const topicBySubject: Record<Subject | string, { topic: string; query: string }> = {
  physics: { topic: 'Force and acceleration', query: 'Newton-er 2nd law bujhi na' },
  chemistry: { topic: 'Ionic bonding', query: 'ionic bond bujhao' },
  biology: { topic: 'Photosynthesis', query: 'photosynthesis explain koro' },
  math: { topic: 'Quadratic equation', query: 'quadratic formula bujhao' },
  bangla: { topic: 'Creative question answer', query: 'srijonshil uttor kivabe likhbo' },
  english: { topic: 'Simple sentence', query: 'simple sentence practice korte chai' },
}

function canUseStorage() {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

function readJson<T>(key: string, fallback: T): T {
  if (!canUseStorage()) return fallback
  try {
    const saved = localStorage.getItem(key)
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  if (!canUseStorage()) return
  localStorage.setItem(key, JSON.stringify(value))
}

export function getCurrentStudent(): StudentIdentity {
  if (!canUseStorage()) {
    return { id: 'guest-server', email: 'guest@voicepandita.local', name: 'Guest Student', isGuest: true }
  }
  const saved = localStorage.getItem('vp_current_student')
  if (saved) {
    try {
      return JSON.parse(saved)
    } catch {
      localStorage.removeItem('vp_current_student')
    }
  }
  const guestId = localStorage.getItem('vp_session_id') || crypto.randomUUID()
  localStorage.setItem('vp_session_id', guestId)
  return { id: `guest-${guestId}`, email: 'guest@voicepandita.local', name: 'Guest Student', isGuest: true }
}

export function setCurrentStudent(student: StudentIdentity) {
  writeJson('vp_current_student', student)
  localStorage.setItem('vp_session_id', student.id)
  document.cookie = `vp_student_id=${encodeURIComponent(student.id)}; path=/; max-age=2592000; samesite=lax`
}

export function startDemoStudent() {
  setCurrentStudent(DEMO_STUDENT)
  if (!localStorage.getItem(profileKey(DEMO_STUDENT.id))) saveStudentProfile(DEMO_PROFILE, DEMO_STUDENT.id)
  if (!localStorage.getItem(progressKey(DEMO_STUDENT.id))) saveStudentProgress(DEMO_PROGRESS, DEMO_STUDENT.id)
}

export function startGuestStudent() {
  const id = crypto.randomUUID()
  setCurrentStudent({ id: `guest-${id}`, email: 'guest@voicepandita.local', name: 'Guest Student', isGuest: true })
}

export function profileKey(studentId = getCurrentStudent().id) {
  return `vp_profile:${studentId}`
}

export function progressKey(studentId = getCurrentStudent().id) {
  return `vp_progress:${studentId}`
}

export function conceptMemoryKey(studentId = getCurrentStudent().id) {
  return `vp_concept_memory:${studentId}`
}

export function chatHistoryKey(studentId = getCurrentStudent().id) {
  return `vp_chat_history:${studentId}`
}

export function getStudentProfile(studentId?: string): Partial<StudentProfile> {
  const key = profileKey(studentId)
  const fallback = studentId === DEMO_STUDENT.id || getCurrentStudent().isDemo ? DEMO_PROFILE : {}
  return readJson<Partial<StudentProfile>>(key, fallback)
}

export function saveStudentProfile(profile: Partial<StudentProfile>, studentId?: string) {
  writeJson(profileKey(studentId), profile)
}

export function isStudentProfileComplete(profile: Partial<StudentProfile>) {
  return Boolean(profile.level && profile.goal && profile.group)
}

export function getStudentProgress(studentId?: string): StudentProgress {
  const key = progressKey(studentId)
  const fallback = studentId === DEMO_STUDENT.id || getCurrentStudent().isDemo ? DEMO_PROGRESS : DEFAULT_PROGRESS
  return readJson<StudentProgress>(key, fallback)
}

export function saveStudentProgress(progress: StudentProgress, studentId?: string) {
  writeJson(progressKey(studentId), progress)
}

export function getConceptMemory(studentId?: string): ConceptMemory[] {
  if (!canUseStorage()) return []
  try {
    const saved = localStorage.getItem(conceptMemoryKey(studentId))
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export function recordConceptMemory(question: string, subject: string, graphPath?: string[]) {
  if (!graphPath?.length) return
  const memory = getConceptMemory()
  const signature = `${subject}:${graphPath.join('>')}`.toLowerCase()
  const withoutDuplicate = memory.filter(item => `${item.subject}:${item.graphPath.join('>')}`.toLowerCase() !== signature)
  const next: ConceptMemory[] = [
    {
      id: crypto.randomUUID(),
      question,
      subject,
      graphPath,
      createdAt: new Date().toISOString(),
    },
    ...withoutDuplicate,
  ].slice(0, 25)
  writeJson(conceptMemoryKey(), next)
}

export function getChatHistory(studentId?: string): ChatHistoryItem[] {
  if (!canUseStorage()) return []
  try {
    const saved = localStorage.getItem(chatHistoryKey(studentId))
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export function recordChatHistory(item: Omit<ChatHistoryItem, 'id' | 'createdAt'>) {
  const history = getChatHistory()
  const next: ChatHistoryItem[] = [
    {
      id: crypto.randomUUID(),
      ...item,
      createdAt: new Date().toISOString(),
    },
    ...history,
  ].slice(0, 100)
  writeJson(chatHistoryKey(), next)
}

export function clearChatHistory(studentId?: string) {
  if (!canUseStorage()) return
  localStorage.removeItem(chatHistoryKey(studentId))
}

export function recordPractice(subject: string, question: string) {
  const progress = getStudentProgress()
  const topic = topicBySubject[subject] || { topic: 'New concept', query: question }
  const subjectLabel = subjectLabels[subject] || subject
  const weakTopics = [...progress.weakTopics]
  const existing = weakTopics.find(item => item.subject === subjectLabel && item.topic === topic.topic)
  if (existing) {
    existing.sessions += 1
    existing.query = question || existing.query
    existing.score = Math.min(95, existing.score + 3)
  } else {
    weakTopics.unshift({ subject: subjectLabel, topic: topic.topic, score: 35, sessions: 1, query: question || topic.query })
  }

  const questions = progress.questions + 1
  const sessions = progress.sessions + 1
  const avgScore = Math.min(95, Math.round((progress.avgScore * progress.questions + 72) / questions))
  const nextProgress: StudentProgress = {
    ...progress,
    questions,
    sessions,
    avgScore,
    accuracy: avgScore,
    streak: Math.max(1, progress.streak),
    badges: Math.max(progress.badges, Math.floor(questions / 10)),
    focusTopics: weakTopics.length,
    weakTopics,
  }
  saveStudentProgress(nextProgress)
}

export type StudyRoomResult = {
  roomId: string
  topicTitle: string
  score: number
  total: number
  weakConcepts: string[]
  completedAt: string
}

export function studyRoomResultsKey(studentId = getCurrentStudent().id) {
  return `vp_study_room_results:${studentId}`
}

export function getStudyRoomResults(studentId?: string): StudyRoomResult[] {
  if (!canUseStorage()) return []
  try {
    const saved = localStorage.getItem(studyRoomResultsKey(studentId))
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export function recordStudyRoomResult(result: Omit<StudyRoomResult, 'completedAt'>) {
  if (!canUseStorage()) return
  const results = getStudyRoomResults()
  const next = [
    { ...result, completedAt: new Date().toISOString() },
    ...results.filter(item => item.roomId !== result.roomId),
  ].slice(0, 50)
  writeJson(studyRoomResultsKey(), next)
}
