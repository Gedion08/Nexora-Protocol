#!/bin/bash
set -e

# Demo deployment script for Nexora Protocol frontend
# Usage: bash scripts/deploy/demo.sh [preview|production]

MODE=${1:-preview}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
WEB_DIR="$PROJECT_ROOT/apps/web"

cd "$WEB_DIR"

if [ "$MODE" = "production" ]; then
    echo "Deploying production demo..."
    vercel --prod
else
    echo "Deploying preview demo..."
    vercel
fi
