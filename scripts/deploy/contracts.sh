#!/bin/bash
set -e

# Usage: bash scripts/deploy/contracts.sh [mainnet|sepolia]
# Deploys Nexora PrivacyHub with starkli (declare + deploy).
#
# Prerequisites:
#   - starkli installed and account funded
#   - STARKNET_ACCOUNT / STARKNET_KEYSTORE env vars set (or --account/--keystore below)
#   - STARKNET_RPC for the target network
#
# Optional env vars:
#   STARKNET_ACCOUNT          Path to account config JSON (required)
#   STARKNET_KEYSTORE         Path to keystore JSON (required)
#   STARKNET_KEYSTORE_PASSWORD Password for the keystore (or interactive prompt)
#   NEXORA_ADMIN              Admin address for the contract (defaults to deployer)
#   NEXORA_POOL               STRK20 pool address the hub forwards to
#   SKIP_DECLARE=1            Reuse an already-declared class hash

NETWORK=${1:-sepolia}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONTRACTS_DIR="$PROJECT_ROOT/packages/contracts"

cd "$CONTRACTS_DIR"

case "$NETWORK" in
    mainnet)
        RPC_URL="${STARKNET_RPC:-https://starknet-mainnet.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44}"
        ;;
    sepolia)
        RPC_URL="${STARKNET_RPC:-https://starknet-sepolia.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44}"
        ;;
    *)
        echo "Error: network must be 'mainnet' or 'sepolia'"
        exit 1
        ;;
esac

CONTRACT_CLASS="target/dev/nexora_contracts_nexora_privacy_hub.contract_class.json"
SIERRA_FILE="target/dev/nexora_contracts_nexora_privacy_hub.compiled_contract_class.json"

echo "=== Nexora PrivacyHub Deployment ($NETWORK) ==="
echo "RPC: $RPC_URL"
echo ""

if ! command -v starkli &> /dev/null; then
    echo "Error: starkli not found. Install it from https://github.com/xJonathanLEI/starkli"
    exit 1
fi

if [ -z "${STARKNET_ACCOUNT:-}" ] || [ -z "${STARKNET_KEYSTORE:-}" ]; then
    echo "Error: STARKNET_ACCOUNT and STARKNET_KEYSTORE must be set."
    echo "Example:"
    echo "  export STARKNET_ACCOUNT=\$HOME/.starkli/accounts/$NETWORK.json"
    echo "  export STARKNET_KEYSTORE=\$HOME/.starkli/keystores/$NETWORK.json"
    echo "  export STARKNET_KEYSTORE_PASSWORD=..."
    exit 1
fi

# Resolve deployer address for the default admin argument
DEPLOYER_ADDRESS=$(starkli account info --rpc "$RPC_URL" --account "$STARKNET_ACCOUNT" | grep -A1 "Address:" | grep "0x" | awk '{print $1}' || true)
if [ -z "$DEPLOYER_ADDRESS" ]; then
    echo "Warning: could not resolve deployer address; falling back to zero admin check later"
    DEPLOYER_ADDRESS="0x0"
fi
ADMIN="${NEXORA_ADMIN:-$DEPLOYER_ADDRESS}"
POOL="${NEXORA_POOL:-0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a}"

echo "[1/4] Building contract..."
scarb build

CLASS_HASH=""
if [ "${SKIP_DECLARE:-0}" = "1" ] && [ -f ".nexora-classhash-$NETWORK" ]; then
    CLASS_HASH=$(cat ".nexora-classhash-$NETWORK")
    echo "Reusing declared class hash: $CLASS_HASH"
else
    echo "[2/4] Declaring contract class..."
    DECLARE_OUTPUT=$(starkli declare \
        --rpc "$RPC_URL" \
        --account "$STARKNET_ACCOUNT" \
        --keystore "$STARKNET_KEYSTORE" \
        "$SIERRA_FILE" 2>&1)
    echo "$DECLARE_OUTPUT"
    CLASS_HASH=$(echo "$DECLARE_OUTPUT" | grep -oE '0x[0-9a-fA-F]{62,64}' | head -1 || true)
    if [ -z "$CLASS_HASH" ]; then
        echo "Error: could not extract class hash from declare output"
        exit 1
    fi
    echo "$CLASS_HASH" > ".nexora-classhash-$NETWORK"
fi

echo ""
echo "[3/4] Deploying contract..."
echo "Admin: $ADMIN"
echo "Pool:  $POOL"
echo "Class hash: $CLASS_HASH"

DEPLOY_OUTPUT=$(starkli deploy \
    --rpc "$RPC_URL" \
    --account "$STARKNET_ACCOUNT" \
    --keystore "$STARKNET_KEYSTORE" \
    "$CLASS_HASH" \
    "$ADMIN" \
    "$POOL" 2>&1)
echo "$DEPLOY_OUTPUT"

CONTRACT_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[0-9a-fA-F]{62,64}' | head -1 || true)
if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "Error: could not extract contract address from deploy output"
    exit 1
fi

echo "$CONTRACT_ADDRESS" > ".nexora-contract-$NETWORK"

echo ""
echo "[4/4] Deployment complete!"
echo "Contract address: $CONTRACT_ADDRESS"
echo ""
echo "Next steps:"
echo "1. Set admin/pool if not using defaults:"
echo "   NEXORA_ADMIN=<admin> NEXORA_POOL=<pool> bash scripts/deploy/contracts.sh $NETWORK"
echo "2. Update .env: NEXT_PUBLIC_PRIVACY_HUB_ADDRESS=$CONTRACT_ADDRESS"
echo "3. Verify on Voyager:"
echo "   https://voyager.online/contract/$CONTRACT_ADDRESS"
echo "4. Update strk20.json and registry.json with this address"
