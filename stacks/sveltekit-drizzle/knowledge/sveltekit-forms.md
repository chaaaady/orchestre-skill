# SKILL: SvelteKit Superforms + Zod
> Module ID: `forms-superforms-zod` | Domaine: Forms / Validation | Stack: SvelteKit + Superforms

## Install
```bash
npm install sveltekit-superforms zod
```

## Exports cles
- `superValidate(schema)` — valide les donnees server-side, retourne un objet form
- `superForm(data)` — connecte le form cote client avec reactivity Svelte
- `message(form, msg)` — retourne un message de succes au client
- `fail(status, { form })` — retourne les erreurs de validation au client
- `z.object()` / `z.string()` / `z.number()` — schema de validation
- `z.infer<typeof schema>` — type TypeScript infere
- `schema.safeParse(data)` — validation sans throw (server-side)

---

## 1. Schema Definition

```typescript
// src/lib/schemas/project.ts  <-- TOUJOURS dans src/lib/schemas/, jamais dans les routes
import { z } from 'zod'

export const projectSchema = z.object({
  name: z.string().min(2, 'Minimum 2 caracteres').max(100),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']),
  budget: z.number().min(0, 'Budget positif'),
})
export type ProjectInput = z.infer<typeof projectSchema>
```

Les schemas sont partages client/server. Un seul fichier = source de verite.

---

## 2. Server-Side — Form Action

```typescript
// src/routes/projects/new/+page.server.ts
import type { Actions, PageServerLoad } from './$types'
import { superValidate, message } from 'sveltekit-superforms'
import { zod } from 'sveltekit-superforms/adapters'
import { fail } from '@sveltejs/kit'
import { projectSchema } from '$lib/schemas/project'
import { createProject } from '$lib/mutations/projects'

// Load: initialise le form (vide ou pre-rempli)
export const load: PageServerLoad = async () => {
  const form = await superValidate(zod(projectSchema))
  return { form }
}

// Action: traite le submit
export const actions: Actions = {
  default: async ({ request, locals }) => {
    const form = await superValidate(request, zod(projectSchema))

    // Validation echouee -> renvoyer les erreurs aux champs
    if (!form.valid) {
      return fail(400, { form })
    }

    // Business logic dans lib/, jamais inline
    const result = await createProject(form.data, locals.user.id)
    if (!result.success) {
      return message(form, result.error.message, { status: 400 })
    }

    return message(form, 'Projet cree avec succes')
  },
}
```

---

## 3. Client-Side — Form Binding

```svelte
<!-- src/routes/projects/new/+page.svelte -->
<script lang="ts">
  import { superForm } from 'sveltekit-superforms'
  import type { PageData } from './$types'

  export let data: PageData

  const { form, errors, message, enhance, submitting } = superForm(data.form)
</script>

{#if $message}
  <div class="text-sm text-success">{$message}</div>
{/if}

<form method="POST" use:enhance>
  <div>
    <label for="name">Nom</label>
    <input id="name" name="name" bind:value={$form.name} />
    {#if $errors.name}
      <span class="text-sm text-destructive">{$errors.name}</span>
    {/if}
  </div>

  <div>
    <label for="status">Statut</label>
    <select id="status" name="status" bind:value={$form.status}>
      <option value="draft">Brouillon</option>
      <option value="active">Actif</option>
      <option value="archived">Archive</option>
    </select>
    {#if $errors.status}
      <span class="text-sm text-destructive">{$errors.status}</span>
    {/if}
  </div>

  <div>
    <label for="budget">Budget</label>
    <input id="budget" name="budget" type="number" bind:value={$form.budget} />
    {#if $errors.budget}
      <span class="text-sm text-destructive">{$errors.budget}</span>
    {/if}
  </div>

  <button type="submit" disabled={$submitting}>
    {$submitting ? 'Enregistrement...' : 'Creer'}
  </button>
</form>
```

---

## 4. Progressive Enhancement

`use:enhance` est la cle. Sans JS, le form fonctionne comme un POST classique. Avec JS, Superforms intercepte le submit et met a jour le DOM sans rechargement.

```svelte
<!-- use:enhance active le progressive enhancement -->
<form method="POST" use:enhance>
  <!-- ... champs ... -->
</form>
```

Sans `use:enhance`, le form fait un full page reload a chaque submit. Avec, il envoie en AJAX et met a jour les stores `$form`, `$errors`, `$message` automatiquement.

Options avancees :
```svelte
<script lang="ts">
  const { form, errors, enhance } = superForm(data.form, {
    // Desactiver le reset apres submit reussi
    resetForm: false,
    // Delai avant affichage du loading (evite le flash)
    delayMs: 300,
    // Timeout du submit
    timeoutMs: 8000,
    // Callback apres succes
    onResult: ({ result }) => {
      if (result.type === 'success') {
        goto('/projects')
      }
    },
  })
</script>
```

