export function studyRoomChannelName(roomId: string) {
  return `study-room:${roomId}`
}

export type StudyRoomRealtimeEvent =
  | 'member_joined'
  | 'member_left'
  | 'room_started'
  | 'ai_message'
  | 'question_started'
  | 'answer_submitted'
  | 'question_result'
  | 'room_completed'
