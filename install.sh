#!/usr/bin/env bash
set -euo pipefail

# Orchestre — Quick Installer
# Usage: bash install.sh [target-directory] [--stack <name>]
#
# Delegates to the Node.js installer (bin/install.mjs).
# This script exists for convenience — one line to install.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check Node.js is available
if ! command -v node &>/dev/null; then
    echo "Error: Node.js is required. Install it from https://nodejs.org"
    exit 1
fi

# Pass all arguments to the Node.js installer
node "$SCRIPT_DIR/bin/install.mjs" "$@"
