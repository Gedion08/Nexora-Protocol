#!/bin/bash
set -e

# Deploy Nexora PrivacyHub to Sepolia testnet
# Prerequisites: Account configured in starkli or sncast

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/packages/contracts"

cd "$CONTRACTS_DIR"

RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44"
ACCOUNT="sepolia_account"

echo "=== Nexora PrivacyHub Deployment (Sepolia) ==="
echo "RPC: $RPC_URL"
echo ""

# Build
echo "[1/3] Building contract..."
scarb build

CLASS_HASH="0x0211e36eb1ec34b3cfb3587bb3c9bb2c722f1e73c384fa1ba01485d6164ffd1e"
echo "Class hash: $CLASS_HASH"

# Deploy
echo ""
echo "[2/3] Deploying contract..."

if command -v sncast &> /dev/null; then
    echo "Using sncast..."
    sncast deploy \
        --class-hash "$CLASS_HASH" \
        --arguments "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a" "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a" \
        --account "$ACCOUNT" \
        --url "$RPC_URL" \
        --wait \
        --json
elif command -v starkli &> /dev/null; then
    echo "Using starkli..."
    starkli deploy \
        --rpc "$RPC_URL" \
        --account "$ACCOUNT" \
        target/dev/nexora_contracts_nexora_privacy_hub.contract_class.json \
        --arguments "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a" "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a"
else
    echo "Error: Neither sncast nor starkli found"
    exit 1
fi

echo ""
echo "[3/3] Deployment complete!"
echo ""
echo "Verify on Starkscan: https://sepolia.starkscan.co/contract/<address>"
