# Skill: orchestre-recover

## Metadata
- **Name**: orchestre-recover
- **Description**: Scans a chaotic vibe-coded project and proposes a restructuration plan into clean, isolated features — without breaking anything.
- **Trigger**: /orchestre-recover, "fix my architecture", "restructure this", "this code is a mess", "clean up this project"

## Process

### STEP 1: Deep Scan (1-2 minutes)

Analyze the entire project structure. This is the most important step — understand before proposing changes.

**Scan these dimensions:**

1. **File Organization**
   - Count files per directory
   - Find monolith files (>200 lines)
   - Find orphan files (not imported anywhere)
   - Find circular imports
   - Detect if there's any structure or just a flat dump

2. **Architecture Violations**
   - DB calls in components/pages (R1 violation)
   - Data fetching in UI components (R2 violation)
   - Manual types instead of schema-derived (R3 violation)
   - Unhandled throws in business logic (R4 violation)
   - Cross-feature imports (R5 violation)
   - Magic strings scattered around (R8 violation)

3. **Code Patterns**
   - `any` type count
   - Hardcoded colors count
   - Direct `fetch()` in components count
   - Missing error handling count
   - Duplicate code patterns

4. **Feature Detection**
   - What features exist? (auth, CRUD, payments, dashboard, etc.)
   - Which files belong to which feature?
   - What's shared vs feature-specific?

Report:

```
--- ARCHITECTURE SCAN ---
Project: {name from package.json}
Framework: {detected}
Files: {total} ({N} TypeScript, {N} components, {N} styles)

Structure: {FLAT | PARTIAL | ORGANIZED}
Monolith files (>200 lines): {N}
  - {path} ({lines} lines) — {what it contains}
  - {path} ({lines} lines)

Architecture Violations:
  R1 (logic in UI): {N} files
  R2 (fetch in components): {N} instances
  R3 (manual types): {N} files without schemas
  R4 (unhandled throws): {N} instances
  R5 (cross-feature imports): {N} imports
  R8 (magic strings): {N} instances

Code Quality:
  `any` types: {N}
  Hardcoded colors: {N}
  Missing error handling: {N} routes/actions

Detected Features:
  1. {feature} — {files involved}
  2. {feature} — {files involved}
  3. {feature} — {files involved}
  ...

Severity: {LOW | MEDIUM | HIGH | CRITICAL}
---
```

### STEP 2: Recovery Plan

Based on the scan, propose a phased restructuration plan. The key constraint: **never break existing functionality**.

```
--- RECOVERY PLAN ---
Severity: {level}
Estimated effort: {N} steps, ~{time}

Phase 1: CREATE structure (safe — adds folders, doesn't move anything)
  1. Create lib/queries/ (or src/lib/server/queries/)
  2. Create lib/mutations/
  3. Create lib/schemas/
  4. Create components/{feature}/ for each detected feature

Phase 2: EXTRACT business logic (medium risk — moves code to new files)
  {For each monolith file:}
  5. Extract {function} from {monolith} → lib/queries/{name}.ts
  6. Extract {function} from {monolith} → lib/mutations/{name}.ts
  7. Replace inline code with import from new file
  {Leave original file as thin wrapper}

Phase 3: EXTRACT schemas (low risk — adds types)
  8. Create lib/schemas/{entity}.ts with Zod schema
  9. Replace manual types with z.infer<typeof schema>

Phase 4: ISOLATE features (medium risk — reorganizes components)
  10. Move {component} to components/{feature}/
  11. Move {component} to components/{feature}/
  12. Update imports

Phase 5: CLEAN UP (low risk — remove dead code)
  13. Remove orphan files: {list}
  14. Remove duplicate code in: {list}

NOT included (out of scope for recovery):
  - Rewriting working logic
  - Changing frameworks or libraries
  - Adding new features
  - Performance optimization
---
```

Ask via AskUserQuestion:
```
Execute this recovery plan?
  Y = Execute all phases
  phase1 = Only create structure (safest)
  pick = Let me choose phases
  n = Cancel (just keep the plan as reference)
```

### STEP 3: Execution

Execute the chosen phases. For each step:

1. **Create the new file** with the extracted code
2. **Update the original file** to import from the new location
3. **Verify** the import chain works (no circular deps)
4. After each phase, run `npx tsc --noEmit` to verify nothing broke

**Critical rules during execution:**
- NEVER delete the original code before the new code works
- ALWAYS keep the original as a fallback during migration
- ONE file at a time — commit-sized changes
- If a step fails, STOP and report. Don't cascade.

### STEP 4: Post-Recovery Report

```
--- RECOVERY COMPLETE ---
Before:
  Structure: {FLAT/PARTIAL}
  Violations: {N}
  Monolith files: {N}

After:
  Structure: {ORGANIZED}
  Violations: {N} (reduced by {percent}%)
  Monolith files: {N}

Files created: {N}
Files modified: {N}
Files deleted: {N}

Remaining issues (manual attention needed):
  - {issue} in {file}
  - {issue} in {file}

Next steps:
  1. Run npm run dev and test all features
  2. Run /orchestre-harden to add error handling
  3. Run /orchestre-extend to add new features safely
---
```

## Rules

1. **NEVER break working functionality** — this is the #1 rule. If it works, keep it working.
2. **SCAN before PLAN before EXECUTE** — never jump to execution
3. **One step at a time** — don't batch multiple file moves
4. **Verify after each phase** — run type check, ensure imports work
5. **Preserve git history** — prefer `git mv` over delete+create when possible
6. **Don't impose conventions on non-Orchestre projects** — adapt to what exists
7. **Recovery != rewrite** — extract and organize, don't reimagine
8. **If the project is too far gone** — be honest. Say "start over with /orchestre-go" if restructuring would take longer than rebuilding.
