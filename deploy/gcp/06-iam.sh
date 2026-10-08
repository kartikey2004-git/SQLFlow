#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight

API_SECRETS=("$S_POSTGRES_URL" "$S_DATABASE_URL" "$S_AUTH_SECRET" "$S_CLEANUP_TOKEN")
API_OPTIONAL=("$S_GOOGLE_ID" "$S_GOOGLE_SECRET" "$S_GITHUB_ID" "$S_GITHUB_SECRET" "$S_GEMINI" "$S_METRICS_TOKEN")
WORKER_SECRETS=("$S_POSTGRES_URL" "$S_DATABASE_URL" "$S_SANDBOX_ADMIN_URL" "$S_SANDBOX_ROLE_SECRET")

plan "create service accounts: ${SA_API}, ${SA_WORKER}, ${SA_SCHEDULER}, ${SA_BUILD}" \
     "project roles: api/worker -> logging.logWriter, monitoring.metricWriter; build -> artifactregistry.writer, logging.logWriter, storage.objectViewer" \
     "secret-level secretmanager.secretAccessor: api -> ${API_SECRETS[*]} (+ optional secrets that exist); worker -> ${WORKER_SECRETS[*]}" \
     "scheduler SA -> run.invoker on ${API_SERVICE} if that service already exists (re-run after 09)" \
     "migrate/bootstrap jobs reuse sqlflow-api (app DB) and sqlflow-worker (sandbox DB) identities; no Cloud SQL IAM roles needed (private IP + password auth)"

ensure_sa() { gcloud iam service-accounts describe "$(sa_email "$1")" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$1" --display-name="$2" --project="$PROJECT_ID"; }
ensure_sa "$SA_API" "SqlFlow API runtime"
ensure_sa "$SA_WORKER" "SqlFlow worker runtime"
ensure_sa "$SA_SCHEDULER" "SqlFlow Cloud Scheduler"
ensure_sa "$SA_BUILD" "SqlFlow Cloud Build"

proj_role() { gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$(sa_email "$1")" --role="$2" --condition=None >/dev/null; }
for sa in "$SA_API" "$SA_WORKER"; do proj_role "$sa" roles/logging.logWriter; proj_role "$sa" roles/monitoring.metricWriter; done
proj_role "$SA_BUILD" roles/artifactregistry.writer
proj_role "$SA_BUILD" roles/logging.logWriter
proj_role "$SA_BUILD" roles/storage.objectViewer

bind_secret() {
  gcloud secrets add-iam-policy-binding "$1" --member="serviceAccount:$(sa_email "$2")" \
    --role=roles/secretmanager.secretAccessor --project="$PROJECT_ID" >/dev/null
}
for s in "${API_SECRETS[@]}"; do bind_secret "$s" "$SA_API"; done
for s in "${API_OPTIONAL[@]}"; do secret_exists "$s" && bind_secret "$s" "$SA_API" || true; done
for s in "${WORKER_SECRETS[@]}"; do bind_secret "$s" "$SA_WORKER"; done

if gcloud run services describe "$API_SERVICE" --region="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud run services add-iam-policy-binding "$API_SERVICE" --region="$REGION" --project="$PROJECT_ID" \
    --member="serviceAccount:$(sa_email "$SA_SCHEDULER")" --role=roles/run.invoker >/dev/null
fi
echo "Done. Verify with: gcloud secrets get-iam-policy <secret>"
