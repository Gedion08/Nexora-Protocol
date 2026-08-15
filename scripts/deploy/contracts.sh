#!/bin/bash
set -e

# Usage: bash scripts/deploy/contracts.sh [sepolia|mainnet]
NETWORK=${1:-sepolia}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/packages/contracts"

cd "$CONTRACTS_DIR"

if [ "$NETWORK" = "mainnet" ]; then
    RPC_URL="https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44"
    ACCOUNT="mainnet_account"
else
    RPC_URL="https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44"
    ACCOUNT="sepolia_account"
fi

echo "Deploying Nexora PrivacyHub to $NETWORK..."
echo "RPC: $RPC_URL"

# Build first
echo "Building contract..."
scarb build

CONTRACT_CLASS="target/dev/nexora_contracts_nexora_privacy_hub.contract_class.json"

if [ ! -f "$CONTRACT_CLASS" ]; then
    echo "Error: Contract class file not found at $CONTRACT_CLASS"
    exit 1
fi

# Try starkli first, fallback to sncast
if command -v starkli &> /dev/null; then
    echo "Deploying with starkli..."
    starkli deploy \
        --rpc "$RPC_URL" \
        --account "$ACCOUNT" \
        "$CONTRACT_CLASS"
elif command -v sncast &> /dev/null; then
    echo "Deploying with sncast..."
    sncast deploy \
        --account "$ACCOUNT" \
        --url "$RPC_URL" \
        --class-name nexora_privacy_hub \
        --scarb-profile release \
        "$CONTRACT_CLASS"
else
    echo "Error: Neither starkli nor sncast found. Please install one of them."
    exit 1
fi

echo "Deployment complete. Save the contract address for strk20.json."
