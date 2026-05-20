export type Subject = 'physics' | 'chemistry' | 'biology' | 'math' | 'english'
export type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple'
export type EmotionState = 'confident' | 'confused' | 'frustrated'
export type Language = 'bn' | 'ckm' | 'mrm' | 'gnk'
export type UserLevel = 'hsc' | 'university' | 'graduate' | 'job'

export interface StudentProfile {
  level:     UserLevel
  goal:      string
  english:   'weak' | 'moderate' | 'good'
  resume:    'yes' | 'no' | 'building'
  interview: 'never' | 'few' | 'regular'
}

export interface Message {
  id:          string
  role:        'user' | 'ai'
  text:        string
  diagram?:    string | null
  emotion?:    EmotionState | null
  outputMode?: OutputMode
  loading?:    boolean
  timestamp:   Date
}

export interface AskRequest {
  question:   string
  subject:    Subject
  outputMode: OutputMode
  emotion?:   EmotionState | null
  language?:  Language
}

export interface AskResponse {
  answer:          string
  diagram?:        string | null
  detectedEmotion: EmotionState
}

export interface CurriculumChunk {
  id:        string
  content:   string
  subject:   Subject
  chapter:   string
  topic:     string
  embedding: number[]
}

export interface SessionLog {
  anonymous_session_id: string
  question_text:        string
  subject:              Subject
  emotion_state:        EmotionState
  language:             Language
  created_at:           string
}
