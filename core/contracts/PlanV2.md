# PlanV2 Contract

> Defines the structure and validation rules for `plan.json` in Orchestre V16.
> Produced by: Wave 2 (wave-plan agent)
> Consumed by: Wave 3 (wave-build agents), Wave 4 (wave-audit agent)

---

## Overview

The Plan artefact decomposes each feature from IntentV2 into ordered tasks with
file-level granularity, parallel execution metadata, hook configuration, LSP
checks, and security review flags. It includes cost estimation per task and
council validation results.

---

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "PlanV2",
  "type": "object",
  "required": [
    "version",
    "project_id",
    "intent_hash",
    "tasks",
    "prompts",
    "council_checks",
    "cost_estimate",
    "generated_at"
  ],
  "properties": {
    "version": {
      "type": "string",
      "const": "2.0.0",
      "description": "PlanV2 schema version"
    },
    "project_id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "intent_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$",
      "description": "SHA-256 hash of intent.json that produced this plan"
    },
    "tasks": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/Task"
      }
    },
    "prompts": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/Prompt"
      },
      "description": "One prompt per feature, used by wave-build agents"
    },
    "council_checks": {
      "$ref": "#/$defs/CouncilChecks"
    },
    "cost_estimate": {
      "$ref": "#/$defs/CostEstimate"
    },
    "generated_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "$defs": {
    "Task": {
      "type": "object",
      "required": [
        "task_id",
        "feature_id",
        "title",
        "description",
        "order",
        "files",
        "parallel_group",
        "worktree_required",
        "hooks_config",
        "lsp_checks",
        "security_review_required",
        "estimated_cost_usd",
        "real_cost_usd"
      ],
      "properties": {
        "task_id": {
          "type": "string",
          "pattern": "^T[0-9]{3,4}$",
          "description": "Unique task identifier (e.g., T001)"
        },
        "feature_id": {
          "type": "string",
          "pattern": "^F[0-9]{2,3}$",
          "description": "Parent feature ID"
        },
        "title": {
          "type": "string",
          "maxLength": 120
        },
        "description": {
          "type": "string",
          "description": "Detailed description of what the task produces"
        },
        "order": {
          "type": "integer",
          "minimum": 0,
          "description": "Execution order within the feature (0-indexed)"
        },
        "files": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/FileSpec"
          },
          "description": "Files this task creates or modifies"
        },
        "depends_on": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^T[0-9]{3,4}$"
          },
          "description": "Task IDs that must complete before this one"
        },
        "parallel_group": {
          "type": ["integer", "null"],
          "description": "Index into intent.parallel_groups array, or null if sequential"
        },
        "worktree_required": {
          "type": "boolean",
          "description": "True if this task must run in its own git worktree"
        },
        "hooks_config": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": ["pre-write-guard", "post-write-check", "pre-commit-audit"]
          },
          "description": "Which hooks apply to file writes in this task"
        },
        "lsp_checks": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "type-errors",
              "missing-imports",
              "missing-refs",
              "unused-exports",
              "circular-deps"
            ]
          },
          "description": "LSP-based checks to run after task completion"
        },
        "security_review_required": {
          "type": "boolean",
          "description": "True for auth, billing, api_endpoint category tasks"
        },
        "estimated_cost_usd": {
          "type": "number",
          "minimum": 0,
          "description": "Estimated cost for this task in USD"
        },
        "real_cost_usd": {
          "type": ["number", "null"],
          "description": "Actual cost after execution (null before execution)"
        }
      }
    },
    "FileSpec": {
      "type": "object",
      "required": ["path", "action"],
      "properties": {
        "path": {
          "type": "string",
          "description": "Relative file path from project root"
        },
        "action": {
          "type": "string",
          "enum": ["create", "modify", "delete"],
          "description": "What this task does to the file"
        },
        "description": {
          "type": "string",
          "description": "What changes are made to this file"
        }
      }
    },
    "Prompt": {
      "type": "object",
      "required": ["feature_id", "system_prompt", "user_prompt"],
      "properties": {
        "feature_id": {
          "type": "string",
          "pattern": "^F[0-9]{2,3}$"
        },
        "system_prompt": {
          "type": "string",
          "description": "System prompt for the wave-build agent handling this feature"
        },
        "user_prompt": {
          "type": "string",
          "description": "User prompt with specific implementation instructions"
        },
        "context_files": {
          "type": "array",
          "items": { "type": "string" },
          "description": "File paths the agent should read before building"
        },
        "reference_docs": {
          "type": "array",
          "items": { "type": "string" },
          "description": "URLs from research_urls the agent may fetch"
        }
      }
    },
    "CouncilChecks": {
      "type": "object",
      "required": [
        "task_count_valid",
        "dependency_graph_acyclic",
        "file_conflicts_none",
        "security_tasks_flagged",
        "worktree_conflict_check",
        "hook_compatibility_check",
        "all_passed"
      ],
      "properties": {
        "task_count_valid": {
          "type": "boolean",
          "description": "True if task_count >= feature_count + 1 (scaffold task)"
        },
        "dependency_graph_acyclic": {
          "type": "boolean",
          "description": "True if no circular dependencies exist in task graph"
        },
        "file_conflicts_none": {
          "type": "boolean",
          "description": "True if no two tasks in the same parallel group write to the same file"
        },
        "security_tasks_flagged": {
          "type": "boolean",
          "description": "True if all auth/billing/api_endpoint tasks have security_review_required=true"
        },
        "worktree_conflict_check": {
          "type": "boolean",
          "description": "True if worktree assignments are consistent (no conflicts in branch naming, no shared files across worktrees in same group)"
        },
        "hook_compatibility_check": {
          "type": "boolean",
          "description": "True if all hooks referenced in hooks_config exist and are compatible with the task's file types"
        },
        "all_passed": {
          "type": "boolean",
          "description": "True if all individual checks passed"
        },
        "details": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "check": { "type": "string" },
              "passed": { "type": "boolean" },
              "message": { "type": "string" }
            }
          },
          "description": "Detailed results for each check"
        }
      }
    },
    "CostEstimate": {
      "type": "object",
      "required": ["total_usd", "per_feature", "profile"],
      "properties": {
        "total_usd": {
          "type": "number",
          "minimum": 0,
          "description": "Total estimated cost across all tasks"
        },
        "per_feature": {
          "type": "object",
          "additionalProperties": {
            "type": "number"
          },
          "description": "Estimated cost per feature ID"
        },
        "profile": {
          "type": "string",
          "enum": ["premium", "balanced", "budget"],
          "description": "Cost profile used for estimation"
        },
        "model_mix": {
          "type": "object",
          "additionalProperties": {
            "type": "string"
          },
          "description": "Model assigned to each feature ID"
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
  "intent_hash": "sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
  "tasks": [
    {
      "task_id": "T000",
      "feature_id": "F00",
      "title": "Project Scaffold",
      "description": "Initialize Next.js project with TypeScript, Tailwind, shadcn/ui, Supabase client, folder structure",
      "order": 0,
      "files": [
        {"path": "package.json", "action": "create", "description": "Dependencies and scripts"},
        {"path": "tsconfig.json", "action": "create", "description": "TypeScript configuration"},
        {"path": "tailwind.config.ts", "action": "create", "description": "Tailwind with semantic tokens"},
        {"path": "next.config.ts", "action": "create", "description": "Next.js configuration"},
        {"path": "lib/supabase/client.ts", "action": "create", "description": "Supabase browser client"},
        {"path": "lib/supabase/server.ts", "action": "create", "description": "Supabase server client"},
        {"path": "lib/types/result.ts", "action": "create", "description": "Result<T> type for error handling"}
      ],
      "depends_on": [],
      "parallel_group": null,
      "worktree_required": false,
      "hooks_config": ["pre-write-guard"],
      "lsp_checks": ["type-errors"],
      "security_review_required": false,
      "estimated_cost_usd": 0.08,
      "real_cost_usd": null
    },
    {
      "task_id": "T001",
      "feature_id": "F01",
      "title": "Authentication Implementation",
      "description": "Supabase Auth with email/password, Google OAuth, session management, protected route middleware",
      "order": 1,
      "files": [
        {"path": "lib/auth/client.ts", "action": "create", "description": "Auth helper functions"},
        {"path": "lib/auth/middleware.ts", "action": "create", "description": "Route protection middleware"},
        {"path": "app/(auth)/login/page.tsx", "action": "create", "description": "Login page"},
        {"path": "app/(auth)/signup/page.tsx", "action": "create", "description": "Signup page"},
        {"path": "middleware.ts", "action": "create", "description": "Next.js middleware for auth"}
      ],
      "depends_on": ["T000"],
      "parallel_group": 0,
      "worktree_required": true,
      "hooks_config": ["pre-write-guard", "post-write-check"],
      "lsp_checks": ["type-errors", "missing-imports"],
      "security_review_required": true,
      "estimated_cost_usd": 0.25,
      "real_cost_usd": null
    }
  ],
  "prompts": [
    {
      "feature_id": "F01",
      "system_prompt": "You are a senior full-stack engineer implementing authentication for a Next.js 15 application using Supabase Auth. Follow the architecture rules R1-R8. Use Result<T> for all error handling in lib/. Use semantic design tokens only.",
      "user_prompt": "Implement the authentication feature as specified in the task. Create the auth client, middleware, login page, and signup page. Ensure OAuth with Google is configured. All sensitive operations must be server-side.",
      "context_files": ["lib/supabase/client.ts", "lib/supabase/server.ts", "lib/types/result.ts"],
      "reference_docs": ["https://supabase.com/docs/guides/auth"]
    }
  ],
  "council_checks": {
    "task_count_valid": true,
    "dependency_graph_acyclic": true,
    "file_conflicts_none": true,
    "security_tasks_flagged": true,
    "worktree_conflict_check": true,
    "hook_compatibility_check": true,
    "all_passed": true,
    "details": [
      {"check": "task_count", "passed": true, "message": "6 tasks >= 5 features + 1 scaffold"},
      {"check": "dependency_graph", "passed": true, "message": "No cycles detected"},
      {"check": "file_conflicts", "passed": true, "message": "No shared files in parallel groups 0 and 1"},
      {"check": "security_tasks", "passed": true, "message": "F01 (auth) and F04 (billing) flagged for security review"},
      {"check": "worktree_conflicts", "passed": true, "message": "All parallel group worktrees use distinct branches"},
      {"check": "hook_compatibility", "passed": true, "message": "All referenced hooks exist in hooks/settings.json"}
    ]
  },
  "cost_estimate": {
    "total_usd": 1.42,
    "per_feature": {
      "F00": 0.08,
      "F01": 0.25,
      "F02": 0.18,
      "F03": 0.35,
      "F04": 0.38,
      "F05": 0.18
    },
    "profile": "balanced",
    "model_mix": {
      "F00": "claude-opus-4-6",
      "F01": "claude-opus-4-6",
      "F02": "claude-sonnet-4-20250514",
      "F03": "claude-opus-4-6",
      "F04": "claude-opus-4-6",
      "F05": "claude-sonnet-4-20250514"
    }
  },
  "generated_at": "2026-04-01T10:15:00.000Z"
}
```

---

## Validation Rules

1. `tasks` array MUST contain at least `feature_count + 1` entries (one scaffold task T000).
2. `prompts` array MUST contain exactly one entry per feature in the intent.
3. Every `feature_id` in tasks MUST exist in the intent's `features` array.
4. `depends_on` MUST NOT create circular dependencies.
5. Tasks in the same `parallel_group` MUST NOT have `depends_on` references to
   each other.
6. If `parallel_group` is not null, `worktree_required` MUST be true.
7. Tasks with `security_review_required = true` MUST belong to features with
   category `auth`, `billing`, or `api_endpoint`.
8. All hooks in `hooks_config` MUST be defined in `hooks/settings.json`.
9. `real_cost_usd` MUST be null at plan generation time (filled during Wave 3).
10. `intent_hash` MUST match the SHA-256 of the intent.json consumed.
11. `council_checks.all_passed` MUST be true for the plan to be accepted.
    If false, Wave 2 MUST NOT write `WAVE_2_DONE`.

---

## Council Checks (Extended in V16)

The plan council performs the following validation checks before accepting the
plan:

| Check | Source | Severity |
|-------|--------|----------|
| Task count >= feature count + 1 | PlanV1 | FATAL |
| Dependency graph is acyclic | PlanV1 | FATAL |
| No file conflicts in parallel groups | V16 (PI-01) | FATAL |
| Security tasks properly flagged | PlanV1 | WARNING |
| Worktree assignments consistent | V16 (PI-01) | FATAL |
| Hook references valid | V16 (HE-01) | FATAL |
| Prompt count = feature count | PlanV1 | FATAL |
| Cost estimate within profile limits | PlanV1 | WARNING |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-01 | Initial PlanV1 |
| 2.0.0 | 2026-04-01 | Added parallel_group, worktree_required, hooks_config, lsp_checks, security_review_required, real_cost_usd. Extended council checks. |
