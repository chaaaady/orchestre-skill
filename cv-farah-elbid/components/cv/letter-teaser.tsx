import Link from 'next/link'
import { ArrowRight, Quote } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cv } from '@/lib/data/cv'

export function LetterTeaser(): React.JSX.Element {
  return (
    <section className="relative overflow-hidden border-y border-border bg-primary py-24 text-primary-foreground sm:py-32">
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 left-[-8%] h-[26rem] w-[26rem] rounded-full bg-brand/25 blur-3xl"
      />
      <div className="relative mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <Quote className="mx-auto size-6 opacity-60" aria-hidden />
        <blockquote
          className="mt-8 font-serif text-3xl leading-[1.2] tracking-tight text-balance sm:text-5xl"
          data-reveal
        >
          « Ce qui m’intéresse surtout, c’est le problème que ce poste cherche à résoudre : faire
          évoluer la collecte vers un modèle{' '}
          <span className="italic">réellement 360°</span>. »
        </blockquote>

        <p
          className="mx-auto mt-8 max-w-xl text-sm leading-relaxed opacity-70 text-pretty"
          data-reveal
          style={{ '--reveal-delay': '90ms' } as React.CSSProperties}
        >
          {cv.letter.subject}
        </p>

        <div className="mt-10" data-reveal style={{ '--reveal-delay': '150ms' } as React.CSSProperties}>
          <Button asChild variant="brand" size="lg">
            <Link href="/lettre">
              Lire la lettre de motivation
              <ArrowRight aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
