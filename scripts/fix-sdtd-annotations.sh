#!/bin/bash

# Script to add required gotemplating annotations to Object resources in SDTD composition

COMP_FILE="/Users/dan/Git/kubelize/gameplane/apis/games/sdtd/composition.yaml"

# Add the required annotation after each crossplane.io/external-name annotation
sed -i '' '/crossplane.io\/external-name/a\
              gotemplating.fn.crossplane.io/composition-resource-name: {{ $fullName }}-sdtd-config' "$COMP_FILE"

echo "Added required annotations to SDTD composition"
