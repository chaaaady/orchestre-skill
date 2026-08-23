import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, Mail, Printer } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Reveal } from '@/components/cv/reveal'
import { SiteFooter } from '@/components/cv/site-footer'
import { SiteHeader } from '@/components/cv/site-header'
import { cn } from '@/lib/utils'
import { EMAIL, cv } from '@/lib/data/cv'

export const metadata: Metadata = {
  title: `Lettre de motivation — ${cv.firstName} ${cv.lastName}`,
  description: cv.letter.subject,
}

export default function LetterPage(): React.JSX.Element {
  return (
    <>
      <SiteHeader initials={`${cv.firstName[0]}${cv.lastName[0]}`} />

      <main className="relative z-10 pt-32 pb-24 sm:pt-40">
        <article className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <Link
            href="/"
            className="no-print inline-flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
            Retour au CV
          </Link>

          <p className="eyebrow mt-10">Lettre de motivation</p>
          <h1
            className="mt-4 font-serif text-4xl leading-[1.08] tracking-tight text-balance sm:text-6xl"
            data-reveal
          >
            {cv.letter.subject}
          </h1>

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="text-foreground">
              {cv.firstName} {cv.lastName}
            </span>
            <span className="text-border">/</span>
            <span>{cv.title}</span>
          </div>

          <Separator className="mt-10" />

          <div className="mt-12 space-y-7">
            <p className="font-serif text-2xl">{cv.letter.salutation}</p>

            {cv.letter.paragraphs.map((paragraph, index) => (
              <p
                key={paragraph.slice(0, 32)}
                className={cn(
                  'text-[1.02rem] leading-[1.85] text-ink-soft text-pretty',
                  index === 0 &&
                    'font-serif text-[1.6rem] leading-[1.45] text-foreground sm:text-[1.75rem]'
                )}
                data-reveal
                style={{ '--reveal-delay': `${Math.min(index, 4) * 50}ms` } as React.CSSProperties}
              >
                {paragraph}
              </p>
            ))}

            <div className="pt-4">
              <p className="text-[1.02rem] leading-[1.85] text-ink-soft">{cv.letter.closing}</p>
              <p className="mt-3 font-serif text-3xl tracking-tight">{cv.letter.signature}</p>
            </div>
          </div>

          <Separator className="mt-14" />

          <div className="no-print mt-10 flex flex-wrap gap-3">
            <Button asChild variant="brand">
              <a href={`mailto:${EMAIL}?subject=${encodeURIComponent(cv.letter.subject)}`}>
                <Mail aria-hidden />
                Répondre à cette candidature
              </a>
            </Button>
            <Button asChild variant="outline">
              <Link href="/#parcours">
                <Printer aria-hidden />
                Voir le parcours détaillé
              </Link>
            </Button>
          </div>
        </article>
      </main>

      <SiteFooter />
      <Reveal />
    </>
  )
}
