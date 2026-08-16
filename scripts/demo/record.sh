#!/bin/bash
set -e

# Demo recording helper script
# Opens OBS or provides recording instructions

echo "=== Nexora Protocol Demo Recording ==="
echo ""
echo "Prerequisites:"
echo "  1. OBS Studio installed (https://obsproject.com/)"
echo "  2. Product running on localhost:3000"
echo "  3. MetaMask configured with testnet accounts"
echo ""
echo "Recording settings:"
echo "  - Resolution: 1920x1080"
echo "  - Frame rate: 60fps"
echo "  - Audio: Microphone input"
echo ""
echo "Script outline:"
echo "  [0:00-0:20] Problem statement"
echo "  [0:20-0:40] Nexora Protocol solution"
echo "  [0:40-1:20] Live flow: Arbitrum -> Starknet -> Base"
echo "  [1:20-1:50] Privacy & selective disclosure"
echo "  [1:50-2:20] 3 mainnet transactions on Voyager"
echo "  [2:20-2:40] Architecture overview"
echo "  [2:40-3:00] Call to action"
echo ""
echo "Post-processing:"
echo "  1. Add text overlays for key points"
echo "  2. Add background music (low volume)"
echo "  3. Export as MP4 (H.264)"
echo "  4. Upload to YouTube (unlisted)"
echo "  5. Update strk20.json with demo_video URL"
