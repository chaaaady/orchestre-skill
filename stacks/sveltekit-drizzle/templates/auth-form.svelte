<script lang="ts">
  import { enhance } from '$app/forms'
  import type { ActionData } from './$types'

  let { form }: { form: ActionData } = $props()
  let loading = $state(false)
  let email = $state('')
  let password = $state('')
</script>

<form
  method="POST"
  action="?/login"
  use:enhance={() => {
    loading = true
    return async ({ update }) => {
      loading = false
      await update()
    }
  }}
  class="flex flex-col gap-4 w-full max-w-sm"
>
  {#if form?.error}
    <div class="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
      {form.error}
    </div>
  {/if}

  <div class="flex flex-col gap-2">
    <label for="email" class="text-sm font-medium text-foreground">Email</label>
    <input
      id="email"
      name="email"
      type="email"
      required
      bind:value={email}
      placeholder="you@example.com"
      class="px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  </div>

  <div class="flex flex-col gap-2">
    <label for="password" class="text-sm font-medium text-foreground">Password</label>
    <input
      id="password"
      name="password"
      type="password"
      required
      bind:value={password}
      minlength="8"
      class="px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    />
  </div>

  <button
    type="submit"
    disabled={loading}
    class="px-4 py-2 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
  >
    {loading ? 'Signing in...' : 'Sign in'}
  </button>

  <p class="text-sm text-muted-foreground text-center">
    Don't have an account?
    <a href="/signup" class="text-primary hover:underline">Sign up</a>
  </p>
</form>
