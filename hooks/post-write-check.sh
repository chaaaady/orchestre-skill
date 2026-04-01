#!/usr/bin/env bash
# =============================================================================
# post-write-check.sh — Orchestre V16 Post-Write Hook
# =============================================================================
# Runs after file writes to validate TypeScript types, React directives,
# and import conventions. Results are logged to .orchestre/hooks_log.json.
#
# Usage: bash hooks/post-write-check.sh "$FILE_PATH"
# Exit 0 = check passed (or non-applicable file)
# Exit 1 = check failed (logged but does not block — file already written)
# =============================================================================

set -uo pipefail

FILE_PATH="${1:-}"

if [[ -z "$FILE_PATH" ]]; then
  echo "ERROR: post-write-check requires FILE_PATH as first argument"
  exit 1
fi

HOOKS_LOG=".orchestre/hooks_log.json"
RESULT="passed"
MESSAGE="All checks passed"
ISSUES=()
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Ensure .orchestre directory exists
mkdir -p .orchestre

# Ensure hooks_log.json exists
if [[ ! -f "$HOOKS_LOG" ]]; then
  echo "[]" > "$HOOKS_LOG"
fi

# ---------------------------------------------------------------------------
# Helper: record an issue
# ---------------------------------------------------------------------------
add_issue() {
  ISSUES+=("$1")
}

# ---------------------------------------------------------------------------
# Determine file type and context
# ---------------------------------------------------------------------------
IS_TS=false
IS_TSX=false
IN_APP=false
IN_COMPONENTS=false

case "$FILE_PATH" in
  *.ts)  IS_TS=true ;;
  *.tsx) IS_TSX=true; IS_TS=true ;;
esac

case "$FILE_PATH" in
  */app/*|app/*) IN_APP=true ;;
esac

case "$FILE_PATH" in
  */components/*|components/*) IN_COMPONENTS=true ;;
esac

# ---------------------------------------------------------------------------
# Check 1: TypeScript type checking (for .ts and .tsx files)
# ---------------------------------------------------------------------------
if [[ "$IS_TS" == true ]]; then
  if command -v npx &> /dev/null && [[ -f "tsconfig.json" ]]; then
    TSC_OUTPUT=$(npx tsc --noEmit --pretty false "$FILE_PATH" 2>&1) || true
    TSC_EXIT=$?

    if [[ $TSC_EXIT -ne 0 ]]; then
      ERROR_COUNT=$(echo "$TSC_OUTPUT" | grep -c "error TS" || true)
      if [[ "$ERROR_COUNT" -gt 0 ]]; then
        FIRST_ERRORS=$(echo "$TSC_OUTPUT" | grep "error TS" | head -5)
        add_issue "TypeScript: $ERROR_COUNT type error(s). First errors: $FIRST_ERRORS"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Check 2: React Server/Client directives (for files in app/ or components/)
# ---------------------------------------------------------------------------
if [[ "$IS_TSX" == true && ("$IN_APP" == true || "$IN_COMPONENTS" == true) ]]; then
  if [[ -f "$FILE_PATH" ]]; then
    FILE_CONTENT=$(cat "$FILE_PATH")
    FIRST_LINE=$(head -1 "$FILE_PATH")

    HAS_USE_CLIENT=false
    HAS_USE_SERVER=false

    if echo "$FILE_CONTENT" | grep -q "^['\"]use client['\"]"; then
      HAS_USE_CLIENT=true
    fi

    if echo "$FILE_CONTENT" | grep -q "^['\"]use server['\"]"; then
      HAS_USE_SERVER=true
    fi

    # Check for client-side hooks without 'use client'
    if [[ "$HAS_USE_CLIENT" == false ]]; then
      CLIENT_HOOKS='(useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer|useLayoutEffect|useTransition|useOptimistic)\s*\('
      if echo "$FILE_CONTENT" | grep -qE "$CLIENT_HOOKS"; then
        add_issue "R8: File uses React client hooks but missing 'use client' directive at top of file"
      fi
    fi

    # Check for event handlers without 'use client'
    if [[ "$HAS_USE_CLIENT" == false ]]; then
      EVENT_HANDLERS='(onClick|onChange|onSubmit|onFocus|onBlur|onKeyDown|onKeyUp|onMouseEnter|onMouseLeave)\s*='
      if echo "$FILE_CONTENT" | grep -qE "$EVENT_HANDLERS"; then
        add_issue "R8: File uses event handlers but missing 'use client' directive"
      fi
    fi

    # Check for both directives (invalid)
    if [[ "$HAS_USE_CLIENT" == true && "$HAS_USE_SERVER" == true ]]; then
      add_issue "R8: File has both 'use client' and 'use server' directives. Only one is allowed."
    fi
  fi
fi

# ---------------------------------------------------------------------------
# Check 3: Import path conventions (@/ alias)
# ---------------------------------------------------------------------------
if [[ "$IS_TS" == true && -f "$FILE_PATH" ]]; then
  FILE_CONTENT=$(cat "$FILE_PATH")

  # Check for deep relative imports (more than one level up)
  DEEP_RELATIVES=$(echo "$FILE_CONTENT" | grep -nE "from\s+['\"]\.\.\/\.\.\/" | head -5 || true)
  if [[ -n "$DEEP_RELATIVES" ]]; then
    add_issue "R7: Deep relative imports found. Use @/ alias instead. Lines: $DEEP_RELATIVES"
  fi

  # Check for imports from node_modules that should use package names
  BARE_NODE_MODULES=$(echo "$FILE_CONTENT" | grep -nE "from\s+['\"]\.?\.?/?node_modules/" | head -3 || true)
  if [[ -n "$BARE_NODE_MODULES" ]]; then
    add_issue "R7: Direct node_modules import detected. Use package name instead."
  fi
fi

# ---------------------------------------------------------------------------
# Determine result
# ---------------------------------------------------------------------------
if [[ ${#ISSUES[@]} -gt 0 ]]; then
  RESULT="warning"
  MESSAGE=$(printf "%s; " "${ISSUES[@]}")
  MESSAGE="${MESSAGE%; }"
fi

# ---------------------------------------------------------------------------
# Log result to hooks_log.json
# ---------------------------------------------------------------------------
# Build the log entry as a JSON string
LOG_ENTRY=$(cat <<ENTRY_EOF
{
  "hook_name": "post-write-check",
  "file": "$FILE_PATH",
  "result": "$RESULT",
  "message": $(echo "$MESSAGE" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read().strip()))" 2>/dev/null || echo "\"$MESSAGE\""),
  "timestamp": "$TIMESTAMP"
}
ENTRY_EOF
)

# Append to hooks_log.json
# Read existing array, append entry, write back
if command -v python3 &> /dev/null; then
  python3 -c "
import json, sys

log_entry = json.loads('''$LOG_ENTRY''')

try:
    with open('$HOOKS_LOG', 'r') as f:
        log = json.load(f)
except (json.JSONDecodeError, FileNotFoundError):
    log = []

if not isinstance(log, list):
    log = []

log.append(log_entry)

with open('$HOOKS_LOG', 'w') as f:
    json.dump(log, f, indent=2)
" 2>/dev/null || true
fi

# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------
if [[ "$RESULT" != "passed" ]]; then
  echo "" >&2
  echo "=== POST-WRITE CHECK: ISSUES FOUND ===" >&2
  echo "" >&2
  for issue in "${ISSUES[@]}"; do
    echo "  WARNING: $issue" >&2
  done
  echo "" >&2
  echo "These issues are logged but do not block the write. Fix them before committing." >&2
  # Exit 0 — post-write warnings don't block (file already written)
  exit 0
fi

exit 0
