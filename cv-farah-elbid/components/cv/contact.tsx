import { ArrowUpRight, Download, Linkedin, Mail, MapPin, Phone } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CV_PDF, EMAIL, LINKEDIN_URL, PHONE, cv } from '@/lib/data/cv'

const ICONS = {
  Email: Mail,
  Téléphone: Phone,
  LinkedIn: Linkedin,
  Localisation: MapPin,
} as const

export function Contact(): React.JSX.Element {
  return (
    <section id="contact" className="scroll-mt-24 py-24 sm:py-32">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="grid gap-14 md:grid-cols-[1.2fr_1fr]">
          <div data-reveal>
            <p className="eyebrow">Contact</p>
            <h2 className="mt-4 font-serif text-5xl leading-[1.02] tracking-tight text-balance sm:text-7xl">
              Parlons de <span className="italic text-ink-soft">votre collecte.</span>
            </h2>
            <p className="mt-6 max-w-lg leading-relaxed text-muted-foreground text-pretty">
              Disponible pour échanger sur des postes de direction marketing digital, fundraising et
              innovation, en Île-de-France ou en hybride.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button asChild variant="brand" size="lg">
                <a href={`mailto:${EMAIL}`}>
                  <Mail aria-hidden />
                  {EMAIL}
                </a>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href={CV_PDF} download>
                  <Download aria-hidden />
                  Télécharger le CV
                </a>
              </Button>
            </div>
          </div>

          <ul
            className="divide-y divide-border border-y border-border"
            data-reveal
            style={{ '--reveal-delay': '90ms' } as React.CSSProperties}
          >
            {cv.contact.map((item) => {
              const Icon = ICONS[item.label as keyof typeof ICONS]
              const isLink = item.href.length > 0
              const external = item.href === LINKEDIN_URL

              return (
                <li key={item.label}>
                  {isLink ? (
                    <a
                      href={item.href}
                      target={external ? '_blank' : undefined}
                      rel={external ? 'noreferrer' : undefined}
                      className="group flex items-center gap-4 py-5 transition-colors hover:text-brand"
                    >
                      <Icon className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1">
                        <span className="block text-xs text-muted-foreground">{item.label}</span>
                        <span className="text-sm">{item.value}</span>
                      </span>
                      <ArrowUpRight
                        className="size-4 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100"
                        aria-hidden
                      />
                    </a>
                  ) : (
                    <div className="flex items-center gap-4 py-5">
                      <Icon className="size-4 text-muted-foreground" aria-hidden />
                      <span className="flex-1">
                        <span className="block text-xs text-muted-foreground">{item.label}</span>
                        <span className="text-sm">{item.value}</span>
                      </span>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>

        <p className="sr-only">{`${cv.firstName} ${cv.lastName}, ${PHONE}`}</p>
      </div>
    </section>
  )
}