---

## 5. Multiple Forms Per Page

Quand une page a plusieurs forms (ex: profil + mot de passe), utiliser des IDs distincts.

```typescript
// src/routes/settings/+page.server.ts
import { superValidate } from 'sveltekit-superforms'
import { zod } from 'sveltekit-superforms/adapters'
import { profileSchema } from '$lib/schemas/profile'
import { passwordSchema } from '$lib/schemas/password'

export const load: PageServerLoad = async ({ locals }) => {
  const profileForm = await superValidate(locals.user, zod(profileSchema), { id: 'profile' })
  const passwordForm = await superValidate(zod(passwordSchema), { id: 'password' })
  return { profileForm, passwordForm }
}

export const actions: Actions = {
  updateProfile: async ({ request }) => {
    const form = await superValidate(request, zod(profileSchema), { id: 'profile' })
    if (!form.valid) return fail(400, { profileForm: form })
    // ... update profile
    return message(form, 'Profil mis a jour')
  },
  updatePassword: async ({ request }) => {
    const form = await superValidate(request, zod(passwordSchema), { id: 'password' })
    if (!form.valid) return fail(400, { passwordForm: form })
    // ... update password
    return message(form, 'Mot de passe mis a jour')
  },
}
```

```svelte
<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  export let data: PageData

  const profileForm = superForm(data.profileForm)
  const passwordForm = superForm(data.passwordForm)
</script>

<!-- Form profil -->
<form method="POST" action="?/updateProfile" use:enhance={profileForm.enhance}>
  <input name="name" bind:value={$profileForm.form.name} />
  <!-- ... -->
</form>

<!-- Form mot de passe (meme page, action differente) -->
<form method="POST" action="?/updatePassword" use:enhance={passwordForm.enhance}>
  <input name="currentPassword" type="password" bind:value={$passwordForm.form.currentPassword} />
  <!-- ... -->
</form>
```

---

## 6. File Uploads

Superforms gere les fichiers via `withFiles()` et un schema adapte.

```typescript
// src/lib/schemas/upload.ts
import { z } from 'zod'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export const uploadSchema = z.object({
  title: z.string().min(1),
  file: z
    .instanceof(File, { message: 'Fichier requis' })
    .refine((f) => f.size <= MAX_FILE_SIZE, 'Fichier trop lourd (max 5MB)')
    .refine((f) => ['image/png', 'image/jpeg'].includes(f.type), 'Format: PNG ou JPEG'),
})
export type UploadInput = z.infer<typeof uploadSchema>
```

```typescript
// src/routes/upload/+page.server.ts
import { superValidate, withFiles } from 'sveltekit-superforms'
import { zod } from 'sveltekit-superforms/adapters'
import { fail } from '@sveltejs/kit'
import { uploadSchema } from '$lib/schemas/upload'

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(uploadSchema))

    if (!form.valid) {
      // withFiles() permet de renvoyer le form avec les erreurs de fichier
      return fail(400, withFiles({ form }))
    }

    const file = form.data.file
    // ... sauvegarder le fichier (S3, local, etc.)

    return withFiles({ form })
  },
}
```

```svelte
<!-- src/routes/upload/+page.svelte -->
<script lang="ts">
  const { form, errors, enhance } = superForm(data.form)
</script>

<!-- enctype obligatoire pour les fichiers -->
<form method="POST" enctype="multipart/form-data" use:enhance>
  <input name="title" bind:value={$form.title} />

  <input
    name="file"
    type="file"
    accept="image/png,image/jpeg"
    on:change={(e) => {
      const target = e.currentTarget
      if (target.files?.[0]) {
        $form.file = target.files[0]
      }
    }}
  />
  {#if $errors.file}
    <span class="text-sm text-destructive">{$errors.file}</span>
  {/if}

  <button type="submit">Upload</button>
</form>
```

---

## 7. Optimistic Updates

Mise a jour locale AVANT la reponse serveur, rollback si erreur.

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms'
  import type { PageData } from './$types'

  export let data: PageData

  // Liste locale reactive
  let items = [...data.items]

  const { form, enhance } = superForm(data.form, {
    onSubmit: ({ formData }) => {
      // Optimistic: ajouter immediatement a la liste
      const optimisticItem = {
        id: crypto.randomUUID(),
        name: $form.name,
        _optimistic: true,
      }
      items = [...items, optimisticItem]
    },
    onResult: ({ result }) => {
      if (result.type === 'success') {
        // Remplacer l'item optimistic par le vrai (avec ID serveur)
        items = items.map((item) =>
          item._optimistic ? result.data?.item ?? item : item
        )
      }
    },
    onError: () => {
      // Rollback: retirer les items optimistic
      items = items.filter((item) => !item._optimistic)
    },
  })
