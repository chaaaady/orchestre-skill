# SKILL: React Hook Form + Zod
> Module ID: `forms-rhf-zod` | Domaine: Forms / Validation | Stack: Next.js + shadcn Form

## Install
```bash
npm install react-hook-form zod @hookform/resolvers
```

## Exports clés
- `useForm<T>` — state du form avec type
- `zodResolver(schema)` — connecte Zod à RHF
- `z.object()` / `z.string()` / `z.number()` — schéma de validation
- `z.infer<typeof schema>` — type TypeScript inféré
- `schema.safeParse(data)` — validation sans throw (server-side)
- `form.handleSubmit` — handler validé avant submit

## Pattern principal — Form complet avec shadcn
```tsx
// lib/schemas/project.ts  ← TOUJOURS dans lib/schemas/, jamais dans les composants
import { z } from "zod"

export const projectSchema = z.object({
  name: z.string().min(2, "Minimum 2 caractères").max(100),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "archived"]),
  budget: z.number().min(0, "Budget positif"),
})
export type ProjectInput = z.infer<typeof projectSchema>

// components/project-form.tsx
'use client'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { projectSchema, ProjectInput } from "@/lib/schemas/project"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"

export function ProjectForm({ onSubmit }: { onSubmit: (data: ProjectInput) => Promise<void> }) {
  const form = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", status: "draft", budget: 0 },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField control={form.control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Nom</FormLabel>
            <FormControl><Input placeholder="Mon projet" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Enregistrement..." : "Créer"}
        </Button>
      </form>
    </Form>
  )
}
```

## Patterns secondaires

**Validation Server Action (réutilise le même schéma) :**
```ts
// app/actions/project.ts
'use server'
import { projectSchema } from "@/lib/schemas/project"

export async function createProject(rawData: unknown) {
  const result = projectSchema.safeParse(rawData)
  if (!result.success) {
    return { error: result.error.flatten().fieldErrors }
  }
  const { name, status, budget } = result.data  // typé et validé
  // ... DB call
}
```

**Schéma avec transformation et refinement :**
```ts
export const signupSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"],
})
```

**Champ conditionnel avec watch :**
```tsx
const type = form.watch("type")
{type === "company" && (
  <FormField name="siret" render={({ field }) => (
    <FormItem><FormLabel>SIRET</FormLabel>
      <FormControl><Input {...field} /></FormControl>
      <FormMessage />
    </FormItem>
  )} />
)}
```

## Gotchas
- **Schémas dans `lib/schemas/`** — jamais inline dans un composant. Ils sont partagés client/server.
- **`z.infer<typeof schema>`** — c'est la source de vérité TypeScript. Pas de types manuels.
- **`safeParse` vs `parse`** — en Server Action toujours `safeParse` (pas de throw non-catchés).
- **`useForm` sans `defaultValues`** — les champs seront `undefined` au premier render, causant des warnings React sur les inputs contrôlés.
- **Reset après submit** : `form.reset()` dans le `onSuccess` du handler.

## À NE PAS FAIRE
- Ne pas dupliquer les schémas côté client et serveur — un seul fichier dans `lib/schemas/`
- Ne pas utiliser `register()` quand `<Form>` shadcn est utilisé — tout via `field` dans `render`
- Ne pas throw dans une Server Action — retourner `{ error }` à la place
- Ne pas oublier `<FormMessage />` — c'est lui qui affiche les erreurs Zod
- Ne pas mettre `z.any()` pour contourner la validation — c'est l'anti-pattern #1
