# StateV2 Contract (orchestre.lock)

> Defines the structure, merge rules, and validation for `orchestre.lock` in Orchestre V16.
> Read/written by: All waves, orchestrator, hooks
> Location: `.orchestre/orchestre.lock`

---

## Overview

`orchestre.lock` is the single source of truth for orchestration state. It tracks
wave completion, feature status, artefact integrity, session history, costs,
parallel execution state, hook logs, and native task mappings. It is the file
that enables resume, audit, and cost reporting.

---

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "StateV2",
  "type": "object",
  "required": [
    "version",
    "project_id",
    "hashes",
    "feature_status",
    "waves_completed",
    "runs",
    "agent_sessions",
    "memory_snapshot",
    "actual_costs",
    "parallel_execution",
    "hooks_log",
    "task_ids",
    "created_at",
    "updated_at"
  ],
  "properties": {
    "version": {
      "type": "string",
      "const": "2.0.0",
      "description": "StateV2 schema version"
    },
    "project_id": {
      "type": "string",
      "pattern": "^[a-z0-9-]+$"
    },
    "hashes": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "pattern": "^sha256:[a-f0-9]{64}$"
      },
      "description": "SHA-256 hashes of all Orchestre artefacts for integrity verification"
    },
    "feature_status": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "enum": ["pending", "queued", "building", "done", "error", "rework", "skipped"]
      },
      "description": "Current status of each feature by feature_id"
    },
    "waves_completed": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["WAVE_0_DONE", "WAVE_1_DONE", "WAVE_2_DONE", "WAVE_3_DONE", "WAVE_4_DONE"]
      },
      "description": "Ordered list of completed wave markers"
    },
    "runs": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/Run"
      },
      "description": "Append-only log of orchestration runs"
    },
    "agent_sessions": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      },
      "description": "Map of wave identifier to Claude Code session_id for resume capability. Keys: 'wave_0', 'wave_1', etc."
    },
    "memory_snapshot": {
      "type": "object",
      "additionalProperties": {
        "type": "string",
        "pattern": "^sha256:[a-f0-9]{64}$"
      },
      "description": "SHA-256 hash of Claude Code memory state after each wave. Keys: 'wave_0', 'wave_1', etc."
    },
    "actual_costs": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/$defs/WaveCost"
      },
      "description": "Actual cost data recorded after each wave. Keys: 'wave_0', 'wave_1', etc."
    },
    "parallel_execution": {
      "$ref": "#/$defs/ParallelExecution",
      "description": "Parallel execution state including worktree tracking"
    },
    "hooks_log": {
      "type": "array",
      "items": {
        "$ref": "#/$defs/HookLogEntry"
      },
      "description": "Append-only log of hook executions"
    },
    "task_ids": {
      "type": "object",
      "additionalProperties": {
        "type": "string"
      },
      "description": "Map of feature_id to Claude Code native task_id"
    },
    "created_at": {
      "type": "string",
      "format": "date-time"
    },
    "updated_at": {
      "type": "string",
      "format": "date-time"
    }
  },
  "$defs": {
    "Run": {
      "type": "object",
      "required": ["run_id", "started_at", "wave", "status"],
      "properties": {
        "run_id": {
          "type": "string",
          "format": "uuid",
          "description": "Unique run identifier"
        },
        "started_at": {
          "type": "string",
          "format": "date-time"
        },
        "finished_at": {
          "type": ["string", "null"],
          "format": "date-time"
        },
        "wave": {
          "type": "string",
          "enum": ["wave_0", "wave_1", "wave_2", "wave_3", "wave_4", "all"]
        },
        "status": {
          "type": "string",
          "enum": ["running", "completed", "failed", "aborted"]
        },
        "profile": {
          "type": "string",
          "enum": ["premium", "balanced", "budget"]
        },
        "parallel_enabled": {
          "type": "boolean"
        },
        "error": {
          "type": ["string", "null"],
          "description": "Error message if status is failed"
        }
      }
    },
    "WaveCost": {
      "type": "object",
      "required": ["estimated_usd", "actual_usd", "tokens_in", "tokens_out", "model"],
      "properties": {
        "estimated_usd": {
          "type": "number",
          "minimum": 0
        },
        "actual_usd": {
          "type": "number",
          "minimum": 0
        },
        "tokens_in": {
          "type": "integer",
          "minimum": 0
        },
        "tokens_out": {
          "type": "integer",
          "minimum": 0
        },
        "model": {
          "type": "string",
          "description": "Primary model used in this wave"
        },
        "duration_seconds": {
          "type": "number",
          "minimum": 0,
          "description": "Wall-clock duration of the wave"
        }
      }
    },
    "ParallelExecution": {
      "type": "object",
      "required": ["enabled", "worktrees"],
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Whether parallel execution is active"
        },
        "worktrees": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/WorktreeEntry"
          },
          "description": "Active and completed worktree entries"
        },
        "merge_order": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Order in which worktrees are merged (by feature_id)"
        },
        "merge_conflicts": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "feature_a": { "type": "string" },
              "feature_b": { "type": "string" },
              "file": { "type": "string" },
              "resolved": { "type": "boolean" }
            }
          },
          "description": "Detected merge conflicts"
        }
      }
    },
    "WorktreeEntry": {
      "type": "object",
      "required": ["feature_id", "worktree_path", "branch", "status"],
      "properties": {
        "feature_id": {
          "type": "string",
          "pattern": "^F[0-9]{2,3}$"
        },
        "worktree_path": {
          "type": "string",
          "description": "Absolute or relative path to the worktree directory"
        },
        "branch": {
          "type": "string",
          "pattern": "^orchestre/F[0-9]{2,3}$",
          "description": "Git branch for this worktree"
        },
        "status": {
          "type": "string",
          "enum": ["created", "building", "completed", "merged", "failed", "cleaned"],
          "description": "Current worktree lifecycle status"
        },
        "created_at": {
          "type": "string",
          "format": "date-time"
        },
        "merged_at": {
          "type": ["string", "null"],
          "format": "date-time"
        }
      }
    },
    "HookLogEntry": {
      "type": "object",
      "required": ["hook_name", "file", "result", "timestamp"],
      "properties": {
        "hook_name": {
          "type": "string",
          "enum": ["pre-write-guard", "post-write-check", "pre-commit-audit"],
          "description": "Which hook was executed"
        },
        "file": {
          "type": "string",
          "description": "File path that triggered the hook"
        },
        "result": {
          "type": "string",
          "enum": ["passed", "blocked", "warning", "error"],
          "description": "Hook execution result"
        },
        "message": {
          "type": "string",
          "description": "Human-readable result message"
        },
        "timestamp": {
          "type": "string",
          "format": "date-time"
        },
        "wave": {
          "type": "string",
          "description": "Which wave triggered this hook"
        },
        "feature_id": {
          "type": "string",
          "description": "Which feature triggered this hook"
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
  "hashes": {
    "brief.md": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "intent.json": "sha256:b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3",
    "plan.json": "sha256:c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
  },
  "feature_status": {
    "F00": "done",
    "F01": "building",
    "F02": "building",
    "F03": "pending",
    "F04": "pending",
    "F05": "pending"
  },
  "waves_completed": ["WAVE_0_DONE", "WAVE_1_DONE", "WAVE_2_DONE"],
  "runs": [
    {
      "run_id": "550e8400-e29b-41d4-a716-446655440000",
      "started_at": "2026-04-01T10:00:00.000Z",
      "finished_at": null,
      "wave": "all",
      "status": "running",
      "profile": "balanced",
      "parallel_enabled": true,
      "error": null
    }
  ],
  "agent_sessions": {
    "wave_0": "session_abc123",
    "wave_1": "session_def456",
    "wave_2": "session_ghi789"
  },
  "memory_snapshot": {
    "wave_0": "sha256:1111111111111111111111111111111111111111111111111111111111111111",
    "wave_1": "sha256:2222222222222222222222222222222222222222222222222222222222222222",
    "wave_2": "sha256:3333333333333333333333333333333333333333333333333333333333333333"
  },
  "actual_costs": {
    "wave_0": {
      "estimated_usd": 0.12,
      "actual_usd": 0.09,
      "tokens_in": 15200,
      "tokens_out": 3400,
      "model": "claude-opus-4-6",
      "duration_seconds": 45.2
    },
    "wave_1": {
      "estimated_usd": 0.25,
      "actual_usd": 0.22,
      "tokens_in": 28400,
      "tokens_out": 8200,
      "model": "claude-opus-4-6",
      "duration_seconds": 62.8
    },
    "wave_2": {
      "estimated_usd": 0.35,
      "actual_usd": 0.31,
      "tokens_in": 42100,
      "tokens_out": 12500,
      "model": "claude-opus-4-6",
      "duration_seconds": 78.3
    }
  },
  "parallel_execution": {
    "enabled": true,
    "worktrees": [
      {
        "feature_id": "F01",
        "worktree_path": ".worktrees/F01",
        "branch": "orchestre/F01",
        "status": "building",
        "created_at": "2026-04-01T10:20:00.000Z",
        "merged_at": null
      },
      {
        "feature_id": "F02",
        "worktree_path": ".worktrees/F02",
        "branch": "orchestre/F02",
        "status": "building",
        "created_at": "2026-04-01T10:20:01.000Z",
        "merged_at": null
      }
    ],
    "merge_order": ["F01", "F02"],
    "merge_conflicts": []
  },
  "hooks_log": [
    {
      "hook_name": "pre-write-guard",
      "file": "lib/supabase/client.ts",
      "result": "passed",
      "message": "All checks passed",
      "timestamp": "2026-04-01T10:21:00.000Z",
      "wave": "wave_3",
      "feature_id": "F00"
    },
    {
      "hook_name": "pre-write-guard",
      "file": "components/ui/button.tsx",
      "result": "blocked",
      "message": "Hardcoded color detected: bg-blue-500. Use semantic token bg-primary instead.",
      "timestamp": "2026-04-01T10:21:30.000Z",
      "wave": "wave_3",
      "feature_id": "F02"
    }
  ],
  "task_ids": {
    "F00": "task_001",
    "F01": "task_002",
    "F02": "task_003"
  },
  "created_at": "2026-04-01T10:00:00.000Z",
  "updated_at": "2026-04-01T10:21:30.000Z"
}
```

---

## Merge Rules

`orchestre.lock` may be updated by multiple agents (especially during parallel
execution). The following merge rules prevent data loss:

| Field | Merge strategy |
|-------|---------------|
| `version` | Immutable -- never changes within a run |
| `project_id` | Immutable |
| `hashes` | Last-write-wins per key (each artefact is written by exactly one wave) |
| `feature_status` | Merge with precedence: `done` > `rework` > `error` > `building` > `queued` > `pending`. Never revert a `done` to `pending`. |
| `waves_completed` | Append-only. Never remove a completed wave marker. |
| `runs` | Append-only. New runs are added; existing runs are updated in-place (status, finished_at). |
| `agent_sessions` | Last-write-wins per key (one session per wave) |
| `memory_snapshot` | Last-write-wins per key |
| `actual_costs` | Last-write-wins per key (one cost record per wave) |
| `parallel_execution.worktrees` | Update in-place by feature_id. Status transitions are one-way: created -> building -> completed -> merged -> cleaned. |
| `hooks_log` | Append-only. Entries are never modified or deleted. |
| `task_ids` | Last-write-wins per key (set once per feature) |
| `created_at` | Immutable |
| `updated_at` | Always set to current timestamp on any write |

### Conflict Resolution

If two parallel agents attempt to write `orchestre.lock` simultaneously:

1. The orchestrator holds a file-level lock (`.orchestre/orchestre.lock.pid`).
2. The second writer waits up to 5 seconds for the lock.
3. If the lock is not released, the second writer reads the current state,
   applies merge rules, and writes atomically (write to temp file, then rename).
4. If merge is impossible (conflicting feature_status transitions), the
   orchestrator halts and requests user intervention.

---

## Initialization

When Orchestre starts a new run, it creates `orchestre.lock` with:

```json
{
  "version": "2.0.0",
  "project_id": "<from-brief>",
  "hashes": {},
  "feature_status": {},
  "waves_completed": [],
  "runs": [{"run_id": "<uuid>", "started_at": "<now>", "wave": "<target>", "status": "running", ...}],
  "agent_sessions": {},
  "memory_snapshot": {},
  "actual_costs": {},
  "parallel_execution": {"enabled": false, "worktrees": [], "merge_order": [], "merge_conflicts": []},
  "hooks_log": [],
  "task_ids": {},
  "created_at": "<now>",
  "updated_at": "<now>"
}
```

---

## Resume Protocol

When `ORCHESTRE_RESUME=true`:

1. Read `orchestre.lock` and verify integrity (all hashes match).
2. Identify the last completed wave from `waves_completed`.
3. Look up the session ID in `agent_sessions` for the next wave.
4. If session ID exists, attempt to resume the Claude Code session.
5. If session is expired or unavailable, start a new session but preserve all
   state from prior waves.
6. Restore memory keys from `memory_snapshot` hashes (verify against actual
   memory state).

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2025-11-01 | Initial StateV1 (orchestre.lock) |
| 2.0.0 | 2026-04-01 | Added agent_sessions, memory_snapshot, actual_costs, parallel_execution, hooks_log, task_ids. Defined merge rules. |
