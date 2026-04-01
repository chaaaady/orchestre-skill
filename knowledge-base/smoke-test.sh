#!/bin/bash
# smoke-test.sh — Tests de fumée post-déploiement
# Généré par Orchestre V15.6 — à exécuter après `vercel deploy`
# Usage: ./smoke-test.sh https://your-app.vercel.app

set -e
BASE_URL="${1:-http://localhost:3000}"
PASS=0
FAIL=0
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

check() {
  local name="$1"
  local url="$2"
  local expected_code="${3:-200}"
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)
  if [[ "$code" == "$expected_code" ]]; then
    echo -e "  ${GREEN}✓${NC} $name ($code)"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $name — attendu $expected_code, reçu $code"
    ((FAIL++))
  fi
}

echo ""
echo "════════════════════════════════════════"
echo "  SMOKE TESTS — $BASE_URL"
echo "════════════════════════════════════════"

# Routes publiques
check "Page d'accueil" "$BASE_URL/"
check "Page login" "$BASE_URL/login" 200
check "Route inconnue → 404" "$BASE_URL/route-qui-nexiste-pas" 404

# API health (si existe)
check "API health" "$BASE_URL/api/health" 200

# Vérification ENV vars côté build
echo ""
echo "ENV vars requises :"
REQUIRED_VARS=("NEXT_PUBLIC_SUPABASE_URL" "NEXT_PUBLIC_SUPABASE_ANON_KEY" "RESEND_API_KEY")
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -n "${!var}" ]]; then
    echo -e "  ${GREEN}✓${NC} $var"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $var — non définie"
    ((FAIL++))
  fi
done

echo ""
echo "════════════════════════════════════════"
echo "  Résultat : ${PASS} OK / ${FAIL} FAIL"
echo "════════════════════════════════════════"

if [[ $FAIL -gt 0 ]]; then
  echo -e "  ${RED}SMOKE TESTS FAILED${NC}"
  exit 1
else
  echo -e "  ${GREEN}ALL SMOKE TESTS PASSED${NC}"
  exit 0
fi