</script>
```

---

## 8. Validation Patterns

**Champs conditionnels avec discriminatedUnion :**
```typescript
// src/lib/schemas/contact.ts
export const contactSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('individual'),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
  }),
  z.object({
    type: z.literal('company'),
    companyName: z.string().min(1),
    siret: z.string().length(14, 'SIRET = 14 chiffres'),
  }),
])
```

**Cross-field validation avec refine :**
```typescript
export const dateRangeSchema = z
  .object({
    startDate: z.string().date(),
    endDate: z.string().date(),
  })
  .refine((data) => new Date(data.endDate) > new Date(data.startDate), {
    message: 'La date de fin doit etre apres la date de debut',
    path: ['endDate'], // Erreur affichee sur endDate
  })
```

**Validation async (ex: email unique) :**
```typescript
// src/lib/schemas/signup.ts
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// La validation async se fait dans l'action, PAS dans le schema Zod
// src/routes/signup/+page.server.ts
export const actions: Actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, zod(signupSchema))
    if (!form.valid) return fail(400, { form })

    // Verifier unicite APRES validation Zod
    const existing = await findUserByEmail(form.data.email)
    if (existing.success && existing.data) {
      // Ajouter une erreur sur le champ email
      return setError(form, 'email', 'Cet email est deja utilise')
    }

    // ... creer le compte
  },
}
```

**Import `setError` :**
```typescript
import { superValidate, setError } from 'sveltekit-superforms'
```

---

## 9. Pattern complet — CRUD Edit Form

```typescript
// src/routes/projects/[id]/edit/+page.server.ts
import { superValidate, message } from 'sveltekit-superforms'
import { zod } from 'sveltekit-superforms/adapters'
import { fail, error } from '@sveltejs/kit'
import { projectSchema } from '$lib/schemas/project'
import { getProject, updateProject } from '$lib/queries/projects'

export const load: PageServerLoad = async ({ params, locals }) => {
  const result = await getProject(params.id, locals.user.id)
  if (!result.success) throw error(404, 'Projet non trouve')

  // Pre-remplir le form avec les donnees existantes
  const form = await superValidate(result.data, zod(projectSchema))
  return { form, project: result.data }
}

export const actions: Actions = {
  default: async ({ request, params, locals }) => {
    const form = await superValidate(request, zod(projectSchema))
    if (!form.valid) return fail(400, { form })

    const result = await updateProject(params.id, form.data, locals.user.id)
    if (!result.success) {
      return message(form, result.error.message, { status: 400 })
    }

    return message(form, 'Projet mis a jour')
  },
}
```

---

## Gotchas
- **Schemas dans `src/lib/schemas/`** — jamais inline dans une route. Partages client/server.
- **`z.infer<typeof schema>`** — source de verite TypeScript. Pas de types manuels.
- **Adapter `zod()` obligatoire** — `superValidate(request, zod(schema))`, pas `superValidate(request, schema)`.
- **`use:enhance` sans parentheses** — c'est `use:enhance`, pas `use:enhance()`. Sauf pour multiple forms ou il faut `use:enhance={myForm.enhance}`.
- **`$form` est un store** — acceder avec `$` en template, sans `$` dans `<script>` pour le store brut.
- **`fail()` de `@sveltejs/kit`** — pas `fail()` de Superforms. Superforms fournit `message()` et `setError()`.
- **Reset apres submit** : configurer `resetForm: true` (defaut) ou `false` dans les options de `superForm()`.

## A NE PAS FAIRE
- Ne pas utiliser `schema.parse()` dans les actions — toujours `superValidate(request, zod(schema))` qui utilise `safeParse` en interne
- Ne pas valider uniquement cote client — le serveur DOIT toujours re-valider via `superValidate`
- Ne pas oublier `use:enhance` — sans lui, pas de progressive enhancement, pas de mise a jour reactive des erreurs
- Ne pas creer le form dans `+page.svelte` — le form est initialise dans `load()` cote serveur et passe au client
- Ne pas mettre `z.any()` pour contourner la validation — anti-pattern #1
- Ne pas mixer `fetch('/api/...')` et form actions — utiliser les actions SvelteKit, pas des endpoints REST manuels
- Ne pas oublier `withFiles()` pour les uploads — sans lui, les erreurs de fichier sont perdues au retour
- Ne pas faire de validation async dans le schema Zod — la faire dans l'action avec `setError()`
- Ne pas utiliser `form.data` directement dans le template — utiliser le store `$form` retourne par `superForm()`
