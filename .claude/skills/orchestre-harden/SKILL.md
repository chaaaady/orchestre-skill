# Skill: orchestre-harden

## Metadata
- **Name**: orchestre-harden
- **Description**: Takes a working project and adds production hardening: error boundaries, loading states, edge cases, fallbacks, input validation, accessibility basics.
- **Trigger**: /orchestre-harden, "harden this", "make it production-ready", "add error handling", "add edge cases"

## Process

### STEP 1: Production Readiness Scan (1 minute)

Scan the project for missing production essentials. Check each category:

**Error Handling:**
- [ ] Global error boundary (`global-error.tsx` / `+error.svelte` / `handleError`)
- [ ] Per-page error boundaries
- [ ] API route try/catch with proper status codes
- [ ] Form action error handling with user-friendly messages
- [ ] Network error fallbacks

**Loading States:**
- [ ] Page-level loading (`loading.tsx` / `+page.svelte` with loading)
- [ ] Component-level skeletons for async data
- [ ] Button loading states on form submissions
- [ ] Optimistic updates where appropriate

**Input Validation:**
- [ ] Server-side Zod/Pydantic validation on ALL user inputs
- [ ] Client-side validation for immediate feedback
- [ ] File upload size/type validation
- [ ] Rate limiting on auth and sensitive endpoints

**Edge Cases:**
- [ ] Empty states ("No items yet" instead of blank page)
- [ ] Auth expiry handling (redirect to login, not blank screen)
- [ ] Payment failure handling (dunning, retry, downgrade)
- [ ] Offline/network error states
- [ ] Concurrent edit handling (if applicable)

**Security:**
- [ ] RLS / row-level filtering on all user data queries
- [ ] Auth check on every protected route/action
- [ ] Webhook signature verification
- [ ] No secrets in client-side code
- [ ] ENV validation at boot

**Accessibility:**
- [ ] Semantic HTML (headings hierarchy, landmarks)
- [ ] Form labels and aria attributes
- [ ] Focus management on modals/dialogs
- [ ] Color contrast (WCAG AA minimum)
- [ ] Keyboard navigation on interactive elements

Report findings:

```
--- HARDENING SCAN ---
Error Handling:  {N}/5 checks passing
Loading States:  {N}/4 checks passing
Input Validation: {N}/4 checks passing
Edge Cases:      {N}/5 checks passing
Security:        {N}/5 checks passing
Accessibility:   {N}/5 checks passing

Total: {N}/28 — {WEAK | ACCEPTABLE | SOLID}

Critical gaps (fix these):
  ❌ {gap 1 — with file path}
  ❌ {gap 2 — with file path}
  ❌ {gap 3 — with file path}

Nice to have (skip if tight on time):
  ⚠️ {gap — with file path}
  ⚠️ {gap — with file path}
---
```

Ask via AskUserQuestion:
```
Fix all critical gaps? ({N} files to create/modify, ~{estimate} minutes)
  Y = Fix all critical gaps (recommended)
  all = Fix everything including nice-to-have
  pick = Let me choose which ones
  n = Cancel
```

### STEP 2: Implementation (ordered by impact)

Fix gaps in this priority order:

**Priority 1 — Security** (data loss / breach risk)
1. Add missing auth checks on protected routes
2. Add server-side validation on all unvalidated inputs
3. Add ENV validation if missing
4. Fix exposed secrets or missing RLS

**Priority 2 — Error Handling** (user sees crash)
1. Add global error boundary
2. Add try/catch to unprotected API routes/actions
3. Add form error display for validation failures
4. Add network error fallbacks

**Priority 3 — Loading States** (user sees blank)
1. Add page loading states
2. Add button loading during form submission
3. Add skeleton components for async data

**Priority 4 — Edge Cases** (user hits dead end)
1. Add empty states for lists/tables
2. Add auth expiry redirect
3. Add payment failure handling

**Priority 5 — Accessibility** (user can't use)
1. Add missing form labels
2. Fix heading hierarchy
3. Add focus management on modals

For each fix, follow the existing architecture. Don't refactor — just add the missing piece.

### STEP 3: Verification

After all fixes:
1. Run build: `npm run build` or equivalent
2. Report what was added

```
--- HARDENING COMPLETE ---
Before: {N}/28
After:  {N}/28

Added:
  ✅ {what was added} ({file})
  ✅ {what was added} ({file})
  ...

Still missing (user chose to skip):
  ○ {what's left}

The project is now {ACCEPTABLE | SOLID} for production.
---
```

## Rules

1. **FIX, don't rewrite** — add the missing piece, don't refactor the file
2. **Match existing patterns** — if the project uses try/catch, don't introduce Result<T>
3. **Security first** — always fix security gaps even if user says "pick"
4. **No new dependencies** unless absolutely necessary (prefer native solutions)
5. **Keep fixes small** — each fix should be < 30 lines. If bigger, it's a refactor, not hardening
6. **Test after** — run build to verify nothing broke
