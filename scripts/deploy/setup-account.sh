#!/bin/bash
set -e

# Setup script for starkli/sncast account configuration
# This script helps you configure your deployment account

echo "=== Nexora Account Setup ==="
echo ""
echo "This script will help you configure your Starknet account for deployment."
echo "You will need your private key or keystore file ready."
echo ""

read -p "Enter your private key (hex, with or without 0x): " PRIVATE_KEY
read -p "Enter a name for this account (e.g. mainnet_account): " ACCOUNT_NAME
read -p "Enter network (mainnet or sepolia): " NETWORK

# Determine which tool to use
if command -v starkli &> /dev/null; then
    TOOL="starkli"
    ACCOUNT_DIR="$HOME/.starkli/accounts"
    mkdir -p "$ACCOUNT_DIR"
    
    echo "Setting up account with starkli..."
    starkli account oz init "$ACCOUNT_DIR/${ACCOUNT_NAME}.json" \
        --private-key "$PRIVATE_KEY" \
        --force
    
    echo "Account created at: $ACCOUNT_DIR/${ACCOUNT_NAME}.json"
    echo ""
    echo "To deploy, run:"
    echo "  bash scripts/deploy/contracts.sh $NETWORK"
    
elif command -v sncast &> /dev/null; then
    TOOL="sncast"
    ACCOUNTS_FILE="$HOME/.starknet_accounts/starknet_open_zeppelin_accounts.json"
    mkdir -p "$(dirname "$ACCOUNTS_FILE")"
    
    echo "Setting up account with sncast..."
    # Generate a random salt for the account
    SALT=$(openssl rand -hex 32)
    
    # Create account JSON
    python3 -c "
import json
import secrets

account_data = {
    'version': 1,
    'derivation_path': \"m/44'/9004'/0'/0/0\",
    'private_key': '$PRIVATE_KEY',
    'salt': '$SALT',
    'address': '0x0000000000000000000000000000000000000000000000000000000000000000',
    'deployed': False,
    'class_hash': '0x025ec026984a29e6f48200000000000000000000000000000000000000000000',
    'type': 'openzeppelin'
}

with open('$ACCOUNTS_FILE', 'w') as f:
    json.dump(account_data, f, indent=2)
"
    
    echo "Account file created at: $ACCOUNTS_FILE"
    echo ""
    echo "To deploy, run:"
    echo "  sncast deploy --account $ACCOUNT_NAME --url https://starknet-$NETWORK.g.alchemy.com/starknet/version/rpc/v0_10/YXIKBtHwuu_mxls9Zgphxp7vYeGroh44 --profile $NETWORK"
else
    echo "Error: Neither starkli nor sncast found. Please install one of them."
    exit 1
fi

echo ""
echo "=== Setup Complete ==="
echo "Please fund your account with ETH/STRK on $NETWORK before deploying."
