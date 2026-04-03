#!/usr/bin/env bash
set -euo pipefail

# Orchestre Quality Layer — Installer
# Usage: bash install.sh [--claude|--cursor|--both] [target-directory]

MODE=""
TARGET=""

# Parse args
for arg in "$@"; do
    case "$arg" in
        --claude) MODE="claude" ;;
        --cursor) MODE="cursor" ;;
        --both)   MODE="both" ;;
        *)        TARGET="$arg" ;;
    esac
done

TARGET="${TARGET:-.}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Auto-detect if no mode specified
if [ -z "$MODE" ]; then
    has_claude=false
    has_cursor=false
    [ -d "$TARGET/.claude" ] || command -v claude &>/dev/null && has_claude=true
    [ -d "$TARGET/.cursor" ] || [ -d "$HOME/.cursor" ] && has_cursor=true

    if $has_claude && $has_cursor; then
        MODE="both"
    elif $has_cursor; then
        MODE="cursor"
    else
        MODE="claude"
    fi
    echo "   Auto-detected: --$MODE"
fi

echo ""
echo "   Orchestre — Installing Quality Layer"
echo "   Target: $(cd "$TARGET" && pwd)"
echo "   Mode:   $MODE"
echo ""

# ─── SHARED (both modes) ───────────────────────────────────────

install_shared() {
    # Fixed assets (library templates)
    mkdir -p "$TARGET/fixed-assets/library-templates"
    cp "$SCRIPT_DIR/fixed-assets/library-templates/"*.md "$TARGET/fixed-assets/library-templates/"
    echo "   + fixed-assets/ (18 library templates)"

    # Knowledge base
    mkdir -p "$TARGET/knowledge-base"/{supabase,stripe,components,design-system,env-templates}
    cp "$SCRIPT_DIR/knowledge-base/design-quality.md" "$TARGET/knowledge-base/" 2>/dev/null || true
    cp "$SCRIPT_DIR/knowledge-base/supabase/"* "$TARGET/knowledge-base/supabase/" 2>/dev/null || true
    cp "$SCRIPT_DIR/knowledge-base/stripe/"* "$TARGET/knowledge-base/stripe/" 2>/dev/null || true
    cp "$SCRIPT_DIR/knowledge-base/components/"* "$TARGET/knowledge-base/components/" 2>/dev/null || true
    cp "$SCRIPT_DIR/knowledge-base/design-system/"* "$TARGET/knowledge-base/design-system/" 2>/dev/null || true
    cp "$SCRIPT_DIR/knowledge-base/env-templates/"* "$TARGET/knowledge-base/env-templates/" 2>/dev/null || true
    cp "$SCRIPT_DIR/knowledge-base/smoke-test.sh" "$TARGET/knowledge-base/" 2>/dev/null || true
    echo "   + knowledge-base/ (SQL, design, components)"

    # .gitignore
    if [ -f "$TARGET/.gitignore" ]; then
        if ! grep -q ".orchestre/" "$TARGET/.gitignore" 2>/dev/null; then
            printf '\n# Orchestre\n.orchestre/\n' >> "$TARGET/.gitignore"
        fi
    fi
}

# ─── CLAUDE CODE ───────────────────────────────────────────────

