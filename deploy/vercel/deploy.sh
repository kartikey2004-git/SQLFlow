#!/usr/bin/env bash
set -euo pipefail
: "${DOMAIN:?set DOMAIN}"
VERCEL_PROJECT="${VERCEL_PROJECT:-sqlflow-web}"
API_URL="https://api.${DOMAIN}"
APP_HOST="app.${DOMAIN}"
SCOPE_ARGS=(); [ -n "${VERCEL_SCOPE:-}" ] && SCOPE_ARGS=(--scope "$VERCEL_SCOPE")
cd "$(dirname "$0")/../.."

command -v vercel >/dev/null || { echo "vercel CLI not found: bun add -g vercel  (or npm i -g vercel)"; exit 1; }
vercel whoami "${SCOPE_ARGS[@]}" >/dev/null 2>&1 || { echo "Not logged in. Run: vercel login"; exit 1; }

echo "=== deploy/vercel/deploy.sh ==="
echo "This will:"
echo "  - link this repo root to Vercel project '${VERCEL_PROJECT}' (vercel link)"
echo "  - set NEXT_PUBLIC_API_URL=${API_URL} for production + preview (build-time variable; baked into the bundle)"
echo "  - add domain ${APP_HOST} to the project (vercel domains add)"
echo "  - with PROD=yes: run 'vercel --prod' (otherwise a preview deploy)"
if [ "${CONFIRM:-}" != "yes" ]; then echo; echo "Dry run. Re-run with CONFIRM=yes."; exit 0; fi

vercel link --yes --project "$VERCEL_PROJECT" "${SCOPE_ARGS[@]}"

for target in production preview; do
  vercel env rm NEXT_PUBLIC_API_URL "$target" --yes "${SCOPE_ARGS[@]}" >/dev/null 2>&1 || true
  printf '%s' "$API_URL" | vercel env add NEXT_PUBLIC_API_URL "$target" "${SCOPE_ARGS[@]}"
done

vercel domains add "$APP_HOST" "$VERCEL_PROJECT" "${SCOPE_ARGS[@]}" || echo "(domain add skipped/failed - add ${APP_HOST} in the dashboard if needed)"

if [ "${PROD:-}" = "yes" ]; then
  vercel --prod "${SCOPE_ARGS[@]}"
else
  vercel "${SCOPE_ARGS[@]}"
  echo "Preview deployed. Promote with: PROD=yes CONFIRM=yes $0"
fi
