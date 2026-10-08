#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
APIS=(run.googleapis.com compute.googleapis.com sqladmin.googleapis.com servicenetworking.googleapis.com
  artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
  cloudscheduler.googleapis.com monitoring.googleapis.com logging.googleapis.com iam.googleapis.com
  cloudresourcemanager.googleapis.com)
plan "enable APIs in ${PROJECT_ID}: ${APIS[*]}"
gcloud services enable "${APIS[@]}" --project="$PROJECT_ID"
echo "Done."
