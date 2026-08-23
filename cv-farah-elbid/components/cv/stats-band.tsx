import { cv } from '@/lib/data/cv'

export function StatsBand(): React.JSX.Element {
  return (
    <section aria-label="Chiffres clés" className="border-y border-border bg-card/50">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-px bg-border px-0 sm:px-0 lg:grid-cols-4">
        {cv.stats.map((stat, index) => (
          <div
            key={stat.label}
            className="bg-background px-5 py-9 sm:px-8"
            data-reveal
            style={{ '--reveal-delay': `${index * 70}ms` } as React.CSSProperties}
          >
            <p className="font-serif text-4xl tracking-tight sm:text-5xl">{stat.value}</p>
            <p className="mt-2 text-sm font-medium">{stat.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{stat.detail}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
