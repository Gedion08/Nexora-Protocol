#!/bin/bash
set -e

# End-to-end test: shield → private transfer → unshield on Sepolia
# Usage: bash scripts/test/e2e-sepolia.sh

echo "=== Nexora E2E Test: Shield → Private Transfer → Unshield ==="
echo ""

# Load environment
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

source "$PROJECT_ROOT/.env" 2>/dev/null || true

# Configuration
RPC_URL=${NEXT_PUBLIC_SEPOLIA_RPC_URL:-"https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44"}
POOL_ADDRESS=${NEXT_PUBLIC_SEPOLIA_POOL_ADDRESS:-"0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a"}
PRIVACY_HUB_ADDRESS=${NEXT_PUBLIC_PRIVACY_HUB_ADDRESS:-""}
PROVER_URL=${NEXT_PUBLIC_PROVER_URL:-"http://localhost:8080"}
INDEXER_URL=${NEXT_PUBLIC_INDEXER_URL:-"http://localhost:8081"}

if [ -z "$PRIVACY_HUB_ADDRESS" ]; then
    echo "Error: NEXT_PUBLIC_PRIVACY_HUB_ADDRESS is not set in .env"
    echo "Please deploy PrivacyHub first or set the address manually."
    exit 1
fi

echo "Configuration:"
echo "  RPC URL: $RPC_URL"
echo "  Pool Address: $POOL_ADDRESS"
echo "  PrivacyHub Address: $PRIVACY_HUB_ADDRESS"
echo "  Prover URL: $PROVER_URL"
echo "  Indexer URL: $INDEXER_URL"
echo ""

# Check if required services are running
if [ -n "$PROVER_URL" ]; then
    echo "Checking prover service..."
    if curl -s -o /dev/null -w "%{http_code}" "$PROVER_URL/health" | grep -q "200"; then
        echo "  Prover service: OK"
    else
        echo "  Warning: Prover service not reachable at $PROVER_URL"
    fi
fi

if [ -n "$INDEXER_URL" ]; then
    echo "Checking indexer service..."
    if curl -s -o /dev/null -w "%{http_code}" "$INDEXER_URL/health" | grep -q "200"; then
        echo "  Indexer service: OK"
    else
        echo "  Warning: Indexer service not reachable at $INDEXER_URL"
    fi
fi

echo ""
echo "=== Running E2E Tests ==="
echo ""

cd "$PROJECT_ROOT/packages/sdk"

# Run the SDK e2e tests
npx vitest run tests/e2e.test.ts 2>&1 || {
    echo ""
    echo "E2E tests failed or not found. Make sure you have:"
    echo "1. PrivacyHub deployed to Sepolia"
    echo "2. Prover service running at $PROVER_URL"
    echo "3. Indexer service running at $INDEXER_URL"
    echo "4. A funded account configured in starkli/sncast"
    exit 1
}

echo ""
echo "=== E2E Test Complete ==="
