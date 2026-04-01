# SKILL: Next.js Server Actions
> Module ID: `nextjs-actions` | Domaine: Backend / API | Stack: Next.js App Router 14+

## Install
```bash
# Intégré dans Next.js 14+ — pas d'installation supplémentaire
# next.config.ts : serverActions activé par défaut
```

## Exports clés
- `'use server'` — directive fichier ou fonction
- `revalidatePath(path)` / `revalidateTag(tag)` — invalide le cache
- `redirect(url)` — redirect après action
- `useFormStatus` — état du submit dans les enfants du form
- `useOptimistic` — update optimiste avant confirmation serveur
- `useActionState` — state de l'action (Next.js 14+, remplace useFormState)

## Pattern principal — Server Action complète
```ts
// app/actions/project.ts
'use server'
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { projectSchema } from "@/lib/schemas/project"

export async function createProject(
  prevState: { error?: string } | null,
  formData: FormData
): Promise<{ error?: string; id?: string }> {
  // 1. Auth
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Non autorisé" }

  // 2. Validation
  const raw = Object.fromEntries(formData.entries())
  const result = projectSchema.safeParse(raw)
  if (!result.success) return { error: result.error.flatten().fieldErrors.name?.[0] ?? "Données invalides" }

  // 3. DB
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...result.data, user_id: user.id })
    .select("id")
    .single()

  if (error) {
    console.error("[createProject]", error)
    return { error: "Erreur serveur" }
  }

  // 4. Revalidate + redirect
  revalidatePath("/dashboard")
  redirect(`/projects/${data.id}`)
}
```

## Patterns secondaires

**useActionState — form avec feedback :**
```tsx
'use client'
import { useActionState } from "react"
import { createProject } from "@/app/actions/project"
import { SubmitButton } from "@/components/submit-button"

export function ProjectForm() {
  const [state, action] = useActionState(createProject, null)
  return (
    <form action={action}>
      <Input name="name" required />
      {state?.error && <p className="text-destructive text-sm">{state.error}</p>}
      <SubmitButton />
    </form>
  )
}

// components/submit-button.tsx
'use client'
import { useFormStatus } from "react-dom"
export function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" disabled={pending}>{pending ? "Enregistrement..." : "Créer"}</Button>
}
```

**useOptimistic — update UI avant confirmation :**
```tsx
'use client'
import { useOptimistic, useTransition } from "react"
import { toggleTodo } from "@/app/actions/todo"

export function TodoList({ todos }: { todos: Todo[] }) {
  const [optimisticTodos, addOptimistic] = useOptimistic(todos)
  const [, startTransition] = useTransition()

  const handleToggle = (id: string) => {
    startTransition(async () => {
      addOptimistic(todos.map(t => t.id === id ? { ...t, completed: !t.completed } : t))
      await toggleTodo(id)
    })
  }
  return optimisticTodos.map(todo => (
    <div key={todo.id} onClick={() => handleToggle(todo.id)}>{todo.title}</div>
  ))
}
```

**Action inline (simple, pas besoin d'un fichier séparé) :**
```tsx
// Directement dans un Server Component
async function deleteItem(id: string) {
  'use server'
  const supabase = await createClient()
  await supabase.from("items").delete().eq("id", id)
  revalidatePath("/items")
}
<form action={deleteItem.bind(null, item.id)}>
  <Button type="submit" variant="destructive">Supprimer</Button>
</form>
```

## Gotchas
- **Server Actions retournent uniquement des données sérialisables** — pas de JSX, pas de classes, pas de fonctions.
- **`redirect()` throw une erreur** en interne — ne pas mettre dans un `try/catch`. Appeler après le bloc try.
- **`useFormStatus`** ne fonctionne que dans un enfant direct du `<form>` — le mettre dans un composant séparé.
- **FormData → types** : tout est string. Convertir numbers (`Number(formData.get("budget"))`).
- **`revalidatePath` vs `revalidateTag`** : revalidatePath = page spécifique, revalidateTag = tous les caches avec ce tag (plus granulaire).

## À NE PAS FAIRE
- Ne pas throw depuis une Server Action — retourner `{ error: string }`
- Ne pas retourner de JSX ou d'objets non-sérialisables
- Ne pas mettre `redirect()` dans un try/catch
- Ne pas utiliser Server Actions pour des reads — préférer les Server Components
- Ne pas oublier `revalidatePath` après une mutation — sinon le cache n'est pas invalidé
