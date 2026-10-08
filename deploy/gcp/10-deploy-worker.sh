#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
WORKER_INSTANCES="${WORKER_INSTANCES:-2}"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-4}"
plan "deploy worker ${WORKER_NAME} from ${WORKER_IMAGE}: ${WORKER_INSTANCES} instances, WORKER_CONCURRENCY=${WORKER_CONCURRENCY}, 1 CPU, 1GiB, CPU always on" \
     "Direct VPC egress on ${NETWORK}/${SUBNET}; service account ${SA_WORKER}" \
     "secrets: POSTGRES_URL DATABASE_URL SANDBOX_ADMIN_DATABASE_URL SANDBOX_ROLE_SECRET" \
     "no public ingress; no HTTP traffic is expected (PORT=8080 is only for the optional health/metrics listener)"

ENVV="NODE_ENV=production,WORKER_CONCURRENCY=${WORKER_CONCURRENCY}"
SECRETS="POSTGRES_URL=${S_POSTGRES_URL}:latest,DATABASE_URL=${S_DATABASE_URL}:latest,SANDBOX_ADMIN_DATABASE_URL=${S_SANDBOX_ADMIN_URL}:latest,SANDBOX_ROLE_SECRET=${S_SANDBOX_ROLE_SECRET}:latest"

if gcloud run worker-pools deploy --help >/dev/null 2>&1; then
  gcloud run worker-pools deploy "$WORKER_NAME" \
    --image="$WORKER_IMAGE" --region="$REGION" --project="$PROJECT_ID" \
    --service-account="$(sa_email "$SA_WORKER")" \
    --instances="$WORKER_INSTANCES" --cpu=1 --memory=1Gi \
    --network="$NETWORK" --subnet="$SUBNET" --vpc-egress=private-ranges-only \
    --set-env-vars="$ENVV" --set-secrets="$SECRETS"
  exit 0
fi

cat <<EOF

'gcloud run worker-pools' is not available in this gcloud. Fallback options:

(1) Update gcloud:   gcloud components update   (worker pools need a recent release), then re-run this script.

(2) Cloud Run *service* running the worker image (works today, slightly wasteful: it needs a port + keeps an HTTP listener):
    gcloud run deploy ${WORKER_NAME} --image=${WORKER_IMAGE} --region=${REGION} --project=${PROJECT_ID} \\
      --service-account=$(sa_email "$SA_WORKER") --no-allow-unauthenticated --ingress=internal \\
      --min-instances=${WORKER_INSTANCES} --max-instances=${WORKER_INSTANCES} --no-cpu-throttling --cpu=1 --memory=1Gi \\
      --network=${NETWORK} --subnet=${SUBNET} --vpc-egress=private-ranges-only \\
      --set-env-vars=${ENVV} --set-secrets=${SECRETS}
    (the worker must serve 200 on GET / or /health at \$PORT for the default startup probe; set --startup-probe accordingly)

(3) Compute Engine (no public IP; needs Cloud NAT or Private Google Access for Artifact Registry pulls - the subnet has PGA):
    gcloud compute instance-templates create-with-container ${WORKER_NAME}-tpl --project=${PROJECT_ID} \\
      --region=${REGION} --machine-type=e2-small --subnet=${SUBNET} --no-address \\
      --service-account=$(sa_email "$SA_WORKER") --scopes=cloud-platform \\
      --container-image=${WORKER_IMAGE} --container-restart-policy=always \\
      --container-env=NODE_ENV=production,WORKER_CONCURRENCY=${WORKER_CONCURRENCY},PORT=8080
    The container needs the four secret values as env vars. Container-Optimized OS cannot use --set-secrets, so fetch them at boot
    with a startup script (gcloud secrets versions access ... via the metadata token) and 'docker run -e'; do not put values
    in the template's metadata. Then:
    gcloud compute instance-groups managed create ${WORKER_NAME}-mig --project=${PROJECT_ID} --region=${REGION} \\
      --template=${WORKER_NAME}-tpl --size=${WORKER_INSTANCES}
EOF
exit 2
