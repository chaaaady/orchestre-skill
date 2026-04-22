# SKILL: TanStack Query — Data Fetching & Caching (SvelteKit)

> Module ID: `data-tanstack-query` | Domaine: Data fetching | Stack: SvelteKit

## When to use (vs SvelteKit `load`)

SvelteKit's `load` functions are the first choice for page-level data:
- Run on server or client depending on the route
- Rendered into initial HTML (no loading flash)
- Type-safe via `$types`
- No extra dependency

Use **TanStack Query** when you need one of:
- Client-side interactive data with mutation + automatic refetch
- Infinite scroll / pagination beyond what `load` handles
- Cross-route caching (e.g., same user profile used in many routes)
- Optimistic updates with rollback on failure
- Background refetching while the user is on the page

Don't use it for static page loads — `load` is faster and simpler.

## Install

```bash
npm install @tanstack/svelte-query
# optional dev tools:
npm install -D @tanstack/svelte-query-devtools
```

## Root setup — `+layout.svelte`

```svelte
<script lang="ts">
  import { QueryClient, QueryClientProvider } from '@tanstack/svelte-query';
  import { browser } from '$app/environment';

  let { data, children } = $props();

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // SvelteKit does SSR; avoid double-fetching on hydration
        enabled: browser,
        staleTime: 30_000,
        retry: 1,
      },
    },
  });
</script>

<QueryClientProvider client={queryClient}>
  {@render children()}
</QueryClientProvider>
```

## Hand-off pattern — seed from `load`

Use SvelteKit `load` to fetch SSR-first, then hand data off to TanStack for
mutations/refetch. Zero loading flash on first render.

```ts
// src/routes/invoices/+page.server.ts
import { getInvoices } from '$lib/server/queries/invoices';

export const load = async ({ locals }) => {
  const invoices = await getInvoices(locals.user.id);
  return { invoices };
};
```

```svelte
<!-- src/routes/invoices/+page.svelte -->
<script lang="ts">
  import { createQuery } from '@tanstack/svelte-query';
  let { data } = $props();

  // Seed the cache with SSR data; TanStack will manage it from here
  const query = createQuery({
    queryKey: ['invoices', data.user.id],
    queryFn: () => fetch('/api/invoices').then(r => r.json()),
    initialData: data.invoices,
    staleTime: 60_000,
  });
</script>

{#if $query.isFetching}<span>refreshing…</span>{/if}
{#each $query.data ?? [] as invoice}
  <InvoiceCard {invoice} />
{/each}
```

## Mutations with optimistic update

```svelte
<script lang="ts">
  import { createMutation, useQueryClient } from '@tanstack/svelte-query';

  const qc = useQueryClient();

  const markPaid = createMutation({
    mutationFn: async (invoiceId: string) => {
      const res = await fetch(`/api/invoices/${invoiceId}/pay`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onMutate: async (invoiceId) => {
      await qc.cancelQueries({ queryKey: ['invoices'] });
      const prev = qc.getQueryData(['invoices']);
      qc.setQueryData(['invoices'], (old: any[]) =>
        old.map(i => i.id === invoiceId ? { ...i, status: 'paid' } : i));
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['invoices'], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });
</script>

<button onclick={() => $markPaid.mutate(invoice.id)} disabled={$markPaid.isPending}>
  Mark paid
</button>
```

## Query keys — conventions

- Always start with a string namespace: `['invoices', ...]`
- Include every input that changes the result: `['invoices', userId, { status: 'open' }]`
- Derive keys in a helper so invalidation is consistent:

```ts
export const invoiceKeys = {
  all: ['invoices'] as const,
  lists: () => [...invoiceKeys.all, 'list'] as const,
  list: (filters: Filters) => [...invoiceKeys.lists(), filters] as const,
  detail: (id: string) => [...invoiceKeys.all, 'detail', id] as const,
};
```

## Anti-patterns (blocked or flagged)

- ❌ `createQuery` inside a `load` function — `load` is SSR; use direct fetch instead
- ❌ Query `queryFn` that calls `db.select(...)` directly — breaks R1 (DB must go through `$lib/server/` on the API route); the query should fetch from your SvelteKit API
- ❌ `$user.data?.password` in a query — queries must never carry secrets back to client; strip in the API handler
- ❌ `queryKey: ['x']` with no input variables — leads to cache collisions across routes
- ❌ `refetchOnWindowFocus: false` globally — removes a big part of the value; only disable per-query when needed

## Debugging

```svelte
<script>
  import { SvelteQueryDevtools } from '@tanstack/svelte-query-devtools';
  import { dev } from '$app/environment';
</script>

{#if dev}
  <SvelteQueryDevtools initialIsOpen={false} />
{/if}
```

## Checklist

- [ ] `QueryClientProvider` in root `+layout.svelte`
- [ ] `enabled: browser` default to avoid double-SSR fetches
- [ ] `initialData` from `load` on first render (no loading flash)
- [ ] Query keys in a `keys.ts` helper per resource
- [ ] Mutations wrap `fetch` to our own SvelteKit API, never direct DB calls
- [ ] Optimistic updates have `onError` rollback and `onSettled` invalidation
- [ ] Devtools only in dev build
- [ ] No secret data flowing through queries (stripped server-side)
