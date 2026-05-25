export type Subject = 'physics' | 'chemistry' | 'biology' | 'math' | 'bangla' | 'english'
export type OutputMode = 'whiteboard' | 'animation'
export type AnimationKey = 'newton_second_law' | 'photosynthesis' | 'minerals' | 'generic_concept'
export type EmotionState = 'confident' | 'confused' | 'frustrated'
export type Language = 'bn' | 'ckm' | 'mrm' | 'gnk'
export type UserLevel = 'ssc' | 'hsc'
export type StudentGoal = 'board' | 'admission'
export type StudyGroup = 'science' | 'humanities' | 'business'

export interface StudentProfile {
  level:     UserLevel
  goal:      StudentGoal
  group:     StudyGroup
}

export interface Message {
  id:          string
  role:        'user' | 'ai'
  text:        string
  diagram?:    string | null
  animationKey?: AnimationKey | null
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
  animationKey?:    AnimationKey | null
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
