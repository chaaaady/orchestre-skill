import Link from 'next/link'
import { ArrowDown, Download, Mail, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CV_PDF, EMAIL, cv } from '@/lib/data/cv'

const HERO_FACTS = [
  { label: 'Aujourd’hui', value: 'Human Appeal France — direction adjointe du marketing digital' },
  { label: 'Terrain de jeu', value: 'Acquisition, data, parcours donateur, automatisation & IA' },
  { label: 'Résultat clé', value: '+800 % de collecte digitale entre 2021 et 2025' },
] as const

export function Hero(): React.JSX.Element {
  return (
    <section className="relative overflow-hidden pt-36 pb-20 sm:pt-44 sm:pb-28">
      {/* Halo décoratif */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 right-[-10%] h-[32rem] w-[32rem] rounded-full bg-brand-soft/60 blur-3xl"
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3.5 py-1.5 text-xs text-muted-foreground backdrop-blur"
          data-reveal
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-brand" />
          </span>
          Ouverte aux opportunités — direction marketing digital &amp; innovation
        </div>

        <div className="mt-8 flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <h1
            className="font-serif text-[clamp(3.4rem,12vw,9rem)] leading-[0.86] tracking-[-0.03em]"
            data-reveal
            style={{ '--reveal-delay': '60ms' } as React.CSSProperties}
          >
            {cv.firstName}
            <br />
            <span className="text-ink-soft italic">{cv.lastName}</span>
          </h1>

          <dl
            className="hidden shrink-0 space-y-5 border-l border-border pl-6 lg:block lg:pb-3"
            data-reveal
            style={{ '--reveal-delay': '220ms' } as React.CSSProperties}
          >
            {HERO_FACTS.map((fact) => (
              <div key={fact.label}>
                <dt className="eyebrow">{fact.label}</dt>
                <dd className="mt-1.5 max-w-[15rem] text-sm leading-snug text-pretty">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div
          className="mt-10 grid gap-10 border-t border-border pt-8 md:grid-cols-[1.1fr_1fr]"
          data-reveal
          style={{ '--reveal-delay': '140ms' } as React.CSSProperties}
        >
          <div>
            <p className="font-sans text-lg font-medium tracking-tight sm:text-xl">{cv.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">Human Appeal France</p>
            <p className="mt-6 max-w-xl font-serif text-2xl leading-snug text-pretty sm:text-[1.75rem]">
              {cv.tagline}
            </p>
          </div>

          <div className="flex flex-col justify-between gap-8">
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground text-pretty">
              {cv.profile}
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <Button asChild variant="brand" size="lg">
                <a href={`mailto:${EMAIL}`}>
                  <Mail aria-hidden />
                  Me contacter
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={CV_PDF} download>
                  <Download aria-hidden />
                  CV en PDF
                </a>
              </Button>
            </div>

            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5" aria-hidden />
              {cv.location} · Île-de-France
            </p>
          </div>
        </div>

        <Link
          href="/#parcours"
          className="no-print mt-16 inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowDown className="size-3.5 animate-bounce" aria-hidden />
          Découvrir le parcours
        </Link>
      </div>
    </section>
  )
}
