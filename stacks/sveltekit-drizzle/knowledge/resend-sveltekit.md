# SKILL: Resend — Transactional Email (SvelteKit)

> Module ID: `email-resend` | Domaine: Email | Stack: SvelteKit + Drizzle

## Install

```bash
npm install resend
# Optional: React email components (still works from SvelteKit — they render to HTML server-side)
npm install @react-email/components react react-dom
# Pure Svelte alternative for templating:
npm install svelte-email
```

## Required env vars

```bash
RESEND_API_KEY=re_...              # server-side only — never PUBLIC_
RESEND_FROM=no-reply@mydomain.com  # verified sender domain in Resend dashboard
```

## Singleton client — `src/lib/server/email.ts`

> Per R8 and the architecture rules: Resend is instantiated ONCE in a dedicated
> `src/lib/server/` file. Never import this module from a `.svelte` component
> or a client-side `+page.ts` — it's server-only.

```ts
import { Resend } from 'resend';
import { RESEND_API_KEY, RESEND_FROM } from '$env/static/private';

if (!RESEND_API_KEY) throw new Error('Missing required env var: RESEND_API_KEY');

export const resend = new Resend(RESEND_API_KEY);
export const EMAIL_FROM = RESEND_FROM;
```

## Sending with a Svelte-rendered template

```ts
// src/lib/server/emails/welcome.ts
import { resend, EMAIL_FROM } from '$lib/server/email';
import type { Result } from '$lib/errors';
import { AppError } from '$lib/errors';

export async function sendWelcome(to: string, name: string): Promise<Result<{ id: string }>> {
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to,
      subject: `Welcome, ${name}`,
      html: renderWelcomeHtml({ name }),  // your template fn
      tags: [{ name: 'type', value: 'welcome' }],
    });

    if (error) return { success: false, error: new AppError('EMAIL_SEND_FAILED', error.message, 502) };
    return { success: true, data: { id: data!.id } };
  } catch (err) {
    return { success: false, error: new AppError('EMAIL_ERROR', String(err), 500) };
  }
}
```

## Calling from a Server Action (`+page.server.ts`)

```ts
import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { sendWelcome } from '$lib/server/emails/welcome';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export const actions = {
  signup: async ({ request }) => {
    const form = await request.formData();
    const parsed = signupSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return fail(400, { error: 'Invalid input' });

    const [user] = await db.insert(users).values(parsed.data).returning();

    const email = await sendWelcome(user.email, user.name);
    if (!email.success) {
      // email failure is NON-FATAL for signup — log and continue
      console.error('Welcome email failed', { userId: user.id, error: email.error.code });
    }
    return { success: true };
  },
};
```

## Receiving webhooks — Resend → SvelteKit

```ts
// src/routes/api/webhooks/resend/+server.ts
import { json, error } from '@sveltejs/kit';
import { Webhook } from 'svix';
import { RESEND_WEBHOOK_SECRET } from '$env/static/private';
import { db } from '$lib/server/db';
import { emailEvents } from '$lib/server/db/schema';

export async function POST({ request }) {
  const payload = await request.text();
  const headers = {
    'svix-id': request.headers.get('svix-id') ?? '',
    'svix-timestamp': request.headers.get('svix-timestamp') ?? '',
    'svix-signature': request.headers.get('svix-signature') ?? '',
  };

  let event;
  try {
    event = new Webhook(RESEND_WEBHOOK_SECRET).verify(payload, headers);
  } catch {
    throw error(400, 'Invalid signature');
  }

  // Idempotency — use event.data.email_id + event.type as dedupe key
  await db.insert(emailEvents).values({
    resendId: event.data.email_id,
    type: event.type,                      // email.sent, email.delivered, email.bounced, ...
    payload: event,
  }).onConflictDoNothing();

  return json({ received: true });
}
```

## Idempotency + retries

- Always set a `tags` label so you can trace the email in Resend's dashboard
- Never `await` an email send inside a DB transaction — email is external I/O
- If email fails post-critical-op, log it — do not revert the DB change
- Use a background queue for bulk (>10 emails/request)

## Anti-patterns (blocked or flagged)

- ❌ `PUBLIC_RESEND_API_KEY` — PUBLIC prefix on a secret → SECRET-09 triggers
- ❌ Importing `$lib/server/email` from a `.svelte` component → server leak check
- ❌ `new Resend(...)` in a route handler — breaks singleton rule (R8)
- ❌ `throw new Error(...)` inside `sendWelcome` — must return `Result<T>` (R4)
- ❌ Blocking signup on email failure — email is non-critical, log only

## Checklist

- [ ] `RESEND_API_KEY` server-only, in `.env`, NOT `.env.example`
- [ ] Singleton in `src/lib/server/email.ts`, used everywhere
- [ ] Every send function returns `Result<T>`
- [ ] Webhook signature verified before processing
- [ ] Idempotency key on webhook events in DB
- [ ] Email failures don't break the primary user flow
- [ ] Sender domain verified in Resend dashboard
