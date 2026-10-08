#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
plan "create Cloud SQL ${SQL_APP_INSTANCE}: POSTGRES_17 ${SQL_APP_TIER} ${SQL_APP_AVAILABILITY}, private IP only on ${NETWORK}, daily backups + PITR, max_connections=${SQL_APP_MAX_CONNECTIONS}, deletion protection" \
     "create Cloud SQL ${SQL_SANDBOX_INSTANCE}: POSTGRES_17 ${SQL_SANDBOX_TIER} ZONAL, private IP only, daily backups, max_connections=${SQL_SANDBOX_MAX_CONNECTIONS}, deletion protection" \
     "users and passwords are created in 05-secrets.sh; databases/roles by 08-migrate.sh (bootstrap jobs)"

NET="projects/${PROJECT_ID}/global/networks/${NETWORK}"
common=(--database-version=POSTGRES_17 --edition=ENTERPRISE --region="$REGION" --network="$NET" --no-assign-ip
        --storage-type=SSD --storage-size="$SQL_STORAGE_GB" --storage-auto-increase
        --backup-start-time=21:00 --retained-backups-count=7
        --maintenance-window-day=SUN --maintenance-window-hour=22
        --deletion-protection --project="$PROJECT_ID")

if ! gcloud sql instances describe "$SQL_APP_INSTANCE" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_APP_INSTANCE" "${common[@]}" \
    --tier="$SQL_APP_TIER" --availability-type="$SQL_APP_AVAILABILITY" \
    --enable-point-in-time-recovery --retained-transaction-log-days=7 \
    --database-flags="max_connections=${SQL_APP_MAX_CONNECTIONS}"
fi

if ! gcloud sql instances describe "$SQL_SANDBOX_INSTANCE" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud sql instances create "$SQL_SANDBOX_INSTANCE" "${common[@]}" \
    --tier="$SQL_SANDBOX_TIER" --availability-type=ZONAL \
    --database-flags="max_connections=${SQL_SANDBOX_MAX_CONNECTIONS}"
fi

for i in "$SQL_APP_INSTANCE" "$SQL_SANDBOX_INSTANCE"; do
  echo "${i} private IP: $(sql_private_ip "$i")"
done
