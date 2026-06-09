const reactions = ['আমি বুঝেছি', 'আমি বুঝিনি', 'আরেকটা hint চাই', 'Explanation আবার দাও']

export default function QuickReactionBar({ onReact }: { onReact?: (reaction: string) => void }) {
  return (
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
  )
}
