#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
plan "create/refresh secrets: ${ALL_SECRETS[*]}" \
     "create DB users '${APP_DB_USER}' on ${SQL_APP_INSTANCE} and '${SANDBOX_ADMIN_USER}' on ${SQL_SANDBOX_INSTANCE} (gcloud sql users create; members of cloudsqlsuperuser, NOT real superusers)" \
     "assemble POSTGRES_URL / DATABASE_URL / SANDBOX_ADMIN_DATABASE_URL from the instances' PRIVATE IPs (needs 04-cloudsql.sh done)"

gen_once() {
  if [ "${ROTATE:-}" = "yes" ] || ! secret_exists "$1"; then gen_secret "$2" | put_secret "$1"; fi
}
env_once() {
  local val="${!2:-}"
  if [ -n "$val" ]; then printf '%s' "$val" | put_secret "$1"; fi
}

gen_once "$S_AUTH_SECRET" 32
gen_once "$S_CLEANUP_TOKEN" 32
gen_once "$S_SANDBOX_ROLE_SECRET" 32
gen_once "$S_DB_APP_PASSWORD" 24
gen_once "$S_DB_SANDBOX_PASSWORD" 24
env_once "$S_GOOGLE_ID" GOOGLE_CLIENT_ID;  env_once "$S_GOOGLE_SECRET" GOOGLE_CLIENT_SECRET
env_once "$S_GITHUB_ID" GITHUB_CLIENT_ID;  env_once "$S_GITHUB_SECRET" GITHUB_CLIENT_SECRET
env_once "$S_GEMINI" GOOGLE_GENERATIVE_AI_API_KEY
env_once "$S_METRICS_TOKEN" METRICS_TOKEN


ensure_user() {
  local pw; pw="$(read_secret "$3")"
  if gcloud sql users list --instance="$1" --project="$PROJECT_ID" --format='value(name)' | grep -qx "$2"; then
    gcloud sql users set-password "$2" --instance="$1" --password="$pw" --project="$PROJECT_ID" >/dev/null
  else
    gcloud sql users create "$2" --instance="$1" --password="$pw" --project="$PROJECT_ID" >/dev/null
  fi
}
ensure_user "$SQL_APP_INSTANCE" "$APP_DB_USER" "$S_DB_APP_PASSWORD"
ensure_user "$SQL_SANDBOX_INSTANCE" "$SANDBOX_ADMIN_USER" "$S_DB_SANDBOX_PASSWORD"

APP_IP="$(sql_private_ip "$SQL_APP_INSTANCE")";     [ -n "$APP_IP" ] || die "no private IP for ${SQL_APP_INSTANCE}"
SBX_IP="$(sql_private_ip "$SQL_SANDBOX_INSTANCE")"; [ -n "$SBX_IP" ] || die "no private IP for ${SQL_SANDBOX_INSTANCE}"
APP_PW="$(read_secret "$S_DB_APP_PASSWORD")"; SBX_PW="$(read_secret "$S_DB_SANDBOX_PASSWORD")"
printf 'postgres://%s:%s@%s:5432/%s' "$APP_DB_USER" "$APP_PW" "$APP_IP" "$APP_DB_NAME" | put_secret "$S_POSTGRES_URL"
printf 'postgres://%s:%s@%s:5432/%s' "$APP_DB_USER" "$APP_PW" "$APP_IP" "$APP_DB_NAME" | put_secret "$S_DATABASE_URL"
printf 'postgres://%s:%s@%s:5432/postgres' "$SANDBOX_ADMIN_USER" "$SBX_PW" "$SBX_IP" | put_secret "$S_SANDBOX_ADMIN_URL"
unset APP_PW SBX_PW
echo "Secrets written (values not shown). List: gcloud secrets list --project=${PROJECT_ID}"
