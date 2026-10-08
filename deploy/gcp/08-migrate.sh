#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
STEPS="${STEPS:-db migrate sandbox}"
HERE="$(cd "$(dirname "$0")" && pwd)"
plan "steps: ${STEPS}" \
     "deploy+execute Cloud Run Jobs from image ${API_IMAGE} with Direct VPC egress on ${NETWORK}/${SUBNET}" \
     "migrate: node_modules/.bin/node-pg-migrate -d POSTGRES_URL up  (apps/api/migrations)" \
     "sandbox: run deploy/sql/sandbox-bootstrap.sql against the sandbox instance (idempotent)"

b64() { base64 < "$1" | tr -d '\n'; }
JS_B64="$(b64 "$HERE/sql-runner.js")"
NET_FLAGS=(--network="$NETWORK" --subnet="$SUBNET" --vpc-egress=private-ranges-only)
COMMON=(--image="$API_IMAGE" --region="$REGION" --project="$PROJECT_ID" --max-retries=0 --task-timeout=600 --cpu=1 --memory=512Mi "${NET_FLAGS[@]}")

run_sqlrunner_job() {
  local name="$1" sa="$2" secret="$3" envs="$4"
  gcloud run jobs deploy "$name" "${COMMON[@]}" --service-account="$(sa_email "$sa")" \
    --set-secrets="DB_URL=${secret}:latest" \
    --set-env-vars="^@^${envs}@JS_B64=${JS_B64}" \
    --command=sh --args='^@^-c@echo "$JS_B64" | base64 -d | node -'
  gcloud run jobs execute "$name" --region="$REGION" --project="$PROJECT_ID" --wait
}

for step in $STEPS; do
  case "$step" in
    db)
      run_sqlrunner_job "${SQLRUN_JOB}-appdb" "$SA_API" "$S_POSTGRES_URL" "MODE=create-db@TARGET_DB=${APP_DB_NAME}" ;;
    migrate)
      gcloud run jobs deploy "$MIGRATE_JOB" "${COMMON[@]}" --service-account="$(sa_email "$SA_API")" \
        --set-secrets="POSTGRES_URL=${S_POSTGRES_URL}:latest" \
        --set-env-vars="NODE_ENV=production" \
        --command=node_modules/.bin/node-pg-migrate --args='-d,POSTGRES_URL,up'
      gcloud run jobs execute "$MIGRATE_JOB" --region="$REGION" --project="$PROJECT_ID" --wait ;;
    sandbox)
      SQL_B64="$(b64 "$HERE/../sql/sandbox-bootstrap.sql")"
      run_sqlrunner_job "${SQLRUN_JOB}-sandbox" "$SA_WORKER" "$S_SANDBOX_ADMIN_URL" "MODE=sql@SQL_B64=${SQL_B64}" ;;
    *) die "unknown step '$step'" ;;
  esac
done
echo "Done. Logs: gcloud run jobs executions list --job=${MIGRATE_JOB} --region=${REGION}"
