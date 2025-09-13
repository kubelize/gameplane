#!/bin/bash

# Gameplane Crossplane Render Script
# This script converts GameServer to XGameServer for testing with crossplane render

if [ $# -eq 0 ]; then
    echo "Usage: $0 <claim-file.yaml> [output-file.yaml]"
    echo "Converts a GameServer to XGameServer for crossplane render testing"
    exit 1
fi

CLAIM_FILE="$1"
OUTPUT_FILE="${2:-${CLAIM_FILE%.*}-xr.yaml}"

if [ ! -f "$CLAIM_FILE" ]; then
    echo "Error: File $CLAIM_FILE not found"
    exit 1
fi

# Convert GameServer to XGameServer by changing the kind
sed 's/kind: GameServer/kind: XGameServer/' "$CLAIM_FILE" > "$OUTPUT_FILE"

echo "Converted $CLAIM_FILE to $OUTPUT_FILE"
echo "Run: crossplane render $OUTPUT_FILE apis/gameplane/composition.yaml examples/functions.yaml > test.yaml"
