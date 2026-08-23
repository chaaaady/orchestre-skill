import { Contact } from '@/components/cv/contact'
import { Education } from '@/components/cv/education'
import { ExperienceTimeline } from '@/components/cv/experience-timeline'
import { Hero } from '@/components/cv/hero'
import { LetterTeaser } from '@/components/cv/letter-teaser'
import { Reveal } from '@/components/cv/reveal'
import { SiteFooter } from '@/components/cv/site-footer'
import { SiteHeader } from '@/components/cv/site-header'
import { Skills } from '@/components/cv/skills'
import { StatsBand } from '@/components/cv/stats-band'
import { cv } from '@/lib/data/cv'

export default function HomePage(): React.JSX.Element {
  return (
    <>
      <SiteHeader initials={`${cv.firstName[0]}${cv.lastName[0]}`} />
      <main className="relative z-10">
        <Hero />
        <StatsBand />
        <ExperienceTimeline />
        <Skills />
        <LetterTeaser />
        <Education />
        <Contact />
      </main>
      <SiteFooter />
      <Reveal />
    </>
  )
}
