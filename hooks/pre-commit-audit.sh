#!/usr/bin/env bash
# =============================================================================
# pre-commit-audit.sh — Orchestre V16 Pre-Commit Security Hook
# =============================================================================
# Scans staged files for security issues before any commit.
# Checks for exposed secrets, env variable misuse, and error leakage.
#
# Usage: bash hooks/pre-commit-audit.sh
# Exit 0 = commit allowed
# Exit 1 = commit blocked with details
# =============================================================================

set -uo pipefail

ERRORS=()
WARNINGS=()

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
add_error() {
  ERRORS+=("SECURITY [$1]: $2")
}

add_warning() {
  WARNINGS+=("WARNING [$1]: $2")
}

# ---------------------------------------------------------------------------
# Get staged files
# ---------------------------------------------------------------------------
if ! command -v git &> /dev/null; then
  echo "ERROR: git is not available" >&2
  exit 1
fi

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [[ -z "$STAGED_FILES" ]]; then
  # No staged files, nothing to check
  exit 0
fi

# ---------------------------------------------------------------------------
# Check 1: Scan for Stripe secret keys
# ---------------------------------------------------------------------------
while IFS= read -r file; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  CONTENT=$(git show ":$file" 2>/dev/null || cat "$file" 2>/dev/null || true)
  if [[ -z "$CONTENT" ]]; then
    continue
  fi

  # Stripe secret keys
  if echo "$CONTENT" | grep -qE 'sk_(live|test)_[a-zA-Z0-9]{20,}'; then
    add_error "STRIPE" "Stripe secret key found in $file"
  fi

  # Stripe publishable keys in non-env files (warning only)
  if echo "$CONTENT" | grep -qE 'pk_(live|test)_[a-zA-Z0-9]{20,}'; then
    case "$file" in
      *.env*|.env*) ;; # OK in env files
      *) add_warning "STRIPE" "Stripe publishable key hardcoded in $file (should be in .env)" ;;
    esac
  fi
done <<< "$STAGED_FILES"

# ---------------------------------------------------------------------------
# Check 2: Scan for JWT tokens
# ---------------------------------------------------------------------------
while IFS= read -r file; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  # Skip binary files and known safe patterns
  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|*.eot|*.lock|*.map)
      continue
      ;;
  esac

  CONTENT=$(git show ":$file" 2>/dev/null || cat "$file" 2>/dev/null || true)

  # JWT tokens (three base64 segments separated by dots)
  if echo "$CONTENT" | grep -qE 'eyJ[a-zA-Z0-9_-]{10,}\.eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}'; then
    # Exclude test fixtures and mock data
    case "$file" in
      *test*|*spec*|*mock*|*fixture*|*__tests__*)
        add_warning "JWT" "JWT token found in test file $file — verify it is a mock token"
        ;;
      *)
        add_error "JWT" "JWT token found in $file"
        ;;
    esac
  fi
done <<< "$STAGED_FILES"

