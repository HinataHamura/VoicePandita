'use client'

const pieces = Array.from({ length: 18 }, (_, index) => index)

export default function ConfettiBurst({ show }: { show: boolean }) {
  if (!show) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map(piece => (
        <span
          key={piece}
          className="absolute left-1/2 top-1/3 h-2 w-2 animate-[study-confetti_900ms_ease-out_forwards] rounded-sm"
          style={{
            backgroundColor: ['#16a34a', '#4f46e5', '#f59e0b', '#ef4444'][piece % 4],
            transform: `translate(-50%, -50%) rotate(${piece * 21}deg)`,
            ['--x' as string]: `${(piece % 6 - 2.5) * 46}px`,
            ['--y' as string]: `${-90 - (piece % 5) * 18}px`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes study-confetti {
          0% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
          100% { opacity: 0; transform: translate(calc(-50% + var(--x)), calc(-50% + var(--y) + 180px)) rotate(240deg) scale(.9); }
        }
      `}</style>
    </div>
  )
}
