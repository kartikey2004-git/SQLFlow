#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/00-env.sh"
preflight
: "${ALERT_EMAIL:?set ALERT_EMAIL (notification channel recipient)}"
CPU_THRESHOLD="${CPU_THRESHOLD:-0.8}"
APP_CONN_ALERT=$(( SQL_APP_MAX_CONNECTIONS * 80 / 100 ))
SBX_CONN_ALERT=$(( SQL_SANDBOX_MAX_CONNECTIONS * 80 / 100 ))
plan "email notification channel for ${ALERT_EMAIL}" \
     "uptime check sqlflow-api-health: https://${API_HOST}/health every 5 min" \
     "alert: uptime check failing > 5 min" \
     "alert: Cloud Run ${API_SERVICE} 5xx rate > 0.05/s for 5 min" \
     "alert: Cloud SQL CPU > ${CPU_THRESHOLD} for 10 min (both instances)" \
     "alerts: Cloud SQL num_backends > ${APP_CONN_ALERT} on ${SQL_APP_INSTANCE}, > ${SBX_CONN_ALERT} on ${SQL_SANDBOX_INSTANCE} (80% of max_connections)"

TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT

CHANNEL="$(gcloud beta monitoring channels list --project="$PROJECT_ID" \
  --filter="type=email AND labels.email_address=${ALERT_EMAIL}" --format='value(name)' | head -n1 || true)"
if [ -z "$CHANNEL" ]; then
  CHANNEL="$(gcloud beta monitoring channels create --project="$PROJECT_ID" --display-name="SqlFlow alerts" \
    --type=email --channel-labels="email_address=${ALERT_EMAIL}" --format='value(name)')"
fi

if ! gcloud monitoring uptime list-configs --project="$PROJECT_ID" --filter='displayName=sqlflow-api-health' --format='value(name)' | grep -q .; then
  gcloud monitoring uptime create sqlflow-api-health --project="$PROJECT_ID" \
    --resource-type=uptime-url --resource-labels="host=${API_HOST},project_id=${PROJECT_ID}" \
    --protocol=https --path=/health --port=443 --period=5 --timeout=10 --status-classes=2xx --validate-ssl=true
fi
CHECK_ID="$(gcloud monitoring uptime list-configs --project="$PROJECT_ID" --filter='displayName=sqlflow-api-health' --format='value(name)' | head -n1 | awk -F/ '{print $NF}')"

mkpolicy() {
  local file="$1" name="$2" filter="$3" cmp="$4" thr="$5" dur="$6" aligner="$7" reducer="${8:-REDUCE_NONE}" period="${9:-60s}"
  cat > "$file" <<JSON
{
  "displayName": "${name}",
  "combiner": "OR",
  "notificationChannels": ["${CHANNEL}"],
  "conditions": [{
    "displayName": "${name}",
    "conditionThreshold": {
      "filter": $(printf '%s' "$filter" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "${filter//\"/\\\"}"),
      "comparison": "${cmp}",
      "thresholdValue": ${thr},
      "duration": "${dur}",
      "aggregations": [{"alignmentPeriod": "${period}", "perSeriesAligner": "${aligner}", "crossSeriesReducer": "${reducer}", "groupByFields": []}],
      "trigger": {"count": 1}
    }
  }]
}
JSON
}
create_policy() {
  local name="$1" file="$2"
  if gcloud alpha monitoring policies list --project="$PROJECT_ID" --filter="displayName=\"${name}\"" --format='value(name)' | grep -q .; then
    echo "exists: ${name}"; return
  fi
  gcloud alpha monitoring policies create --project="$PROJECT_ID" --policy-from-file="$file" >/dev/null
  echo "created: ${name}"
}

cat > "$TMP/uptime.json" <<JSON
{
  "displayName": "sqlflow: API /health failing",
  "combiner": "OR",
  "notificationChannels": ["${CHANNEL}"],
  "conditions": [{
    "displayName": "uptime check failing",
    "conditionThreshold": {
      "filter": "metric.type=\"monitoring.googleapis.com/uptime_check/check_passed\" AND metric.label.check_id=\"${CHECK_ID}\" AND resource.type=\"uptime_url\"",
      "comparison": "COMPARISON_GT", "thresholdValue": 1, "duration": "300s",
      "aggregations": [{"alignmentPeriod": "300s", "perSeriesAligner": "ALIGN_NEXT_OLDER", "crossSeriesReducer": "REDUCE_COUNT_FALSE", "groupByFields": ["resource.label.*"]}],
      "trigger": {"count": 1}
    }
  }]
}
JSON
create_policy "sqlflow: API /health failing" "$TMP/uptime.json"

mkpolicy "$TMP/5xx.json" "sqlflow: API 5xx rate" \
  "metric.type=\"run.googleapis.com/request_count\" AND resource.type=\"cloud_run_revision\" AND resource.label.service_name=\"${API_SERVICE}\" AND metric.label.response_code_class=\"5xx\"" \
  COMPARISON_GT 0.05 300s ALIGN_RATE REDUCE_SUM 60s
create_policy "sqlflow: API 5xx rate" "$TMP/5xx.json"

for inst in "$SQL_APP_INSTANCE:$APP_CONN_ALERT" "$SQL_SANDBOX_INSTANCE:$SBX_CONN_ALERT"; do
  name="${inst%%:*}"; limit="${inst##*:}"
  mkpolicy "$TMP/cpu-$name.json" "sqlflow: ${name} CPU high" \
    "metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\" AND resource.type=\"cloudsql_database\" AND resource.label.database_id=\"${PROJECT_ID}:${name}\"" \
    COMPARISON_GT "$CPU_THRESHOLD" 600s ALIGN_MEAN REDUCE_NONE 60s
  create_policy "sqlflow: ${name} CPU high" "$TMP/cpu-$name.json"
  mkpolicy "$TMP/conn-$name.json" "sqlflow: ${name} connections high" \
    "metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\" AND resource.type=\"cloudsql_database\" AND resource.label.database_id=\"${PROJECT_ID}:${name}\"" \
    COMPARISON_GT "$limit" 300s ALIGN_MAX REDUCE_SUM 60s
  create_policy "sqlflow: ${name} connections high" "$TMP/conn-$name.json"
done
echo "Done. Review in Cloud Console > Monitoring > Alerting."
