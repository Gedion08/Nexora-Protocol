#!/bin/bash
set -e

# Deploy Nexora PrivacyHub to Starknet mainnet.
# Delegates to the unified deployment script.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec bash "$SCRIPT_DIR/contracts.sh" mainnet "$@"