#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
PUBLIC_AUTH_URL="${PUBLIC_AUTH_URL:-https://${API_HOST}}"
PUBLIC_CORS_ORIGIN="${PUBLIC_CORS_ORIGIN:-https://${APP_HOST}}"
COOKIE_DOMAIN_VALUE="${COOKIE_DOMAIN_VALUE-.${DOMAIN}}"
ENV_VARS="NODE_ENV=production,BETTER_AUTH_URL=${PUBLIC_AUTH_URL},CORS_ORIGIN=${PUBLIC_CORS_ORIGIN}"
[ -n "$COOKIE_DOMAIN_VALUE" ] && ENV_VARS="${ENV_VARS},COOKIE_DOMAIN=${COOKIE_DOMAIN_VALUE}"
API_CPU_ALWAYS="${API_CPU_ALWAYS:-yes}"
plan "deploy Cloud Run service ${API_SERVICE} from ${API_IMAGE} in ${REGION}" \
     "scaling: min 1, max 3, concurrency 50, timeout 60s, 1 CPU, 1GiB, cpu-always-on=${API_CPU_ALWAYS}" \
     "Direct VPC egress: network ${NETWORK}, subnet ${SUBNET}, private-ranges-only" \
     "env: ${ENV_VARS}" \
     "secrets via Secret Manager: POSTGRES_URL DATABASE_URL BETTER_AUTH_SECRET CLEANUP_TOKEN (+ OAuth/Gemini/METRICS_TOKEN when those secrets exist)" \
     "startup + liveness probes on /livez (the app must serve GET /livez without touching the DB)" \
     "public ingress (--allow-unauthenticated): browsers call the API directly; auth is enforced by the app"

SECRETS="POSTGRES_URL=${S_POSTGRES_URL}:latest,DATABASE_URL=${S_DATABASE_URL}:latest,BETTER_AUTH_SECRET=${S_AUTH_SECRET}:latest,CLEANUP_TOKEN=${S_CLEANUP_TOKEN}:latest"
add_opt() { secret_exists "$2" && SECRETS="${SECRETS},$1=$2:latest" || true; }
add_opt GOOGLE_CLIENT_ID "$S_GOOGLE_ID"; add_opt GOOGLE_CLIENT_SECRET "$S_GOOGLE_SECRET"
add_opt GITHUB_CLIENT_ID "$S_GITHUB_ID"; add_opt GITHUB_CLIENT_SECRET "$S_GITHUB_SECRET"
add_opt GOOGLE_GENERATIVE_AI_API_KEY "$S_GEMINI"; add_opt METRICS_TOKEN "$S_METRICS_TOKEN"

if [ "$API_CPU_ALWAYS" = "yes" ]; then CPU_FLAG="--no-cpu-throttling"; else CPU_FLAG="--cpu-throttling"; fi

gcloud run deploy "$API_SERVICE" \
  --image="$API_IMAGE" --region="$REGION" --project="$PROJECT_ID" \
  --service-account="$(sa_email "$SA_API")" \
  --port=8080 --min-instances=1 --max-instances=3 --concurrency=50 --timeout=60 \
  --cpu=1 --memory=1Gi "$CPU_FLAG" \
  --network="$NETWORK" --subnet="$SUBNET" --vpc-egress=private-ranges-only \
  --allow-unauthenticated \
  --set-env-vars="$ENV_VARS" \
  --set-secrets="$SECRETS" \
  --startup-probe="httpGet.path=/livez,httpGet.port=8080,periodSeconds=5,timeoutSeconds=3,failureThreshold=24" \
  --liveness-probe="httpGet.path=/livez,httpGet.port=8080,periodSeconds=30,timeoutSeconds=3,failureThreshold=3"

echo
echo "Service URL: $(gcloud run services describe "$API_SERVICE" --region="$REGION" --project="$PROJECT_ID" --format='value(status.url)')"
cat <<NOTE

Custom domain ${API_HOST}  (pick ONE):
  A) Cloud Run domain mapping (simple, but "preview" and not available in every region):
       gcloud beta run domain-mappings create --service ${API_SERVICE} --domain ${API_HOST} --region ${REGION}
       gcloud beta run domain-mappings describe --domain ${API_HOST} --region ${REGION}   # shows the DNS records to create
     Domain ownership must be verified in Google Search Console for the Google account running gcloud.
  B) Global external Application Load Balancer + serverless NEG (recommended for production; adds cost, enables Cloud Armor).
     Not scripted here.
Then create the DNS records at your registrar and wait for the managed certificate (can take 15-60 min).
NOTE

if [ "${MAP_DOMAIN:-}" = "yes" ]; then
  gcloud beta run domain-mappings create --service "$API_SERVICE" --domain "$API_HOST" --region "$REGION" --project "$PROJECT_ID" || true
  gcloud beta run domain-mappings describe --domain "$API_HOST" --region "$REGION" --project "$PROJECT_ID" --format='yaml(status.resourceRecords)' || true
fi
