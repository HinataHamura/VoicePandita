export type Subject = 'physics' | 'chemistry' | 'biology' | 'math' | 'bangla' | 'english'
export type OutputMode = 'whiteboard' | 'text' | 'exam' | 'simple' | 'animation' | 'video'
export type AnimationKey = 'newton_second_law' | 'photosynthesis' | 'minerals' | 'quadratic_formula' | 'generic_concept'
export type EmotionState = 'confident' | 'confused' | 'frustrated'
export type Language = 'bn' | 'ccp' | 'ckm' | 'mrm' | 'gnk'
export type TargetLanguage = 'Bangla' | 'Chakma' | 'Marma' | 'Garo'
export type DetectedScript = 'Bengali' | 'Latin' | 'Chakma' | 'Myanmar' | 'Unknown'
export type AnswerProvenance = 'verified' | 'generated' | 'fallback'
export type LearnerLanguage = 'bn' | 'chakma' | 'garo' | 'marma' | 'en' | 'unknown'
export type LearnerScript = 'bengali' | 'latin' | 'chakma' | 'myanmar' | 'unknown'
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
  selected_target_language?: TargetLanguage
}

export interface AskResponse {
  answerText?:      string
  answer:          string
  metadata?: {
    sourceLanguage: LearnerLanguage
    sourceScript: LearnerScript
    outputLanguage: LearnerLanguage
    outputScript: LearnerScript
    detectionConfidence: number
    translationConfidence: number
    fallbackUsed: boolean
    verified: boolean
  }
  diagram?:        string | null
  animationKey?:    AnimationKey | null
  detectedEmotion: EmotionState
  detectedLanguage?: string
  detectedLanguageDetail?: string
  detectedScript?: DetectedScript
  selectedTargetLanguage?: TargetLanguage
  requestedTargetLanguage?: TargetLanguage
  outputScript?: DetectedScript
  languageConfidence?: number
  languageMetadata?: {
    detectedLanguage: string
    detectedLanguageDetail: string
    detectedScript: DetectedScript
    selectedTargetLanguage: TargetLanguage
    resolvedTargetLanguage: TargetLanguage
    outputScript: DetectedScript
    confidence: number
    verified: boolean
    provenance: AnswerProvenance
    fallback: boolean
    reasons: string[]
  }
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
