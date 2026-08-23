import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function NotFound(): React.JSX.Element {
  return (
    <main className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="font-serif text-6xl tracking-tight sm:text-8xl">
        Page <span className="italic text-ink-soft">introuvable</span>
      </h1>
      <p className="max-w-md text-muted-foreground">
        Cette page n’existe pas ou a été déplacée.
      </p>
      <Button asChild variant="brand">
        <Link href="/">Retour à l’accueil</Link>
      </Button>
    </main>
  )
}
