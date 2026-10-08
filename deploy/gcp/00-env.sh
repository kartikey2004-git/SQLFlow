#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?set PROJECT_ID}"
: "${REGION:?set REGION}"
: "${DOMAIN:?set DOMAIN (apex, e.g. example.com; app.DOMAIN and api.DOMAIN are used)}"

APP_HOST="app.${DOMAIN}"
API_HOST="api.${DOMAIN}"

NETWORK="${NETWORK:-sqlflow-vpc}"
SUBNET="${SUBNET:-sqlflow-subnet}"
SUBNET_RANGE="${SUBNET_RANGE:-10.10.0.0/24}"
PSA_RANGE_NAME="${PSA_RANGE_NAME:-sqlflow-psa}"
PSA_PREFIX_LENGTH="${PSA_PREFIX_LENGTH:-16}"

AR_REPO="${AR_REPO:-sqlflow}"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || echo latest)}"
AR_HOST="${REGION}-docker.pkg.dev"
API_IMAGE="${AR_HOST}/${PROJECT_ID}/${AR_REPO}/sqlflow-api:${IMAGE_TAG}"
WORKER_IMAGE="${AR_HOST}/${PROJECT_ID}/${AR_REPO}/sqlflow-worker:${IMAGE_TAG}"

SQL_APP_INSTANCE="${SQL_APP_INSTANCE:-sqlflow-app}"
SQL_SANDBOX_INSTANCE="${SQL_SANDBOX_INSTANCE:-sqlflow-sandbox}"
SQL_APP_TIER="${SQL_APP_TIER:-db-custom-2-7680}"
SQL_SANDBOX_TIER="${SQL_SANDBOX_TIER:-db-custom-4-15360}"
SQL_APP_MAX_CONNECTIONS="${SQL_APP_MAX_CONNECTIONS:-200}"
SQL_SANDBOX_MAX_CONNECTIONS="${SQL_SANDBOX_MAX_CONNECTIONS:-400}"
SQL_APP_AVAILABILITY="${SQL_APP_AVAILABILITY:-ZONAL}"
SQL_STORAGE_GB="${SQL_STORAGE_GB:-20}"
APP_DB_NAME="${APP_DB_NAME:-sqlflow}"
APP_DB_USER="${APP_DB_USER:-sqlflow_app}"
SANDBOX_ADMIN_USER="${SANDBOX_ADMIN_USER:-sqlflow_sandbox_admin}"

SA_API="sqlflow-api"; SA_WORKER="sqlflow-worker"; SA_SCHEDULER="sqlflow-scheduler"; SA_BUILD="sqlflow-build"
sa_email() { echo "$1@${PROJECT_ID}.iam.gserviceaccount.com"; }

API_SERVICE="${API_SERVICE:-sqlflow-api}"
WORKER_NAME="${WORKER_NAME:-sqlflow-worker}"
MIGRATE_JOB="${MIGRATE_JOB:-sqlflow-migrate}"
SQLRUN_JOB="${SQLRUN_JOB:-sqlflow-sql-bootstrap}"

S_POSTGRES_URL="sqlflow-postgres-url"
S_DATABASE_URL="sqlflow-database-url"
S_SANDBOX_ADMIN_URL="sqlflow-sandbox-admin-database-url"
S_SANDBOX_ROLE_SECRET="sqlflow-sandbox-role-secret"
S_AUTH_SECRET="sqlflow-better-auth-secret"
S_CLEANUP_TOKEN="sqlflow-cleanup-token"
S_GOOGLE_ID="sqlflow-google-client-id";   S_GOOGLE_SECRET="sqlflow-google-client-secret"
S_GITHUB_ID="sqlflow-github-client-id";   S_GITHUB_SECRET="sqlflow-github-client-secret"
S_GEMINI="sqlflow-google-generative-ai-api-key"
S_METRICS_TOKEN="sqlflow-metrics-token"
S_DB_APP_PASSWORD="sqlflow-db-app-password"
S_DB_SANDBOX_PASSWORD="sqlflow-db-sandbox-admin-password"
ALL_SECRETS=("$S_POSTGRES_URL" "$S_DATABASE_URL" "$S_SANDBOX_ADMIN_URL" "$S_SANDBOX_ROLE_SECRET" "$S_AUTH_SECRET" "$S_CLEANUP_TOKEN"
  "$S_GOOGLE_ID" "$S_GOOGLE_SECRET" "$S_GITHUB_ID" "$S_GITHUB_SECRET" "$S_GEMINI" "$S_METRICS_TOKEN" "$S_DB_APP_PASSWORD" "$S_DB_SANDBOX_PASSWORD")

die() { echo "ERROR: $*" >&2; exit 1; }

preflight() {
  command -v gcloud >/dev/null || die "gcloud not found on PATH"
  local active
  active="$(gcloud config get-value project 2>/dev/null || true)"
  [ "$active" = "$PROJECT_ID" ] || die "gcloud active project is '${active}', but PROJECT_ID='${PROJECT_ID}'. Run: gcloud config set project ${PROJECT_ID}"
  gcloud auth list --filter=status:ACTIVE --format='value(account)' | grep -q . || die "no active gcloud account. Run: gcloud auth login"
}

plan() {
  echo "=== $(basename "$0") ==="
  echo "project=${PROJECT_ID} region=${REGION} domain=${DOMAIN}"
  echo "This will:"
  for l in "$@"; do echo "  - $l"; done
  if [ "${CONFIRM:-}" != "yes" ]; then
    echo; echo "Dry run only. Re-run with CONFIRM=yes to execute."; exit 0
  fi
}

secret_exists() { gcloud secrets describe "$1" --project="$PROJECT_ID" >/dev/null 2>&1; }

put_secret() {
  local name="$1"
  if secret_exists "$name"; then
    gcloud secrets versions add "$name" --data-file=- --project="$PROJECT_ID" >/dev/null
  else
    gcloud secrets create "$name" --data-file=- --replication-policy=automatic --project="$PROJECT_ID" >/dev/null
  fi
}

read_secret() { gcloud secrets versions access latest --secret="$1" --project="$PROJECT_ID"; }

sql_private_ip() {
  gcloud sql instances describe "$1" --project="$PROJECT_ID"     --flatten='ipAddresses[]' --format='value(ipAddresses.type,ipAddresses.ipAddress)' | awk '$1=="PRIVATE"{print $2}'
}

gen_secret() { openssl rand -hex "${1:-32}" | tr -d '\015\012'; }

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  preflight
  for v in PROJECT_ID REGION DOMAIN APP_HOST API_HOST NETWORK SUBNET API_IMAGE WORKER_IMAGE SQL_APP_INSTANCE SQL_SANDBOX_INSTANCE API_SERVICE WORKER_NAME; do
    printf '%-24s %s\n' "$v" "${!v}"
  done
fi
