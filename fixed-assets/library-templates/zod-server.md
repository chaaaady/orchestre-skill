# SKILL: Zod — Validation Server-Side
> Module ID: `security-zod` | Domaine: Sécurité / Validation | Stack: Next.js Server Actions

## Install
```bash
npm install zod  # généralement déjà installé avec RHF
```

## Exports clés
- `z.object()` / `z.string()` / `z.number()` / `z.enum()` — primitives
- `z.infer<typeof schema>` — type TypeScript inféré automatiquement
- `schema.safeParse(data)` — validation sans throw → retourne `{ success, data, error }`
- `schema.parse(data)` — validation avec throw (à éviter en Server Action)
- `error.flatten().fieldErrors` — erreurs par champ (pour les forms)

## Pattern principal — Server Action complète
```ts
// lib/schemas/project.ts  (partagé client/server)
import { z } from "zod"
export const createProjectSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  description: z.string().max(500).optional(),
  budget: z.number().min(0).max(1_000_000),
})
export type CreateProjectInput = z.infer<typeof createProjectSchema>

// app/actions/project.ts
'use server'
import { createClient } from "@/lib/supabase/server"
import { createProjectSchema } from "@/lib/schemas/project"

type Result<T> = { success: true; data: T } | { success: false; error: string; fieldErrors?: Record<string, string[]> }

export async function createProject(rawData: unknown): Promise<Result<{ id: string }>> {
  // 1. Auth check
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { success: false, error: "Non autorisé" }
  }

  // 2. Validation Zod
  const result = createProjectSchema.safeParse(rawData)
  if (!result.success) {
    return {
      success: false,
      error: "Données invalides",
      fieldErrors: result.error.flatten().fieldErrors,
    }
  }

  // 3. DB call
  const { data, error: dbError } = await supabase
    .from("projects")
    .insert({ ...result.data, user_id: user.id })
    .select("id")
    .single()

  if (dbError) {
    console.error("[createProject]", dbError)
    return { success: false, error: "Erreur serveur" }
  }

  return { success: true, data: { id: data.id } }
}
```

## Patterns secondaires

**Result type — pattern global :**
```ts
// lib/types.ts
export type Result<T> = { success: true; data: T } | { success: false; error: string }

// Usage côté client
const result = await createProject(formData)
if (!result.success) {
  toast.error(result.error)
  return
}
router.push(`/projects/${result.data.id}`)
```

**Validation d'un FormData (Server Action avec form natif) :**
```ts
export async function handleForm(formData: FormData) {
  const raw = Object.fromEntries(formData.entries())
  // Convertir les types si nécessaire
  const parsed = { ...raw, budget: Number(raw.budget) }
  const result = schema.safeParse(parsed)
  // ...
}
```

**Schémas composables — extend et merge :**
```ts
const baseSchema = z.object({ id: z.string().uuid(), created_at: z.string() })
const projectSchema = baseSchema.extend({ name: z.string() })
const updateSchema = projectSchema.partial().required({ id: true })
```

**Validation de paramètres URL :**
```ts
const paramsSchema = z.object({ id: z.string().uuid("ID invalide") })
const result = paramsSchema.safeParse({ id: params.id })
if (!result.success) notFound()
```

## Gotchas
- **Ne jamais faire confiance aux données du formulaire** — `rawData: unknown` dans toutes les Server Actions, pas `rawData: CreateProjectInput`.
- **`safeParse` pas `parse`** — `parse` throw une exception non-catchée si on l't oublie. `safeParse` retourne le résultat.
- **FormData → objet** : `Object.fromEntries(formData)` donne des strings pour tout. Convertir numbers et booleans manuellement avant `safeParse`.
- **Messages d'erreur en production** — ne jamais retourner `dbError.message` au client (peut contenir des infos sensibles). Logger côté serveur, message générique au client.

## À NE PAS FAIRE
- Ne pas skip la validation parce que "le form côté client valide déjà" — la validation serveur est indépendante
- Ne pas utiliser `z.any()` — ça revient à ne pas valider
- Ne pas throw depuis une Server Action — retourner `{ success: false, error }`
- Ne pas dupliquer les types manuellement — `z.infer<typeof schema>` suffit
- Ne pas exposer les messages d'erreur DB bruts au client
