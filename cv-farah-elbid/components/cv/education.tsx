import { GraduationCap } from 'lucide-react'

import { Section } from '@/components/cv/section'
import { cv } from '@/lib/data/cv'

export function Education(): React.JSX.Element {
  return (
    <Section
      id="formation"
      eyebrow="Formation"
      title={
        <>
          Management <span className="italic text-ink-soft">&amp; transformation digitale.</span>
        </>
      }
    >
      <div className="space-y-5">
        {cv.education.map((item, index) => (
          <div
            key={item.degree}
            className="grid gap-6 rounded-xl border border-border bg-card/60 p-8 md:grid-cols-[10rem_minmax(0,1fr)_auto] md:items-center md:gap-10 sm:p-10"
            data-reveal
            style={{ '--reveal-delay': `${index * 70}ms` } as React.CSSProperties}
          >
            <p className="font-serif text-2xl leading-none tracking-tight whitespace-nowrap">{item.period}</p>

            <div>
              <h3 className="font-sans text-xl font-medium tracking-tight text-balance sm:text-2xl">
                {item.degree}
              </h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{item.school}</p>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground text-pretty">
                {item.detail}
              </p>
            </div>

            <GraduationCap className="hidden size-8 text-brand md:block" aria-hidden />
          </div>
        ))}
      </div>
    </Section>
  )
}
