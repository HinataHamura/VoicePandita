import { useMemo } from 'react'
import type { StudyRoomMember } from '@/lib/study-buddy/types'

export function useStudyRoomPresence(members: StudyRoomMember[] = []) {
  return useMemo(() => ({
    onlineCount: members.filter(member => member.member_status === 'active').length,
    aliases: members.map(member => member.display_alias),
  }), [members])
}
