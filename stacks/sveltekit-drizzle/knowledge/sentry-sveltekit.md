# SKILL: Sentry — Monitoring & Error Tracking (SvelteKit)

> Module ID: `monitoring-sentry` | Domaine: Monitoring | Stack: SvelteKit

## Install

```bash
npx @sentry/wizard@latest -i sveltekit
# The wizard creates:
#   hooks.client.ts + Sentry init on client
#   hooks.server.ts + Sentry init on server (Node / Vercel / Cloudflare adapters supported)
#   vite.config.ts patched with sentrySvelteKit() plugin (upload source maps)
#   instrumentation.server.ts (Node adapter only)
```

## Required env vars

```bash
PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx          # server-side
SENTRY_ORG=my-org
SENTRY_PROJECT=my-project
SENTRY_AUTH_TOKEN=sntrys_...                             # for source map upload at build
```

> Server-only secrets (`SENTRY_AUTH_TOKEN`) MUST NOT carry the `PUBLIC_` prefix —
> our hooks enforce this.

## Key exports

- `Sentry.captureException(error)` — manually capture an exception
- `Sentry.captureMessage(msg, level)` — capture a message
- `Sentry.setUser({ id, email })` — associate errors with a user
- `Sentry.addBreadcrumb()` — add context before an error
- `sentrySvelteKit()` (vite plugin) — source maps upload, wraps the build

## Client — `hooks.client.ts`

```ts
import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry, replayIntegration } from '@sentry/sveltekit';
import { PUBLIC_SENTRY_DSN } from '$env/static/public';
import { dev } from '$app/environment';

Sentry.init({
  dsn: PUBLIC_SENTRY_DSN,
  environment: dev ? 'development' : 'production',
  tracesSampleRate: dev ? 1.0 : 0.1,

  replaysSessionSampleRate: 0.05,
  replaysOnErrorSampleRate: 0.5,
  integrations: [replayIntegration({ maskAllText: true, blockAllMedia: true })],

  ignoreErrors: [
    'ResizeObserver loop limit exceeded',
    'Non-Error promise rejection captured',
    /^Network Error/,
  ],

  beforeSend(event) {
    if (dev) return null;
    if (event.request?.cookies) delete event.request.cookies;
    return event;
  },
});

export const handleError = handleErrorWithSentry();
```

## Server — `hooks.server.ts`

```ts
import * as Sentry from '@sentry/sveltekit';
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { SENTRY_DSN } from '$env/static/private';
import { dev } from '$app/environment';

Sentry.init({
  dsn: SENTRY_DSN,
  environment: dev ? 'development' : 'production',
  tracesSampleRate: dev ? 1.0 : 0.1,

  beforeSend(event) {
    if (dev) return null;
    // scrub secrets out of request
    if (event.request?.headers) {
      delete event.request.headers.authorization;
      delete event.request.headers.cookie;
    }
    return event;
  },
});

// sentryHandle must wrap other handles (sequence order matters)
export const handle = sequence(sentryHandle(), yourAuthHandle);
export const handleError = handleErrorWithSentry();
```

## Identifying the user after login

```ts
// in a load function or +layout.server.ts after auth
import * as Sentry from '@sentry/sveltekit';

export const load = async ({ locals }) => {
  if (locals.user) {
    Sentry.setUser({ id: locals.user.id, email: locals.user.email });
  }
  return { user: locals.user };
};
```

## Manual capture inside load / actions

```ts
// Always capture in the catch, then rethrow or return a typed error
export const actions = {
  default: async ({ request }) => {
    try {
      const form = await request.formData();
      await processForm(form);
      return { success: true };
    } catch (error) {
      Sentry.captureException(error, { tags: { action: 'createInvoice' } });
      return fail(500, { error: 'Something went wrong' });
    }
  },
};
```

## vite.config.ts — source maps

```ts
import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    sentrySvelteKit({
      sourceMapsUploadOptions: {
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    }),
    sveltekit(),
  ],
});
```

## Anti-patterns (blocked or flagged)

- ❌ `Sentry.init({ dsn: 'https://hardcoded@...' })` — hardcoded DSN → SECRET-05 triggers
- ❌ `PUBLIC_SENTRY_AUTH_TOKEN` — auth token with PUBLIC_ prefix → SECRET-09 triggers
- ❌ Capturing PII in breadcrumbs without `beforeSend` scrubbing
- ❌ `tracesSampleRate: 1.0` in production (expensive, data-heavy)
- ❌ Init'ing Sentry inside a `load` function (must be in hooks only — init is a boot-time concern)

## Checklist

- [ ] `hooks.client.ts` + `hooks.server.ts` init Sentry
- [ ] Source maps upload wired in `vite.config.ts`
- [ ] `beforeSend` strips cookies + authorization header
- [ ] User identification in `+layout.server.ts` after auth
- [ ] `SENTRY_DSN` server-side, `PUBLIC_SENTRY_DSN` client-side
- [ ] `SENTRY_AUTH_TOKEN` in CI, not committed
- [ ] No `Sentry.init` outside hooks (blocked as anti-pattern)
