import { cn } from '@/lib/utils'

type SectionProps = {
  id?: string
  eyebrow: string
  title: React.ReactNode
  intro?: string
  className?: string
  children: React.ReactNode
}

export function Section({
  id,
  eyebrow,
  title,
  intro,
  className,
  children,
}: SectionProps): React.JSX.Element {
  return (
    <section id={id} className={cn('relative scroll-mt-24 py-20 sm:py-28', className)}>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <div className="max-w-2xl" data-reveal>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
            {title}
          </h2>
          {intro ? (
            <p className="mt-5 text-base leading-relaxed text-muted-foreground text-pretty">
              {intro}
            </p>
          ) : null}
        </div>
        <div className="mt-12 sm:mt-16">{children}</div>
      </div>
    </section>
  )
}
