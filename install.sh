#!/usr/bin/env bash
set -euo pipefail

# Orchestre Quality Layer — Installer
# Usage: bash install.sh [target-directory]

TARGET="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🎵 Orchestre — Installing Quality Layer"
echo "   Target: $(cd "$TARGET" && pwd)"
echo ""

# 1. Copy CLAUDE.md
if [ -f "$TARGET/CLAUDE.md" ]; then
    echo "   ⚠️  CLAUDE.md exists — merging Orchestre rules at the end"
    echo "" >> "$TARGET/CLAUDE.md"
    echo "---" >> "$TARGET/CLAUDE.md"
    echo "" >> "$TARGET/CLAUDE.md"
    cat "$SCRIPT_DIR/CLAUDE.md" >> "$TARGET/CLAUDE.md"
else
    cp "$SCRIPT_DIR/CLAUDE.md" "$TARGET/CLAUDE.md"
fi
echo "   ✓ CLAUDE.md"

# 2. Copy .claude/ (agents, rules, skills, settings)
mkdir -p "$TARGET/.claude"
cp -r "$SCRIPT_DIR/.claude/agents" "$TARGET/.claude/" 2>/dev/null || true
cp -r "$SCRIPT_DIR/.claude/rules" "$TARGET/.claude/" 2>/dev/null || true
cp -r "$SCRIPT_DIR/.claude/skills" "$TARGET/.claude/" 2>/dev/null || true

# Merge settings.json if exists
if [ -f "$TARGET/.claude/settings.json" ]; then
    echo "   ⚠️  .claude/settings.json exists — backup created (.claude/settings.json.bak)"
    cp "$TARGET/.claude/settings.json" "$TARGET/.claude/settings.json.bak"
fi
cp "$SCRIPT_DIR/.claude/settings.json" "$TARGET/.claude/settings.json"
echo "   ✓ .claude/ (agents, rules, skills, settings)"

# 3. Copy hooks
mkdir -p "$TARGET/hooks"
cp "$SCRIPT_DIR/hooks/"*.sh "$TARGET/hooks/"
chmod +x "$TARGET/hooks/"*.sh
echo "   ✓ hooks/ (pre-write, post-write, pre-commit)"

# 4. Copy fixed-assets
mkdir -p "$TARGET/fixed-assets/library-templates"
cp "$SCRIPT_DIR/fixed-assets/library-templates/"*.md "$TARGET/fixed-assets/library-templates/"
echo "   ✓ fixed-assets/ (18 library templates)"

# 5. Copy knowledge-base
mkdir -p "$TARGET/knowledge-base"/{supabase,stripe,components,design-system,env-templates}
cp "$SCRIPT_DIR/knowledge-base/design-quality.md" "$TARGET/knowledge-base/" 2>/dev/null || true
cp "$SCRIPT_DIR/knowledge-base/supabase/"* "$TARGET/knowledge-base/supabase/" 2>/dev/null || true
cp "$SCRIPT_DIR/knowledge-base/stripe/"* "$TARGET/knowledge-base/stripe/" 2>/dev/null || true
cp "$SCRIPT_DIR/knowledge-base/components/"* "$TARGET/knowledge-base/components/" 2>/dev/null || true
cp "$SCRIPT_DIR/knowledge-base/design-system/"* "$TARGET/knowledge-base/design-system/" 2>/dev/null || true
cp "$SCRIPT_DIR/knowledge-base/env-templates/"* "$TARGET/knowledge-base/env-templates/" 2>/dev/null || true
cp "$SCRIPT_DIR/knowledge-base/smoke-test.sh" "$TARGET/knowledge-base/" 2>/dev/null || true
echo "   ✓ knowledge-base/ (SQL, design, components, env templates)"

# 6. Copy contracts and profiles
mkdir -p "$TARGET/contracts" "$TARGET/profiles"
cp "$SCRIPT_DIR/contracts/"*.md "$TARGET/contracts/"
cp "$SCRIPT_DIR/profiles/"*.md "$TARGET/profiles/"
echo "   ✓ contracts/ + profiles/"

# 7. Add to .gitignore
if [ -f "$TARGET/.gitignore" ]; then
    if ! grep -q ".orchestre/" "$TARGET/.gitignore" 2>/dev/null; then
        echo "" >> "$TARGET/.gitignore"
        echo "# Orchestre" >> "$TARGET/.gitignore"
        echo ".orchestre/" >> "$TARGET/.gitignore"
    fi
fi

echo ""
echo "✅ Orchestre Quality Layer installed!"
echo ""
echo "   What's active NOW (every Claude Code session):"
echo "   • CLAUDE.md — architecture rules R1-R8, coding standards, security"
echo "   • .claude/rules/ — path-specific linting (typescript, security)"
echo "   • hooks/ — pre-write guard, post-write typecheck, pre-commit audit"
echo ""
echo "   What's available ON DEMAND:"
echo "   • /orchestre-go \"description\" — generate a full project"
echo "   • /orchestre-audit — audit code quality (/100)"
echo "   • /orchestre-status — show orchestration progress"
echo "   • 7 wave agents in .claude/agents/"
echo "   • 18 library templates in fixed-assets/"
echo ""
echo "   Start coding. Orchestre is watching. 🎵"
