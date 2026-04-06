# BriefV1 Contract

> Defines the structure and lint rules for PROJECT.md in Orchestre V16.
> Produced by: User
> Consumed by: Wave 0 (wave-brief agent)
> Location: `PROJECT.md` in project root

---

## Overview

The brief is the user-authored project description. Wave 0 parses and lints it,
producing a validated brief layer for the AI Bundle. The brief does not have a
strict schema -- it is a Markdown document with expected sections. The lint
checks validate completeness and quality.

---

## Expected Sections

| Section | Required | Description |
|---------|----------|-------------|
| Project Name | Yes | H1 heading with project name |
| Description | Yes | 1-3 paragraphs describing the project |
| Target Users | Yes | Who will use this product |
| Core Features | Yes | Bulleted list of features (minimum 1) |
| Tech Stack | No | Preferred technologies (defaults applied if missing) |
| Design | No | Design preferences, color scheme, inspiration |
| Authentication | No | Auth requirements (defaults to email/password) |
| Billing | No | Payment/subscription requirements |
| Pages | No | List of pages/routes |
| API | No | API endpoint requirements |
| Constraints | No | Non-functional requirements, deadlines |
| Mode | No | "greenfield" or "brownfield" |

---

## Lint Checks

### FATAL (blocks Wave 1)

| ID | Check | Rule |
|----|-------|------|
| L01 | Project name present | H1 heading exists and is non-empty |
| L02 | Description present | At least one paragraph after H1 |
| L03 | Features listed | At least 1 feature in Core Features section |
| L04 | No secrets in brief | No API keys, tokens, passwords in plain text |
| L05 | File is valid Markdown | Parses without errors |

### WARNING (logged, does not block)

| ID | Check | Rule |
|----|-------|------|
| L06 | Target users defined | "Target Users" section exists with content |
| L07 | Tech stack specified | "Tech Stack" section exists (defaults used if missing) |
| L08 | Authentication section | Auth requirements mentioned somewhere |
| L09 | Reasonable feature count | Between 2 and 20 features listed |
| L10 | No ambiguous requirements | No "maybe", "possibly", "TBD" in feature descriptions |
| L11 | Pages or routes described | At least one page/route mentioned |
| L13 | Mode field present | "greenfield" or "brownfield" stated explicitly |

### INFO (logged only)

| ID | Check | Rule |
|----|-------|------|
| L12 | Design inspiration URL | A URL is provided for design reference (enables WebFetch in wave-design) |

---

## Project Weight Calculation

Project weight determines cost profile defaults, model selection, and
parallelization strategy.

### Scoring

| Factor | XS (1) | S (2) | M (3) | L (4) | XL (5) |
|--------|--------|-------|-------|-------|--------|
| Feature count | 1-2 | 3-4 | 5-8 | 9-14 | 15+ |
| Has auth | - | +1 | +1 | +1 | +1 |
| Has billing | - | - | +1 | +1 | +1 |
| Has real-time | - | - | +1 | +1 | +1 |
| Has file upload | - | - | +0.5 | +0.5 | +0.5 |
| Has API integrations | - | - | +0.5 | +0.5 | +0.5 |
| Multi-tenant | - | - | - | +1 | +1 |

### Calculation

```
base_score = feature_count_score
modifiers = sum of applicable modifiers
total = base_score + modifiers

XS: total <= 2
S:  total <= 4
M:  total <= 7
L:  total <= 10
XL: total > 10
```

### Weight Impact

| Weight | Default profile | Parallel | Model |
|--------|----------------|----------|-------|
| XS | budget | off | claude-sonnet-4-20250514 |
| S | budget | off | claude-sonnet-4-20250514 |
| M | balanced | on (if >= 2 independent features) | mixed |
| L | balanced | on | mixed |
| XL | premium | on | claude-opus-4-6 primary |

---

## Brief Parsing

Wave 0 parses the brief into a structured object:

```json
{
  "project_name": "string (from H1)",
  "description": "string (paragraphs after H1)",
  "mode": "greenfield | brownfield | null",
  "target_users": "string | null",
  "features": [
    {
      "name": "string",
      "description": "string",
      "raw_text": "string (original bullet text)"
    }
  ],
  "tech_stack": {
    "framework": "string | null",
    "database": "string | null",
    "auth": "string | null",
    "hosting": "string | null",
    "payment": "string | null",
    "styling": "string | null"
  },
  "design": {
    "inspiration_url": "string | null",
    "color_scheme": "string | null",
    "style_notes": "string | null"
  },
  "authentication": "string | null",
  "billing": "string | null",
  "pages": ["string"],
  "api_endpoints": ["string"],
  "constraints": ["string"]
}
```

### Default Tech Stack (applied when not specified)

| Component | Default |
|-----------|---------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.x |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Vercel |
| Styling | Tailwind CSS 4 + shadcn/ui |
| State | React Server Components + Zustand |

---

## Output

Wave 0 produces:

1. `brief_layer` object (stored in AI Bundle)
2. `orchestre:brief_summary` memory key
3. `orchestre:project_weight` memory key
4. `orchestre:lint_results` memory key
5. `WAVE_0_DONE` marker in orchestre.lock

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-01 | Initial BriefV1 with L01-L11 |
| 1.1.0 | 2026-04-01 | Added L12 (design inspiration URL), L13 (mode field). Updated weight calculation. |