install_claude() {
    echo "   ── Claude Code (full power) ──"

    # CLAUDE.md
    if [ -f "$TARGET/CLAUDE.md" ]; then
        echo "   ! CLAUDE.md exists — appending Orchestre rules"
        printf '\n---\n\n' >> "$TARGET/CLAUDE.md"
        cat "$SCRIPT_DIR/CLAUDE.md" >> "$TARGET/CLAUDE.md"
    else
        cp "$SCRIPT_DIR/CLAUDE.md" "$TARGET/CLAUDE.md"
    fi
    echo "   + CLAUDE.md (531 lines — rules + guards)"

    # .claude/ (agents, rules, skills)
    mkdir -p "$TARGET/.claude"
    cp -r "$SCRIPT_DIR/.claude/agents" "$TARGET/.claude/" 2>/dev/null || true
    cp -r "$SCRIPT_DIR/.claude/rules" "$TARGET/.claude/" 2>/dev/null || true
    cp -r "$SCRIPT_DIR/.claude/skills" "$TARGET/.claude/" 2>/dev/null || true
    echo "   + .claude/agents/ (7 wave agents)"
    echo "   + .claude/skills/ (/orchestre-go, /orchestre-audit, /orchestre-status)"
    echo "   + .claude/rules/ (typescript, security)"

    # Settings (hooks)
    if [ -f "$TARGET/.claude/settings.json" ]; then
        cp "$TARGET/.claude/settings.json" "$TARGET/.claude/settings.json.bak"
        echo "   ! settings.json backed up"
    fi
    cp "$SCRIPT_DIR/.claude/settings.json" "$TARGET/.claude/settings.json"
    echo "   + .claude/settings.json (hooks config)"

    # Hooks
    mkdir -p "$TARGET/hooks"
    cp "$SCRIPT_DIR/hooks/"*.sh "$TARGET/hooks/" 2>/dev/null || true
    cp "$SCRIPT_DIR/hooks/"*.mjs "$TARGET/hooks/" 2>/dev/null || true
    cp -r "$SCRIPT_DIR/hooks/lib" "$TARGET/hooks/" 2>/dev/null || true
    chmod +x "$TARGET/hooks/"*.sh 2>/dev/null || true
    echo "   + hooks/ (AST pre-write guard, post-write check, pre-commit audit)"

    # Contracts, profiles, infrastructure
    mkdir -p "$TARGET/contracts" "$TARGET/profiles" "$TARGET/infrastructure"
    cp "$SCRIPT_DIR/contracts/"*.md "$TARGET/contracts/" 2>/dev/null || true
    cp -r "$SCRIPT_DIR/contracts/schemas" "$TARGET/contracts/" 2>/dev/null || true
    cp "$SCRIPT_DIR/profiles/"*.md "$TARGET/profiles/"
    cp "$SCRIPT_DIR/infrastructure/"*.md "$TARGET/infrastructure/" 2>/dev/null || true
    echo "   + contracts/ (7 JSON schemas)"
    echo "   + profiles/ (premium, balanced, budget)"
    echo "   + infrastructure/ (turn-loop, cost, registry, permissions, sessions)"
}

# ─── CURSOR ────────────────────────────────────────────────────

install_cursor() {
    echo "   ── Cursor (rules + guards) ──"

    # .cursorrules
    if [ -f "$TARGET/.cursorrules" ]; then
        echo "   ! .cursorrules exists — appending Orchestre rules"
        printf '\n---\n\n' >> "$TARGET/.cursorrules"
        cat "$SCRIPT_DIR/.cursorrules" >> "$TARGET/.cursorrules"
    else
        cp "$SCRIPT_DIR/.cursorrules" "$TARGET/.cursorrules"
    fi
    echo "   + .cursorrules (427 lines — rules + guards)"

    # .cursor/rules/
    mkdir -p "$TARGET/.cursor/rules"
    cp "$SCRIPT_DIR/.cursor/rules/"*.md "$TARGET/.cursor/rules/"
    echo "   + .cursor/rules/ (typescript, security)"
}

# ─── EXECUTE ───────────────────────────────────────────────────

install_shared

case "$MODE" in
    claude)
        install_claude
        ;;
    cursor)
        install_cursor
        ;;
    both)
        install_claude
        install_cursor
        ;;
esac

echo ""
echo "   Done."
echo ""

if [ "$MODE" = "claude" ] || [ "$MODE" = "both" ]; then
    echo "   Claude Code (full power):"
    echo "     Rules R1-R8 + 7 guards + hooks + agents + skills"
    echo "     /orchestre-go  — generate a full project"
    echo "     /orchestre-audit — audit code (/100)"
    echo ""
fi

if [ "$MODE" = "cursor" ] || [ "$MODE" = "both" ]; then
    echo "   Cursor (rules + guards):"
    echo "     Rules R1-R8 + 7 guards (no hooks/agents/pipeline)"
    echo "     Library templates in fixed-assets/"
    echo ""
fi
