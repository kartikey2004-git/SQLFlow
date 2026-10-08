#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
plan "create Artifact Registry Docker repo '${AR_REPO}' in ${REGION} (if missing)"
gcloud artifacts repositories describe "$AR_REPO" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud artifacts repositories create "$AR_REPO" --repository-format=docker --location="$REGION" \
    --description="SqlFlow images" --project="$PROJECT_ID"
echo "Images will be ${AR_HOST}/${PROJECT_ID}/${AR_REPO}/{sqlflow-api,sqlflow-worker}:<tag>"
