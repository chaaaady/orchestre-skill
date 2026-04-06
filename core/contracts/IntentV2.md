# IntentV2 Contract

> Defines the structure and validation rules for `intent.json` in Orchestre V16.
> Produced by: Wave 1 (wave-intent agent)
> Consumed by: Wave 2 (wave-plan agent), Wave 3 (wave-build agents)

---

## Overview

The Intent artefact translates a validated PROJECT.md brief into a structured
feature list with parallel execution groups, agent configuration, and research
URL whitelists. It is the single source of truth for "what to build" before
planning begins.

---

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "IntentV2",
  "type": "object",
  "required": [
    "version",
    "project_id",
    "project_name",
    "project_weight",
    "features",
    "parallel_groups",
    "agent_config",
    "memory_keys",
    "design_system_source",
    "research_urls",
    "generated_at",
    "brief_hash"
  ],
  "properties": {
    "version": {
      "type": "string",
      "const": "2.0.0",
      "description": "IntentV2 schema version"
    },
    "project_id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$",
      "description": "Unique project identifier derived from project name"
    },
    "project_name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120,
      "description": "Human-readable project name from brief"
    },
    "project_weight": {
      "type": "string",
      "enum": ["XS", "S", "M", "L", "XL"],
      "description": "Complexity classification from brief lint"
    },
    "features": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/Feature"
      },
      "description": "Ordered list of features to implement"
    },
    "parallel_groups": {
      "type": "array",
      "items": {
        "type": "array",
        "items": {
          "type": "string",
          "pattern": "^F[0-9]{2,3}$"
        },
        "minItems": 1
      },
      "description": "Groups of feature IDs that can execute in parallel. Features not in any group execute sequentially."
    },
    "agent_config": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/$defs/AgentConfig"
      },
      "description": "Per-feature agent configuration. Keys are feature IDs."
    },
    "memory_keys": {
      "type": "array",
      "items": {
        "type": "string",
        "pattern": "^orchestre:"
      },
      "description": "Memory keys persisted by Wave 1 for downstream waves"
    },
    "design_system_source": {
      "type": "string",
      "enum": ["extracted", "generated", "provided"],
      "description": "How the design system was determined. 'extracted' = derived from brief/inspiration URL, 'generated' = created by wave-design agent, 'provided' = user supplied design tokens."
    },
    "research_urls": {
      "type": "array",
      "items": {
        "type": "string",
        "format": "uri"
      },
      "description": "Whitelisted URLs for WebFetch during Wave 3 build"
    },
    "design_tokens": {
      "type": "object",
      "description": "Semantic design tokens extracted or generated. Optional if design_system_source is 'provided' and tokens are in a separate file.",
      "properties": {
        "colors": {
          "type": "object",
          "properties": {
            "primary": { "type": "string" },
            "secondary": { "type": "string" },
            "accent": { "type": "string" },
            "destructive": { "type": "string" },
            "muted": { "type": "string" },
            "background": { "type": "string" },
            "foreground": { "type": "string" },
            "border": { "type": "string" }
          }
        },
        "fonts": {
          "type": "object",
          "properties": {
            "heading": { "type": "string" },
            "body": { "type": "string" },
            "mono": { "type": "string" }
          }
        },
        "radii": {
          "type": "object",
          "properties": {
            "sm": { "type": "string" },
            "md": { "type": "string" },
            "lg": { "type": "string" },
            "full": { "type": "string" }
          }
        }
      }
    },
    "tech_stack": {
      "type": "object",
      "description": "Resolved technology stack",
      "properties": {
        "framework": { "type": "string" },
        "language": { "type": "string" },
        "database": { "type": "string" },
        "auth": { "type": "string" },
        "hosting": { "type": "string" },
        "payment": { "type": "string" },
        "styling": { "type": "string" },
        "state": { "type": "string" }
      }
    },
    "generated_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of generation"
    },
    "brief_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$",
      "description": "SHA-256 hash of the brief that produced this intent"
    }
  },
  "$defs": {
    "Feature": {
      "type": "object",
      "required": ["feature_id", "name", "description", "priority", "category", "files_hint"],
      "properties": {
        "feature_id": {
          "type": "string",
          "pattern": "^F[0-9]{2,3}$",
          "description": "Unique feature identifier (e.g., F01, F02)"
        },
        "name": {
          "type": "string",
          "minLength": 1,
          "maxLength": 80,
          "description": "Short feature name"
        },
        "description": {
          "type": "string",
          "description": "What this feature does and why"
        },
        "priority": {
          "type": "string",
          "enum": ["critical", "high", "medium", "low"],
          "description": "Implementation priority"
        },
        "category": {
          "type": "string",
          "enum": ["auth", "billing", "ui", "api_endpoint", "data_model", "integration", "infrastructure", "design_system"],
          "description": "Feature category for routing and security classification"
        },
        "files_hint": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Expected file paths this feature will create or modify"
        },
        "depends_on": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^F[0-9]{2,3}$"
          },
          "description": "Feature IDs that must complete before this one"
        },
        "acceptance_criteria": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Testable criteria for feature completion"
        }
      }
    },
    "AgentConfig": {
      "type": "object",
      "properties": {
        "model": {
          "type": "string",
          "description": "Model override for this feature's agent (e.g., claude-sonnet-4-20250514 for simpler features)"
        },
        "effort": {
          "type": "string",
          "enum": ["low", "medium", "high"],
          "description": "Effort level controlling token budget and review depth"
        },
        "worktree": {
          "type": "boolean",
          "description": "Whether this feature requires its own git worktree (true if in a parallel group)"
        },
        "hooks": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Hook names that apply to this feature's writes"
        },
        "max_retries": {
          "type": "integer",
          "minimum": 0,
          "maximum": 5,
          "default": 2,
          "description": "Maximum retry attempts on hook or typecheck failure"
        }
      }
    }
  }
}
```

---

## Example

```json
{
  "version": "2.0.0",
  "project_id": "acme-invoicing",
  "project_name": "Acme Invoicing Platform",
  "project_weight": "M",
  "features": [
    {
      "feature_id": "F01",
      "name": "Authentication",
      "description": "Email/password and OAuth sign-in with Supabase Auth, protected routes, session management",
      "priority": "critical",
      "category": "auth",
      "files_hint": [
        "lib/auth/client.ts",
        "lib/auth/middleware.ts",
        "app/(auth)/login/page.tsx",
        "app/(auth)/signup/page.tsx"
      ],
      "depends_on": [],
      "acceptance_criteria": [
        "User can sign up with email/password",
        "User can sign in with Google OAuth",
        "Protected routes redirect to /login",
        "Session persists across page reloads"
      ]
    },
    {
      "feature_id": "F02",
      "name": "Design System",
      "description": "Shared UI components using shadcn/ui with semantic design tokens",
      "priority": "critical",
      "category": "design_system",
      "files_hint": [
        "components/ui/button.tsx",
        "components/ui/input.tsx",
        "components/ui/card.tsx",
        "lib/design-tokens.ts",
        "app/globals.css"
      ],
      "depends_on": [],
      "acceptance_criteria": [
        "All components use semantic color tokens",
        "Dark mode support via CSS variables",
        "Components are accessible (ARIA labels)"
      ]
    },
    {
      "feature_id": "F03",
      "name": "Invoice CRUD",
      "description": "Create, read, update, delete invoices with real-time status updates",
      "priority": "high",
      "category": "data_model",
      "files_hint": [
        "lib/db/invoices.ts",
        "app/api/invoices/route.ts",
        "app/(dashboard)/invoices/page.tsx",
        "app/(dashboard)/invoices/[id]/page.tsx"
      ],
      "depends_on": ["F01", "F02"],
      "acceptance_criteria": [
        "User can create a new invoice",
        "Invoice list shows status badges",
        "Editing an invoice updates in real-time"
      ]
    },
    {
      "feature_id": "F04",
      "name": "Stripe Billing",
      "description": "Subscription management with Stripe Checkout and webhook handling",
      "priority": "high",
      "category": "billing",
      "files_hint": [
        "lib/billing/stripe.ts",
        "app/api/webhooks/stripe/route.ts",
        "app/(dashboard)/billing/page.tsx"
      ],
      "depends_on": ["F01"],
      "acceptance_criteria": [
        "User can subscribe to a plan",
        "Webhook updates subscription status",
        "Billing page shows current plan"
      ]
    },
    {
      "feature_id": "F05",
      "name": "PDF Export",
      "description": "Generate PDF invoices from templates",
      "priority": "medium",
      "category": "integration",
      "files_hint": [
        "lib/pdf/generator.ts",
        "lib/pdf/templates/invoice.tsx"
      ],
      "depends_on": ["F03"],
      "acceptance_criteria": [
        "PDF renders with correct invoice data",
        "PDF includes company logo and branding"
      ]
    }
  ],
  "parallel_groups": [
    ["F01", "F02"],
    ["F03", "F04"]
  ],
  "agent_config": {
    "F01": {
      "model": "claude-opus-4-6",
      "effort": "high",
      "worktree": true,
      "hooks": ["pre-write-guard", "post-write-check"],
      "max_retries": 3
    },
    "F02": {
      "model": "claude-sonnet-4-20250514",
      "effort": "medium",
      "worktree": true,
      "hooks": ["pre-write-guard"],
      "max_retries": 2
    },
    "F03": {
      "model": "claude-opus-4-6",
      "effort": "high",
      "worktree": true,
      "hooks": ["pre-write-guard", "post-write-check"],
      "max_retries": 2
    },
    "F04": {
      "model": "claude-opus-4-6",
      "effort": "high",
      "worktree": true,
      "hooks": ["pre-write-guard", "post-write-check", "pre-commit-audit"],
      "max_retries": 3
    },
    "F05": {
      "model": "claude-sonnet-4-20250514",
      "effort": "medium",
      "worktree": false,
      "hooks": ["pre-write-guard"],
      "max_retries": 2
    }
  },
  "memory_keys": [
    "orchestre:features",
    "orchestre:parallel_groups",
    "orchestre:design_system",
    "orchestre:tech_stack",
    "orchestre:research_urls"
  ],
  "design_system_source": "extracted",
  "research_urls": [
    "https://supabase.com/docs",
    "https://docs.stripe.com",
    "https://nextjs.org/docs",
    "https://ui.shadcn.com"
  ],
  "design_tokens": {
    "colors": {
      "primary": "hsl(222.2 47.4% 11.2%)",
      "secondary": "hsl(210 40% 96.1%)",
      "accent": "hsl(210 40% 96.1%)",
      "destructive": "hsl(0 84.2% 60.2%)",
      "muted": "hsl(210 40% 96.1%)",
      "background": "hsl(0 0% 100%)",
      "foreground": "hsl(222.2 47.4% 11.2%)",
      "border": "hsl(214.3 31.8% 91.4%)"
    },
    "fonts": {
      "heading": "Inter",
      "body": "Inter",
      "mono": "JetBrains Mono"
    },
    "radii": {
      "sm": "0.25rem",
      "md": "0.5rem",
      "lg": "0.75rem",
      "full": "9999px"
    }
  },
  "tech_stack": {
    "framework": "Next.js 15 (App Router)",
    "language": "TypeScript 5.x",
    "database": "Supabase (PostgreSQL)",
    "auth": "Supabase Auth",
    "hosting": "Vercel",
    "payment": "Stripe",
    "styling": "Tailwind CSS 4 + shadcn/ui",
    "state": "React Server Components + Zustand (client)"
  },
  "generated_at": "2026-04-01T10:00:00.000Z",
  "brief_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
}
```

---

## Validation Rules

1. `features` MUST contain at least 1 entry.
2. Every `feature_id` referenced in `parallel_groups` MUST exist in `features`.
3. Features within the same parallel group MUST NOT have `depends_on`
   relationships with each other (circular dependency within a group is invalid).
4. `agent_config` keys MUST be valid feature IDs.
5. If `agent_config[feature_id].worktree = true`, the feature MUST appear in
   at least one `parallel_groups` entry.
6. `memory_keys` MUST all start with `orchestre:`.
7. `research_urls` MUST be valid URLs matching the whitelist in CR rules.
8. `brief_hash` MUST match the SHA-256 of the PROJECT.md that was linted in Wave 0.
9. `files_hint` across features in the same parallel group MUST NOT overlap
   (enforced by PI-01).
10. `design_tokens` MUST be present if `design_system_source` is "extracted" or
    "generated".

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-01 | Initial IntentV1 |
| 2.0.0 | 2026-04-01 | Added parallel_groups, agent_config, memory_keys, design_system_source, research_urls |
