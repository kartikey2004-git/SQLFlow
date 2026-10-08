#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
URI="${API_BASE_URL:-https://${API_HOST}}/cleanup/perform"
plan "create/update Cloud Scheduler job sqlflow-cleanup-daily (0 3 * * * UTC) -> POST ${URI}" \
     "create/update Cloud Scheduler job sqlflow-cleanup-sweep (*/10 * * * *) -> POST ${URI} body {\"daysToKeep\":7}" \
     "header x-cleanup-authorization is filled from Secret Manager (${S_CLEANUP_TOKEN}); never echoed" \
     "scheduler location: ${REGION}; job SA ${SA_SCHEDULER} (OIDC not attached, see header comment)"

TOKEN="$(read_secret "$S_CLEANUP_TOKEN")"

upsert_job() {
  local name="$1"
  if gcloud scheduler jobs describe "$name" --location="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    gcloud scheduler jobs update http "$name" --location="$REGION" --project="$PROJECT_ID" \
      --schedule="$2" --time-zone=UTC --uri="$URI" --http-method=POST \
      --update-headers="Content-Type=application/json,x-cleanup-authorization=${TOKEN}" \
      --message-body="$3" --attempt-deadline=60s --max-retry-attempts=1 >/dev/null
  else
    gcloud scheduler jobs create http "$name" --location="$REGION" --project="$PROJECT_ID" \
      --schedule="$2" --time-zone=UTC --uri="$URI" --http-method=POST \
      --headers="Content-Type=application/json,x-cleanup-authorization=${TOKEN}" \
      --message-body="$3" --attempt-deadline=60s --max-retry-attempts=1 >/dev/null
  fi
  echo "ok: $name"
}

upsert_job sqlflow-cleanup-daily "0 3 * * *" '{"daysToKeep":7}'
upsert_job sqlflow-cleanup-sweep "*/10 * * * *" '{"daysToKeep":7}'
unset TOKEN
echo "Test: gcloud scheduler jobs run sqlflow-cleanup-sweep --location=${REGION}"
