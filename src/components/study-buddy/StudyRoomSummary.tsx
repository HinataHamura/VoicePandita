import { BookOpenCheck } from 'lucide-react'

export default function StudyRoomSummary({ topicTitle }: { topicTitle: string }) {
  return (
    <section className="rounded-[2rem] border border-forest/15 bg-white/82 p-6 shadow-xl shadow-forest/10">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/10 text-forest">
        <BookOpenCheck size={22} />
      </div>
      <h2 className="bangla font-display text-2xl font-bold text-ink">আজকে তোমরা যা শিখলে</h2>
      <p className="bangla mt-3 leading-7 text-ink/65">
        {topicTitle} নিয়ে main idea, common confusion, hint ব্যবহার, আর short concept checks practice হয়েছে।
        Weak point: নিজের ভাষায় কারণ ব্যাখ্যা করা। Suggested next concept: এই topic-এর একটি real-life example।
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button className="rounded-xl bg-gradient-to-r from-forest to-indigo px-4 py-2 text-sm font-semibold text-white">এই summary save করো</button>
        <a href="/learn" className="rounded-xl border border-forest/20 bg-white px-4 py-2 text-sm font-semibold text-forest">আরেকটা room join করো</a>
      </div>
    </section>
  )
}
