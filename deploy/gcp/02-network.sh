#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
plan "create custom-mode VPC '${NETWORK}' (if missing)" \
     "create subnet '${SUBNET}' ${SUBNET_RANGE} in ${REGION} with Private Google Access (if missing)" \
     "allocate Private Service Access range '${PSA_RANGE_NAME}' /${PSA_PREFIX_LENGTH} (if missing)" \
     "create VPC peering with servicenetworking.googleapis.com (if missing)" \
     "no Cloud NAT is created: Cloud Run uses --vpc-egress=private-ranges-only so only RFC1918 traffic enters the VPC"

gcloud compute networks describe "$NETWORK" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud compute networks create "$NETWORK" --subnet-mode=custom --project="$PROJECT_ID"

gcloud compute networks subnets describe "$SUBNET" --region="$REGION" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud compute networks subnets create "$SUBNET" --network="$NETWORK" --region="$REGION" \
    --range="$SUBNET_RANGE" --enable-private-ip-google-access --project="$PROJECT_ID"

gcloud compute addresses describe "$PSA_RANGE_NAME" --global --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud compute addresses create "$PSA_RANGE_NAME" --global --purpose=VPC_PEERING \
    --prefix-length="$PSA_PREFIX_LENGTH" --network="$NETWORK" --project="$PROJECT_ID"

if ! gcloud services vpc-peerings list --network="$NETWORK" --project="$PROJECT_ID" \
     --format='value(peering)' 2>/dev/null | grep -q .; then
  gcloud services vpc-peerings connect --service=servicenetworking.googleapis.com \
    --ranges="$PSA_RANGE_NAME" --network="$NETWORK" --project="$PROJECT_ID"
fi
echo "Done."
