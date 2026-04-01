#!/usr/bin/env bash
# =============================================================================
# pre-write-guard.sh — Orchestre V16 Pre-Write Hook
# =============================================================================
# Validates file content against design system tokens and architecture rules
# (R1-R8) before allowing any file write during Wave 3.
#
# Usage: bash hooks/pre-write-guard.sh "$FILE_PATH" "$CONTENT"
# Exit 0 = allow write
# Exit 1 = block write with error message
# =============================================================================

set -euo pipefail

FILE_PATH="${1:-}"
CONTENT="${2:-}"

if [[ -z "$FILE_PATH" ]]; then
  echo "ERROR: pre-write-guard requires FILE_PATH as first argument"
  exit 1
fi

ERRORS=()
WARNINGS=()

# ---------------------------------------------------------------------------
# Helper: add error
# ---------------------------------------------------------------------------
add_error() {
  ERRORS+=("BLOCKED [$1]: $2 in $FILE_PATH")
}

add_warning() {
  WARNINGS+=("WARNING [$1]: $2 in $FILE_PATH")
}

# ---------------------------------------------------------------------------
# Determine file type and directory context
# ---------------------------------------------------------------------------
IS_TS=false
IS_TSX=false
IS_CSS=false
IN_APP=false
IN_COMPONENTS=false
IN_LIB=false
IN_API=false

case "$FILE_PATH" in
  *.ts)  IS_TS=true ;;
  *.tsx) IS_TSX=true; IS_TS=true ;;
  *.css) IS_CSS=true ;;
esac

