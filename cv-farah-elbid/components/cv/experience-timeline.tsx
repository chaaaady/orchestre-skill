import { Badge } from '@/components/ui/badge'
import { Section } from '@/components/cv/section'
import { cv, type Experience } from '@/lib/data/cv'

function ExperienceRow({ item, index }: { item: Experience; index: number }): React.JSX.Element {
  return (
    <article
      className="group relative grid gap-6 border-t border-border py-10 md:grid-cols-[7rem_minmax(0,1fr)_11rem] md:gap-10 lg:gap-14"
      data-reveal
      style={{ '--reveal-delay': `${index * 60}ms` } as React.CSSProperties}
    >
      <div className="flex items-baseline gap-3 md:flex-col md:gap-1">
        <p className="font-serif text-3xl leading-none tracking-tight">{item.start}</p>
        <p className="text-xs text-muted-foreground">→ {item.end}</p>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="font-sans text-xl font-medium tracking-tight text-balance sm:text-2xl">
            {item.role}
          </h3>
          {item.type ? <Badge variant="outline">{item.type}</Badge> : null}
        </div>

        <p className="mt-1.5 text-sm text-muted-foreground">
          <span className="text-foreground">{item.company}</span>
          <span className="mx-2 text-border">/</span>
          {item.period}
        </p>

        <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft text-pretty">{item.summary}</p>

        <ul className="mt-5 space-y-2.5">
          {item.highlights.map((highlight) => (
            <li key={highlight} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
              <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              <span className="text-pretty">{highlight}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap gap-2 md:flex-col md:items-end md:flex-nowrap">
        {item.tags.map((tag) => (
          <Badge key={tag} variant="soft" className="h-fit">
            {tag}
          </Badge>
        ))}
      </div>
    </article>
  )
}

export function ExperienceTimeline(): React.JSX.Element {
  return (
    <Section
      id="parcours"
      eyebrow="Parcours"
      title={
        <>
          Sept ans dans l’humanitaire,
          <br />
          <span className="italic text-ink-soft">de l’alternance à la direction.</span>
        </>
      }
      intro="Une progression construite sur la performance : exécution, pilotage, puis management et structuration de la stratégie digitale."
    >
      <div className="border-b border-border">
        {cv.experiences.map((item, index) => (
          <ExperienceRow key={item.id} item={item} index={index} />
        ))}
      </div>
    </Section>
  )
}