# ---------------------------------------------------------------------------
# Check 3: Scan for GitHub PATs and other tokens
# ---------------------------------------------------------------------------
while IFS= read -r file; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|*.eot|*.lock|*.map)
      continue
      ;;
  esac

  CONTENT=$(git show ":$file" 2>/dev/null || cat "$file" 2>/dev/null || true)

  # GitHub PATs
  if echo "$CONTENT" | grep -qE '(ghp_[a-zA-Z0-9]{36}|github_pat_[a-zA-Z0-9_]{20,})'; then
    add_error "GITHUB" "GitHub personal access token found in $file"
  fi

  # AWS keys
  if echo "$CONTENT" | grep -qE 'AKIA[A-Z0-9]{16}'; then
    add_error "AWS" "AWS access key ID found in $file"
  fi

  # Generic secret assignments
  if echo "$CONTENT" | grep -qiE "(api_key|apikey|api_secret|auth_token|access_token|private_key)\s*[:=]\s*['\"][a-zA-Z0-9_-]{20,}['\"]"; then
    case "$file" in
      *.env.example|*.env.template|*README*|*docs/*)
        ;; # Likely placeholder values
      *)
        add_error "SECRET" "Possible hardcoded secret in $file"
        ;;
    esac
  fi
done <<< "$STAGED_FILES"

# ---------------------------------------------------------------------------
# Check 4: NEXT_PUBLIC_ prefix on secret variables
# ---------------------------------------------------------------------------
while IFS= read -r file; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  CONTENT=$(git show ":$file" 2>/dev/null || cat "$file" 2>/dev/null || true)

  if echo "$CONTENT" | grep -qiE 'NEXT_PUBLIC_(SECRET|PRIVATE|SERVICE_ROLE|API_SECRET|STRIPE_SECRET|DB_PASSWORD|DATABASE_URL|SUPABASE_SERVICE)'; then
    add_error "ENV" "NEXT_PUBLIC_ prefix on secret variable in $file. This exposes the value to the client browser."
  fi
done <<< "$STAGED_FILES"

# ---------------------------------------------------------------------------
# Check 5: Verify .env files are in .gitignore
# ---------------------------------------------------------------------------
ENV_FILES_STAGED=""
while IFS= read -r file; do
  case "$file" in
    .env|.env.local|.env.production|.env.development|.env.staging)
      ENV_FILES_STAGED="$ENV_FILES_STAGED $file"
      ;;
  esac
done <<< "$STAGED_FILES"

if [[ -n "$ENV_FILES_STAGED" ]]; then
  add_error "ENV" "Environment file(s) staged for commit:${ENV_FILES_STAGED}. Add them to .gitignore."
fi

# Also verify .gitignore includes .env patterns
if [[ -f ".gitignore" ]]; then
  if ! grep -qE '^\s*\.env\s*$' .gitignore; then
    add_warning "ENV" ".gitignore does not include .env pattern. Add '.env' to .gitignore."
  fi
  if ! grep -qE '^\s*\.env\.local\s*$' .gitignore; then
    add_warning "ENV" ".gitignore does not include .env.local pattern."
  fi
else
  if echo "$STAGED_FILES" | grep -q ".env"; then
    add_error "ENV" "No .gitignore file found but .env files are staged."
  fi
fi

# ---------------------------------------------------------------------------
# Check 6: Check for exposed error details in global-error.tsx
# ---------------------------------------------------------------------------
while IFS= read -r file; do
  case "$file" in
    *global-error.tsx|*global-error.ts)
      CONTENT=$(git show ":$file" 2>/dev/null || cat "$file" 2>/dev/null || true)

      # Check for error.message or error.stack being rendered
      if echo "$CONTENT" | grep -qE '(error\.(message|stack|cause)|err\.(message|stack))\s*}'; then
        add_error "ERROR_LEAK" "Error details exposed in $file. Do not render error.message or error.stack to users in production. Use a generic error message."
      fi

      # Check for JSON.stringify of error objects
      if echo "$CONTENT" | grep -qE 'JSON\.stringify\s*\(\s*(error|err)\s*\)'; then
        add_error "ERROR_LEAK" "Error object serialized in $file. Do not expose full error objects to users."
      fi

      # Check for console.error with stack traces in client code
      if echo "$CONTENT" | grep -qE "console\.(log|error)\s*\(\s*(error|err)\s*(\.stack)?\s*\)"; then
        add_warning "ERROR_LEAK" "Full error logged in client-side $file. Ensure this does not leak to browser console in production."
      fi
      ;;
  esac
done <<< "$STAGED_FILES"

# ---------------------------------------------------------------------------
# Check 7: Scan for common sensitive data patterns in all staged files
# ---------------------------------------------------------------------------
while IFS= read -r file; do
  if [[ ! -f "$file" ]]; then
    continue
  fi

  case "$file" in
    *.png|*.jpg|*.jpeg|*.gif|*.ico|*.woff|*.woff2|*.ttf|*.eot|*.lock|*.map|*.svg)
      continue
      ;;
  esac

  CONTENT=$(git show ":$file" 2>/dev/null || cat "$file" 2>/dev/null || true)

  # SSH private keys
  if echo "$CONTENT" | grep -qE '-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----'; then
    add_error "SSH" "Private key found in $file"
  fi

  # Database connection strings with credentials
  if echo "$CONTENT" | grep -qE '(postgres|mysql|mongodb)://[^:]+:[^@]+@'; then
    case "$file" in
      *.env.example|*.env.template|*README*|*docs/*)
        ;; # Likely placeholder
      *)
        add_error "DB" "Database connection string with credentials found in $file"
        ;;
    esac
  fi
done <<< "$STAGED_FILES"

# ---------------------------------------------------------------------------
# Output results
# ---------------------------------------------------------------------------
if [[ ${#WARNINGS[@]} -gt 0 ]]; then
  echo "" >&2
  echo "=== PRE-COMMIT AUDIT: WARNINGS ===" >&2
  for warn in "${WARNINGS[@]}"; do
    echo "  $warn" >&2
  done
fi

if [[ ${#ERRORS[@]} -gt 0 ]]; then
  echo "" >&2
  echo "========================================" >&2
  echo "  PRE-COMMIT AUDIT: COMMIT BLOCKED" >&2
  echo "========================================" >&2
  echo "" >&2
  echo "The following security issues were found in staged files:" >&2
  echo "" >&2
  for err in "${ERRORS[@]}"; do
    echo "  $err" >&2
  done
  echo "" >&2
  echo "Actions:" >&2
  echo "  1. Remove secrets and use environment variables instead" >&2
  echo "  2. Add sensitive files to .gitignore" >&2
  echo "  3. Use .env.example with placeholder values for documentation" >&2
  echo "" >&2
  echo "After fixing, run: git add <files> && git commit" >&2
  exit 1
fi

# All checks passed
exit 0
