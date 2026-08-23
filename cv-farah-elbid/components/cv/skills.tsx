import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Section } from '@/components/cv/section'
import { cv } from '@/lib/data/cv'

export function Skills(): React.JSX.Element {
  return (
    <Section
      id="expertises"
      eyebrow="Compétences"
      title={
        <>
          Ce que je pilote <span className="italic text-ink-soft">au quotidien.</span>
        </>
      }
      intro="Une lecture décloisonnée de la performance : acquisition, data, parcours donateur et automatisation travaillent ensemble, jamais en silos."
      className="bg-card/40"
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {cv.skillGroups.map((group, index) => (
          <Card
            key={group.id}
            className="h-full border-border/80 bg-background/70 backdrop-blur"
            data-reveal
            style={{ '--reveal-delay': `${index * 80}ms` } as React.CSSProperties}
          >
            <CardHeader>
              <p className="eyebrow">0{index + 1}</p>
              <CardTitle className="mt-2 font-serif text-2xl tracking-tight">
                {group.title}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">{group.kicker}</p>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <Badge key={item} variant="outline" className="bg-card/60 py-1.5 font-normal">
                    {item}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </Section>
  )
}
