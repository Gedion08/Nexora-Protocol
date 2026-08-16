#!/bin/bash
set -e

# STRK20 hackathon registration helper
# Updates registry.json with project metadata

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
REGISTRY_FILE="$PROJECT_ROOT/registry.json"

echo "=== STRK20 Registration ==="
echo ""
echo "This script helps prepare your hackathon registration."
echo "Make sure registry.json is up to date before submitting."
echo ""

if [ -f "$REGISTRY_FILE" ]; then
    echo "Current registry.json:"
    cat "$REGISTRY_FILE"
    echo ""
fi

echo "Required fields for submission:"
echo "  - repo_url: GitHub repository URL"
echo "  - name: Project name"
echo "  - one_liner: Short description"
echo "  - slug: URL slug (lowercase, hyphens)"
echo "  - category: Project category"
echo "  - inspired_by: RFP or inspiration reference"
echo ""
echo "Next steps:"
echo "  1. Verify registry.json contents"
echo "  2. Update strk20.json with transaction hashes"
echo "  3. Update README.md with demo URL"
echo "  4. Submit repository URL to STRK20 hackathon"
