# AiBundleV16 Contract

> Defines the structure and validation gates for `ai-bundle.json` in Orchestre V16.
> Produced by: Orchestrator (assembled from wave outputs)
> Consumed by: Wave-build agents, wave-audit agent, resume logic

---

## Overview

The AI Bundle is the composite artefact that packages all Orchestre outputs into
a single validated structure. It serves as the complete context for wave-build
agents and the input for the audit wave. Each layer corresponds to a specific
wave output and has its own validation gate.

---

## Layers

| Layer | Source | Wave | Required |
|-------|--------|------|----------|
| `brief_layer` | PROJECT.md (parsed) | 0 | Yes |
| `intent_v2` | intent.json | 1 | Yes |
| `plan_v2` | plan.json | 2 | Yes |
| `state_v2` | orchestre.lock | All | Yes |
| `prompt_bundle` | Prompts from plan.json | 2 | Yes |
| `docs_bundle` | Fixed-asset docs (architecture, patterns) | 0 | Yes |
| `doctor_report` | Pre-build validation results | 2 | Yes |
| `audit_report` | Wave 4 audit output | 4 | No (only after Wave 4) |
| `hooks_config` | hooks/settings.json | 0 | Yes |
| `agent_config` | Per-feature agent configuration from intent | 1 | Yes |

