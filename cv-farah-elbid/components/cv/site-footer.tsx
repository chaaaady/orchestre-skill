import { cv } from '@/lib/data/cv'

export function SiteFooter(): React.JSX.Element {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-4 px-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-8">
        <p>
          <span className="font-serif text-sm text-foreground">
            {cv.firstName} {cv.lastName}
          </span>
          <span className="mx-2 text-border">/</span>
          {cv.title}
        </p>
        <p>{cv.location} · Île-de-France</p>
      </div>
    </footer>
  )
}
