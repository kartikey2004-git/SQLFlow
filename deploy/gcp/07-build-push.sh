#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
BUILD_MODE="${BUILD_MODE:-cloudbuild}"
REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
plan "build (${BUILD_MODE}) and push ${API_IMAGE}" "build (${BUILD_MODE}) and push ${WORKER_IMAGE}" \
     "build context = repo root (${REPO_ROOT}); no .env files are included (see .dockerignore)"
cd "$REPO_ROOT"

if [ "$BUILD_MODE" = "local" ]; then
  gcloud auth configure-docker "$AR_HOST" --quiet
  docker build -f apps/api/Dockerfile        -t "$API_IMAGE" .
  docker build -f apps/api/Dockerfile.worker -t "$WORKER_IMAGE" .
  docker push "$API_IMAGE"
  docker push "$WORKER_IMAGE"
else
  gcloud builds submit --project="$PROJECT_ID" --region="$REGION" \
    --config=deploy/gcp/cloudbuild.yaml \
    --service-account="projects/${PROJECT_ID}/serviceAccounts/$(sa_email "$SA_BUILD")" \
    --substitutions="_API_IMAGE=${API_IMAGE},_WORKER_IMAGE=${WORKER_IMAGE}" .
fi
echo "Pushed. IMAGE_TAG=${IMAGE_TAG} (export the same IMAGE_TAG for 08/09/10)"