---

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "AiBundleV16",
  "type": "object",
  "required": [
    "version",
    "project_id",
    "brief_layer",
    "intent_v2",
    "plan_v2",
    "state_v2",
    "prompt_bundle",
    "docs_bundle",
    "doctor_report",
    "hooks_config",
    "agent_config",
    "validation_gates",
    "assembled_at"
  ],
  "properties": {
    "version": {
      "type": "string",
      "const": "16.0.0",
      "description": "AiBundleV16 schema version"
    },
    "project_id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "brief_layer": {
      "$ref": "#/$defs/BriefLayer"
    },
    "intent_v2": {
      "type": "object",
      "description": "Full IntentV2 object (see IntentV2.md)"
    },
    "plan_v2": {
      "type": "object",
      "description": "Full PlanV2 object (see PlanV2.md)"
    },
    "state_v2": {
      "type": "object",
      "description": "Current StateV2 snapshot (see StateV2.md)"
    },
    "prompt_bundle": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/PromptEntry"
      },
      "description": "One prompt per feature for wave-build agents"
    },
    "docs_bundle": {
      "$ref": "#/$defs/DocsBundle"
    },
    "doctor_report": {
      "$ref": "#/$defs/DoctorReport"
    },
    "audit_report": {
      "type": ["object", "null"],
      "description": "Wave 4 audit output. Null before Wave 4 completes.",
      "properties": {
        "score": { "type": "integer", "minimum": 0, "maximum": 100 },
        "violations": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rule": { "type": "string" },
              "file": { "type": "string" },
              "severity": { "type": "string", "enum": ["fatal", "warning", "info"] },
              "message": { "type": "string" },
              "line": { "type": "integer" }
            }
          }
        },
        "recommendations": {
          "type": "array",
          "items": { "type": "string" }
        },
        "security_review": {
          "type": "object",
          "properties": {
            "passed": { "type": "boolean" },
            "findings": { "type": "array", "items": { "type": "string" } }
          }
        },
        "generated_at": { "type": "string", "format": "date-time" }
      }
    },
    "hooks_config": {
      "type": "object",
      "description": "Hooks configuration from hooks/settings.json",
      "properties": {
        "hooks": {
          "type": "object",
          "properties": {
            "PreToolUse": { "type": "array" },
            "PostToolUse": { "type": "array" },
            "PreCommit": { "type": "array" }
          }
        },
        "permissions": {
          "type": "object",
          "description": "Per-wave tool permissions"
        }
      }
    },
    "agent_config": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "model": { "type": "string" },
          "effort": { "type": "string" },
          "worktree": { "type": "boolean" },
          "hooks": { "type": "array", "items": { "type": "string" } },
          "max_retries": { "type": "integer" }
        }
      },
      "description": "Per-feature agent configuration from IntentV2"
    },
    "validation_gates": {
      "$ref": "#/$defs/ValidationGates"
    },
    "assembled_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "$defs": {
    "BriefLayer": {
      "type": "object",
      "required": ["project_name", "description", "lint_results", "project_weight"],
      "properties": {
        "project_name": { "type": "string" },
        "description": { "type": "string" },
        "mode": {
          "type": "string",
          "enum": ["greenfield", "brownfield"]
        },
        "design_inspiration": {
          "type": ["string", "null"],
          "format": "uri"
        },
        "lint_results": {
          "type": "object",
          "properties": {
            "fatal_count": { "type": "integer", "minimum": 0 },
            "warning_count": { "type": "integer", "minimum": 0 },
            "info_count": { "type": "integer", "minimum": 0 },
            "checks": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": { "type": "string" },
                  "severity": { "type": "string", "enum": ["FATAL", "WARNING", "INFO"] },
                  "passed": { "type": "boolean" },
                  "message": { "type": "string" }
                }
              }
            }
          }
        },
        "project_weight": {
          "type": "string",
          "enum": ["XS", "S", "M", "L", "XL"]
        },
        "raw_hash": {
          "type": "string",
          "pattern": "^sha256:[a-f0-9]{64}$"
        }
      }
    },
    "PromptEntry": {
      "type": "object",
      "required": ["feature_id", "system_prompt", "user_prompt"],
      "properties": {
        "feature_id": { "type": "string" },
        "system_prompt": { "type": "string" },
        "user_prompt": { "type": "string" },
        "context_files": { "type": "array", "items": { "type": "string" } },
        "reference_docs": { "type": "array", "items": { "type": "string" } }
      }
    },
    "DocsBundle": {
      "type": "object",
      "properties": {
        "architecture_rules": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "rule_id": { "type": "string" },
              "description": { "type": "string" },
              "scope": { "type": "string" },
              "enforced_by": { "type": "string" }
            }
          }
        },
        "patterns": {
          "type": "object",
          "description": "Code patterns and conventions",
          "properties": {
            "error_handling": { "type": "string" },
            "data_fetching": { "type": "string" },
            "auth_pattern": { "type": "string" },
            "api_routes": { "type": "string" }
          }
        },
        "folder_structure": {
          "type": "object",
          "description": "Expected folder structure with descriptions",
          "additionalProperties": { "type": "string" }
        }
      }
    },
    "DoctorReport": {
      "type": "object",
      "required": ["fatal", "warnings", "checks"],
      "properties": {
        "fatal": {
          "type": "integer",
          "minimum": 0,
          "description": "Count of fatal issues. Must be 0 for Wave 3 to proceed."
        },
        "warnings": {
          "type": "integer",
          "minimum": 0
        },
        "checks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "name": { "type": "string" },
              "passed": { "type": "boolean" },
              "severity": { "type": "string", "enum": ["fatal", "warning", "info"] },
              "message": { "type": "string" }
            }
          }
        },
        "generated_at": {
          "type": "string",
          "format": "date-time"
        }
      }
    },
    "ValidationGates": {
      "type": "object",
      "required": [
        "brief_lint_zero_fatal",
        "intent_has_features",
        "task_count_valid",
        "prompt_count_valid",
        "doctor_report_clean",
        "hooks_config_valid",
        "parallel_groups_valid",
        "agent_sessions_recorded",
        "all_passed"
      ],
      "properties": {
        "brief_lint_zero_fatal": {
          "type": "boolean",
          "description": "True if brief_layer.lint_results.fatal_count = 0"
        },
        "intent_has_features": {
          "type": "boolean",
          "description": "True if intent_v2.features.length >= 1"
        },
        "task_count_valid": {
          "type": "boolean",
          "description": "True if plan_v2.tasks.length >= intent_v2.features.length + 1"
        },
        "prompt_count_valid": {
          "type": "boolean",
          "description": "True if prompt_bundle.length = intent_v2.features.length"
        },
        "doctor_report_clean": {
          "type": "boolean",
          "description": "True if doctor_report.fatal = 0"
        },
        "hooks_config_valid": {
          "type": "boolean",
          "description": "True if all hooks referenced in plan tasks exist in hooks_config"
        },
        "parallel_groups_valid": {
          "type": "boolean",
          "description": "True if no circular dependencies exist within parallel groups and no file conflicts"
        },
        "agent_sessions_recorded": {
          "type": "boolean",
          "description": "True if agent_sessions has entries for all completed waves"
        },
        "all_passed": {
          "type": "boolean",
          "description": "True if all gates passed"
        },
        "details": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "gate": { "type": "string" },
              "passed": { "type": "boolean" },
              "message": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

---

## Validation Gates

The orchestrator validates the bundle before allowing each wave to proceed.
All gates MUST pass before the target wave begins.

### Gate Matrix

| Gate | Check | Required before |
|------|-------|-----------------|
| `brief_lint_zero_fatal` | `brief_layer.lint_results.fatal_count = 0` | Wave 1 |
| `intent_has_features` | `intent_v2.features.length >= 1` | Wave 2 |
| `task_count_valid` | `plan_v2.tasks.length >= intent_v2.features.length + 1` | Wave 3 |
| `prompt_count_valid` | `prompt_bundle.length = intent_v2.features.length` | Wave 3 |
| `doctor_report_clean` | `doctor_report.fatal = 0` | Wave 3 |
| `hooks_config_valid` | All `hooks_config` entries in plan tasks reference existing hooks | Wave 3 |
| `parallel_groups_valid` | No circular deps in groups, no file overlaps | Wave 3 |
| `agent_sessions_recorded` | Sessions recorded for all completed waves | Resume |

### Gate Failure Behavior

| Severity | Action |
|----------|--------|
| FATAL gate failure | Halt orchestration. Report to user via AskUserQuestion. |
| WARNING gate | Log warning. Continue with user confirmation. |

---

## Assembly Process

The orchestrator assembles the bundle after each wave completes:

1. **After Wave 0**: `brief_layer` and `docs_bundle` are populated.
2. **After Wave 1**: `intent_v2` and `agent_config` are added.
3. **After Wave 2**: `plan_v2`, `prompt_bundle`, `doctor_report`, and
   `hooks_config` are added. Full validation runs.
4. **After Wave 3**: `state_v2` is updated with build results.
5. **After Wave 4**: `audit_report` is added.

At each step, `validation_gates` is recalculated and `assembled_at` is updated.

---

## Example (Post-Wave 2)

```json
{
  "version": "16.0.0",
  "project_id": "acme-invoicing",
  "brief_layer": {
    "project_name": "Acme Invoicing Platform",
    "description": "SaaS invoicing platform with Stripe billing",
    "mode": "greenfield",
    "design_inspiration": "https://linear.app",
    "lint_results": {
      "fatal_count": 0,
      "warning_count": 1,
      "info_count": 2,
      "checks": [
        {"id": "L01", "severity": "FATAL", "passed": true, "message": "Project name present"},
        {"id": "L12", "severity": "INFO", "passed": true, "message": "Design inspiration URL provided"},
        {"id": "L13", "severity": "WARNING", "passed": true, "message": "Mode field present: greenfield"}
      ]
    },
    "project_weight": "M",
    "raw_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2"
  },
  "intent_v2": { "version": "2.0.0", "...": "see IntentV2.md" },
  "plan_v2": { "version": "2.0.0", "...": "see PlanV2.md" },
  "state_v2": { "version": "2.0.0", "...": "see StateV2.md" },
  "prompt_bundle": [
    {
      "feature_id": "F01",
      "system_prompt": "You are implementing authentication...",
      "user_prompt": "Create auth flow with Supabase...",
      "context_files": ["lib/supabase/client.ts"],
      "reference_docs": ["https://supabase.com/docs/guides/auth"]
    }
  ],
  "docs_bundle": {
    "architecture_rules": [
      {"rule_id": "R1", "description": "No direct DB calls outside lib/db/", "scope": "app/, components/", "enforced_by": "pre-write-guard"},
      {"rule_id": "R2", "description": "Semantic design tokens only", "scope": "*.tsx, *.css", "enforced_by": "pre-write-guard"}
    ],
    "patterns": {
      "error_handling": "Use Result<T> = {ok: true, data: T} | {ok: false, error: string}",
      "data_fetching": "Server Components with async/await, client uses React Query",
      "auth_pattern": "Middleware checks session, passes user to RSC via headers",
      "api_routes": "Route handlers in app/api/ with middleware chain"
    },
    "folder_structure": {
      "app/": "Next.js App Router pages and layouts",
      "components/": "Reusable UI components",
      "lib/": "Business logic, utilities, types",
      "lib/db/": "Database queries and mutations",
      "lib/auth/": "Authentication helpers",
      "lib/billing/": "Payment and subscription logic"
    }
  },
  "doctor_report": {
    "fatal": 0,
    "warnings": 0,
    "checks": [
      {"name": "schema_validation", "passed": true, "severity": "fatal", "message": "All schemas valid"},
      {"name": "dependency_check", "passed": true, "severity": "fatal", "message": "No circular dependencies"},
      {"name": "file_conflict_check", "passed": true, "severity": "fatal", "message": "No parallel file conflicts"}
    ],
    "generated_at": "2026-04-01T10:15:00.000Z"
  },
  "audit_report": null,
  "hooks_config": {
    "hooks": {
      "PreToolUse": [{"matcher": "Write|Edit", "command": "bash hooks/pre-write-guard.sh"}],
      "PostToolUse": [{"matcher": "Write|Edit", "command": "bash hooks/post-write-check.sh"}],
      "PreCommit": [{"command": "bash hooks/pre-commit-audit.sh"}]
    },
    "permissions": {
      "wave-3": {"allow": ["*"]}
    }
  },
  "agent_config": {
    "F01": {"model": "claude-opus-4-6", "effort": "high", "worktree": true, "hooks": ["pre-write-guard", "post-write-check"], "max_retries": 3}
  },
  "validation_gates": {
    "brief_lint_zero_fatal": true,
    "intent_has_features": true,
    "task_count_valid": true,
    "prompt_count_valid": true,
    "doctor_report_clean": true,
    "hooks_config_valid": true,
    "parallel_groups_valid": true,
    "agent_sessions_recorded": true,
    "all_passed": true,
    "details": [
      {"gate": "brief_lint_zero_fatal", "passed": true, "message": "0 fatal issues in brief lint"},
      {"gate": "intent_has_features", "passed": true, "message": "5 features found"},
      {"gate": "task_count_valid", "passed": true, "message": "6 tasks >= 5 features + 1"},
      {"gate": "prompt_count_valid", "passed": true, "message": "5 prompts = 5 features"},
      {"gate": "doctor_report_clean", "passed": true, "message": "0 fatal issues in doctor report"},
      {"gate": "hooks_config_valid", "passed": true, "message": "All 3 hooks exist and are valid"},
      {"gate": "parallel_groups_valid", "passed": true, "message": "2 parallel groups, no conflicts"},
      {"gate": "agent_sessions_recorded", "passed": true, "message": "Sessions for waves 0-2 recorded"}
    ]
  },
  "assembled_at": "2026-04-01T10:16:00.000Z"
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 15.0.0 | 2025-11-01 | Initial AiBundle (V15) |
| 16.0.0 | 2026-04-01 | Added audit_report, hooks_config, agent_config layers. Extended validation gates with hooks, parallel groups, agent sessions. |
