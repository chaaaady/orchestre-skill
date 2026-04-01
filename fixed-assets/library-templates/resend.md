# SKILL: Resend + React Email
> Module ID: `email-resend` | Domaine: Email | Stack: Next.js Server Actions + React Email
> version: 1.0 | last_updated: 2026-03-14 | compatible_with: resend@4.x, react-email@3.x

## ⚡ SINGLETON OBLIGATOIRE
Ne jamais instancier `new Resend()` dans chaque fichier. Créer un singleton :

```ts
// lib/email/client.ts  ← créer CE fichier dans l'INIT
import { Resend } from "resend"
export const resend = new Resend(process.env.RESEND_API_KEY)
```

Dans chaque fichier qui envoie des emails :
```ts
import { resend } from "@/lib/email/client"  // ← importer le singleton
// PAS: const resend = new Resend(process.env.RESEND_API_KEY)
```

## Install
```bash
npm install resend react-email @react-email/components
```
```bash
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@ton-domaine.fr   # Domaine vérifié dans Resend Dashboard
APP_URL=https://ton-app.fr
```

## Exports clés
- `Resend` — client pour envoyer des emails
- `resend.emails.send()` — envoi avec template React
- `@react-email/components` — Html, Body, Container, Heading, Text, Button, Link, Hr, Img
- `render()` — convertit le composant React en HTML string

## Pattern principal — Email transactionnel complet
```tsx
// emails/welcome.tsx  (à la racine du projet, composant React pur)
import {
  Html, Head, Body, Container, Heading, Text, Button, Hr, Img
} from "@react-email/components"

interface WelcomeEmailProps {
  userName: string
  loginUrl: string
}

export function WelcomeEmail({ userName, loginUrl }: WelcomeEmailProps) {
  return (
    <Html lang="fr">
      <Head />
      <Body style={{ backgroundColor: "#f6f9fc", fontFamily: "sans-serif" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
          <Heading style={{ color: "#0F172A" }}>
            Bienvenue, {userName} 👋
          </Heading>
          <Text style={{ color: "#64748B", lineHeight: "1.6" }}>
            Votre compte est créé. Cliquez ci-dessous pour commencer.
          </Text>
          <Button
            href={loginUrl}
            style={{ backgroundColor: "#3B82F6", color: "#fff", padding: "12px 24px", borderRadius: "6px" }}
          >
            Accéder à mon compte
          </Button>
          <Hr style={{ borderColor: "#E2E8F0", margin: "24px 0" }} />
          <Text style={{ color: "#94A3B8", fontSize: "12px" }}>
            Si vous n'êtes pas à l'origine de cette inscription, ignorez cet email.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// app/actions/email.ts
'use server'
import { Resend } from "resend"
import { WelcomeEmail } from "@/emails/welcome"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendWelcomeEmail(email: string, userName: string) {
  const { data, error } = await resend.emails.send({
    from: process.env.FROM_EMAIL!,
    to: email,
    subject: `Bienvenue sur ${process.env.NEXT_PUBLIC_APP_NAME} !`,
    react: WelcomeEmail({
      userName,
      loginUrl: `${process.env.APP_URL}/dashboard`,
    }),
  })

  if (error) {
    console.error("[Email] Erreur envoi:", error)
    return { error: "Impossible d'envoyer l'email" }
  }

  return { success: true, id: data?.id }
}
```

## Patterns secondaires

**Email de reset password :**
```tsx
// emails/reset-password.tsx
export function ResetPasswordEmail({ resetUrl }: { resetUrl: string }) {
  return (
    <Html lang="fr">
      <Body style={{ fontFamily: "sans-serif" }}>
        <Container>
          <Heading>Réinitialisation de votre mot de passe</Heading>
          <Text>Ce lien expire dans 1 heure.</Text>
          <Button href={resetUrl}>Réinitialiser mon mot de passe</Button>
        </Container>
      </Body>
    </Html>
  )
}
```

**Envoi batch (plusieurs destinataires) :**
```ts
// Resend supporte jusqu'à 100 emails par batch
const { data, error } = await resend.batch.send([
  { from: process.env.FROM_EMAIL!, to: "user1@example.com", subject: "...", react: <Email /> },
  { from: process.env.FROM_EMAIL!, to: "user2@example.com", subject: "...", react: <Email /> },
])
```

**Preview en développement :**
```bash
npx react-email dev  # Lance un serveur de preview sur :3000
# ou ajouter dans package.json: "email:dev": "react-email dev --dir emails"
```

## Gotchas
- **Domaine vérifié obligatoire** — Resend ne peut pas envoyer depuis `gmail.com` ou tout autre domaine non vérifié. Ajouter les DNS records dans Resend Dashboard.
- **`react-email` composants** sont différents du HTML/CSS classique — styles inline uniquement, pas de Tailwind, pas de CSS externe.
- **`FROM_EMAIL`** doit correspondre exactement au domaine vérifié dans Resend.
- **Rate limits Resend** : plan gratuit = 100 emails/jour, 3000/mois. Plan payant requis pour la prod.
- **`resend.emails.send()` est async** — toujours await, toujours gérer l'erreur.

## À NE PAS FAIRE
- Ne pas utiliser `@/` dans les imports des templates email (react-email dev server ne le comprend pas)
- Ne pas mettre les templates dans `app/` ou `components/` — dossier `emails/` à la racine
- Ne pas envoyer des emails depuis un Client Component — Server Action ou Route Handler uniquement
- Ne pas logger le contenu des emails (peut contenir des données sensibles)
- Ne pas ignorer les erreurs d'envoi — l'UX doit gérer le cas "email non envoyé"
