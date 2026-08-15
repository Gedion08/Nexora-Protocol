#!/bin/bash
set -e

# Usage: bash scripts/deploy/contracts.sh [sepolia|mainnet]
NETWORK=${1:-sepolia}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/packages/contracts"

cd "$CONTRACTS_DIR"

if [ "$NETWORK" = "mainnet" ]; then
    RPC_URL="https://rpc.starknet.lava.build"
    ACCOUNT="mainnet_account"
else
    RPC_URL="https://rpc.starknet.sepolia.build"
    ACCOUNT="sepolia_account"
fi

echo "Deploying Nexora PrivacyHub to $NETWORK..."
echo "RPC: $RPC_URL"

# Build first
scarb build

# Deploy
starkli deploy \
    --rpc "$RPC_URL" \
    --account "$ACCOUNT" \
    target/dev/nexora_contracts_NexoraPrivacyHub.contract_class.json

echo "Deployment complete. Save the contract address for strk20.json."