case "$FILE_PATH" in
  */app/api/*|app/api/*)   IN_API=true; IN_APP=true ;;
  */app/*|app/*)           IN_APP=true ;;
esac

case "$FILE_PATH" in
  */components/*|components/*) IN_COMPONENTS=true ;;
esac

case "$FILE_PATH" in
  */lib/*|lib/*) IN_LIB=true ;;
esac

# ---------------------------------------------------------------------------
# R2: Check for hardcoded Tailwind colors (semantic tokens only)
# ---------------------------------------------------------------------------
if [[ "$IS_TS" == true || "$IS_TSX" == true || "$IS_CSS" == true ]]; then
  HARDCODED_COLOR_PATTERN='(bg|text|border|ring|outline|shadow|from|via|to|fill|stroke|decoration|accent|caret|divide|placeholder)-(red|blue|green|yellow|orange|purple|pink|indigo|violet|cyan|teal|emerald|lime|amber|fuchsia|rose|sky|slate|gray|zinc|neutral|stone|warmGray|trueGray|coolGray|blueGray)-(50|100|200|300|400|500|600|700|800|900|950)'

  if echo "$CONTENT" | grep -qE "$HARDCODED_COLOR_PATTERN"; then
    MATCHES=$(echo "$CONTENT" | grep -oE "$HARDCODED_COLOR_PATTERN" | head -5)
    add_error "R2" "Hardcoded Tailwind color detected. Use semantic tokens (bg-primary, text-destructive, border-border, etc.) instead. Found: $MATCHES"
  fi
fi

# ---------------------------------------------------------------------------
# R1: Check for direct Supabase/fetch calls in app/ or components/
# ---------------------------------------------------------------------------
if [[ "$IN_APP" == true || "$IN_COMPONENTS" == true ]]; then
  # Direct Supabase client usage (should be in lib/)
  if echo "$CONTENT" | grep -qE "(createClient|createBrowserClient|createServerClient)\s*\("; then
    if [[ "$IN_LIB" != true ]]; then
      add_error "R1" "Direct Supabase client creation detected. Move database calls to lib/db/ or lib/supabase/"
    fi
  fi

  # Direct fetch to Supabase URLs
  if echo "$CONTENT" | grep -qE "fetch\s*\(\s*['\"]https?://.*supabase"; then
    add_error "R1" "Direct fetch to Supabase URL detected. Use lib/db/ functions instead"
  fi

  # Direct SQL or .from() calls
  if echo "$CONTENT" | grep -qE "\.(from|rpc|sql)\s*\("; then
    if [[ "$IN_API" != true ]]; then
      add_error "R1" "Direct database query detected in app/components. Move to lib/db/"
    fi
  fi
fi

# ---------------------------------------------------------------------------
# R3: Check for 'throw new' in lib/ (must use Result<T>)
# ---------------------------------------------------------------------------
if [[ "$IN_LIB" == true && "$IS_TS" == true ]]; then
  if echo "$CONTENT" | grep -qE "throw\s+new\s+"; then
    add_error "R3" "'throw new' detected in lib/. Use Result<T> pattern: return {ok: false, error: '...'}"
  fi
fi

# ---------------------------------------------------------------------------
# R4: Check for 'any' type usage
# ---------------------------------------------------------------------------
if [[ "$IS_TS" == true ]]; then
  # Match : any, as any, <any>, Array<any> but not "any" in strings/comments
  # Simple heuristic: look for common any patterns
  ANY_PATTERNS='(:\s*any\b|as\s+any\b|<any>|Array<any>|\bany\[\])'
  if echo "$CONTENT" | grep -qE "$ANY_PATTERNS"; then
    MATCHES=$(echo "$CONTENT" | grep -nE "$ANY_PATTERNS" | head -5)
    add_error "R4" "'any' type detected. Use proper types or 'unknown' with type guards. Lines: $MATCHES"
  fi
fi

# ---------------------------------------------------------------------------
# R5: Secret patterns (API keys, tokens, passwords)
# ---------------------------------------------------------------------------
SECRET_PATTERNS=(
  'sk_live_[a-zA-Z0-9]{20,}'
  'sk_test_[a-zA-Z0-9]{20,}'
  'pk_live_[a-zA-Z0-9]{20,}'
  'pk_test_[a-zA-Z0-9]{20,}'
  'ghp_[a-zA-Z0-9]{36,}'
  'github_pat_[a-zA-Z0-9_]{20,}'
  'xoxb-[a-zA-Z0-9-]{20,}'
  'xoxp-[a-zA-Z0-9-]{20,}'
  'AIza[a-zA-Z0-9_-]{35}'
  'ya29\.[a-zA-Z0-9_-]{50,}'
  'AKIA[A-Z0-9]{16}'
  '[a-zA-Z0-9]{40,}' # Generic long token near key/secret/token words
)

for pattern in "${SECRET_PATTERNS[@]}"; do
  if echo "$CONTENT" | grep -qE "$pattern"; then
    # For the generic pattern, also check context
    if [[ "$pattern" == '[a-zA-Z0-9]{40,}' ]]; then
      if echo "$CONTENT" | grep -qiE "(key|secret|token|password|api_key|apikey|auth_token)\s*[:=]\s*['\"]?[a-zA-Z0-9]{40,}"; then
        add_error "SECRET" "Possible secret/token detected near sensitive keyword. Use environment variables."
        break
      fi
    else
      add_error "SECRET" "Secret pattern detected matching: ${pattern:0:20}... Use environment variables."
      break
    fi
  fi
done

# ---------------------------------------------------------------------------
# R6: Check for console.log with sensitive data patterns
# ---------------------------------------------------------------------------
if [[ "$IS_TS" == true ]]; then
  SENSITIVE_LOG_PATTERN='console\.(log|debug|info|warn)\s*\(.*\b(password|secret|token|apiKey|api_key|authorization|cookie|session|jwt|bearer|credentials)\b'
  if echo "$CONTENT" | grep -qiE "$SENSITIVE_LOG_PATTERN"; then
    add_error "R6" "console.log with sensitive data pattern detected. Remove or redact sensitive information from logs."
  fi
fi

# ---------------------------------------------------------------------------
# R7: Check import paths use @/ alias (in TS/TSX files)
# ---------------------------------------------------------------------------
if [[ "$IS_TS" == true ]]; then
  # Relative imports going up more than one level suggest missing @/ alias
  if echo "$CONTENT" | grep -qE "from\s+['\"]\.\.\/\.\.\/" ; then
    add_warning "R7" "Deep relative import detected (../../). Consider using @/ path alias."
  fi
fi

# ---------------------------------------------------------------------------
# NEXT_PUBLIC_ prefix on secret vars
# ---------------------------------------------------------------------------
if echo "$CONTENT" | grep -qiE "NEXT_PUBLIC_(SECRET|KEY|TOKEN|PASSWORD|API_SECRET|STRIPE_SECRET|SUPABASE_SERVICE_ROLE)"; then
  add_error "SECRET" "NEXT_PUBLIC_ prefix on a secret variable. Client-exposed env vars must not contain secrets."
fi

# ---------------------------------------------------------------------------
# Output results
# ---------------------------------------------------------------------------
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  for warn in "${WARNINGS[@]}"; do
    echo "$warn" >&2
  done
fi

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "" >&2
  echo "=== PRE-WRITE GUARD: WRITE BLOCKED ===" >&2
  echo "" >&2
  for err in "${ERRORS[@]}"; do
    echo "  $err" >&2
  done
  echo "" >&2
  echo "Fix the issues above and retry the write." >&2
  exit 1
fi

# All checks passed
exit 0
