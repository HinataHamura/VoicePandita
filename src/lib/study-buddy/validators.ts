import { z } from 'zod'

export const studyBuddyLanguageSchema = z.enum(['bn', 'en', 'chakma', 'marma', 'garo']).default('bn')

export const joinStudyBuddySchema = z.object({
  questionText: z.string().trim().min(2).max(1200),
  subject: z.string().trim().max(80).optional(),
  classLevel: z.string().trim().max(40).optional(),
  language: studyBuddyLanguageSchema.optional(),
  emotionLabel: z.enum(['confident', 'confused', 'frustrated']).optional(),
  conceptHint: z.string().trim().max(160).optional(),
  anonymousSessionId: z.string().uuid().optional(),
})

export const answerSchema = z.object({
  questionId: z.string().uuid(),
  answer: z.object({ id: z.string().trim().min(1).max(8) }).passthrough(),
  responseMs: z.number().int().min(0).max(600000).optional(),
})

export const reportSchema = z.object({
  reportedSessionId: z.string().uuid().optional(),
  reason: z.string().trim().min(3).max(80),
  details: z.string().trim().max(400).optional(),
})

export const messageSchema = z.object({
  content: z.string().trim().min(1).max(180),
})

export const reactionSchema = z.object({
  content: z.enum(['আমি বুঝেছি', 'আমি বুঝিনি', 'আরেকটা hint চাই', 'Explanation আবার দাও']),
})

export const roomIdSchema = z.string().uuid()
