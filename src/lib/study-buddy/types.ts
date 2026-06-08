export type StudyBuddyLanguage = 'bn' | 'en' | 'chakma' | 'marma' | 'garo'
export type StudyRoomStatus = 'waiting' | 'active' | 'completed' | 'cancelled' | 'expired'
export type StudyRoomSender = 'ai_host' | 'student' | 'system'
export type StudyRoomMessageType = 'text' | 'question' | 'explanation' | 'system' | 'result'

export interface StudyRoom {
  id: string
  topic_key: string
  topic_title: string
  subject: string | null
  class_level: string | null
  language: StudyBuddyLanguage
  source_question: string | null
  room_status: StudyRoomStatus
  max_members: number
  min_members: number
  started_at: string | null
  ended_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export interface StudyRoomMember {
  id: string
  room_id: string
  anonymous_session_id?: string
  display_alias: string
  avatar_seed: string | null
  member_status: 'active' | 'left' | 'kicked' | 'idle'
  joined_at: string
  last_seen_at: string
  left_at: string | null
}

export interface StudyQuestionOption {
  id: string
  text: string
}

export interface StudyRoomQuestion {
  id: string
  room_id: string
  question_order: number
  question_type: 'mcq'
  prompt_bn: string
  options: StudyQuestionOption[]
  correct_answer: { id: string }
  hint_bn: string | null
  explanation_bn: string
  difficulty: 'easy' | 'medium'
  concept_tag: string | null
}

export interface StudyRoomMessage {
  id: string
  room_id: string
  sender_type: StudyRoomSender
  sender_session_id: string | null
  message_type: StudyRoomMessageType
  content: string
  safe_content: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface StudyRoomAnswer {
  id: string
  room_id: string
  question_id: string
  anonymous_session_id: string
  answer: { id?: string }
  is_correct: boolean
  response_ms: number | null
  answered_at: string
}

export interface StudyBuddyQuiz {
  topicTitle: string
  learningGoalBn: string
  warmupBn: string
  questions: Array<{
    questionOrder: number
    questionType: 'mcq'
    promptBn: string
    options: StudyQuestionOption[]
    correctAnswer: { id: string }
    hintBn: string
    explanationBn: string
    difficulty: 'easy' | 'medium'
    conceptTag: string
  }>
  closingSummaryBn: string
}

export interface StudyBuddyJoinResponse {
  roomId: string
  status: StudyRoomStatus
  memberCount: number
  minMembers: number
  maxMembers: number
  topicTitle: string
  redirectUrl: string
}
