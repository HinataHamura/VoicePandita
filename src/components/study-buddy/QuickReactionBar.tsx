const reactions = ['আমি বুঝেছি', 'আমি বুঝিনি', 'আরেকটা hint চাই', 'Explanation আবার দাও']
const emojiReactions = ['👍', '❤️', '😊', '💪']

export default function QuickReactionBar({ onReact }: { onReact?: (reaction: string) => void }) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {reactions.map(reaction => (
          <button
            key={reaction}
            type="button"
            onClick={() => onReact?.(reaction)}
            className="bangla flex-shrink-0 rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-xs font-semibold text-ink/60 hover:border-forest/25 hover:bg-white hover:text-forest"
          >
            {reaction}
          </button>
        ))}
      </div>
      <div className="flex gap-1">
        {emojiReactions.map(emoji => (
          <button
            key={emoji}
            type="button"
            onClick={() => onReact?.(emoji)}
            className="flex-shrink-0 rounded-lg border border-white/60 bg-white/75 px-2 py-1 text-lg hover:border-forest/25 hover:bg-white hover:scale-110 transition-transform"
            aria-label={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
