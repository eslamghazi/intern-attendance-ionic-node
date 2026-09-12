#!/usr/bin/env bash
#
# Build and start the stack in production mode.
#
#   ./deploy/deploy.sh
#
# Safe to re-run: the migration container is one-shot and idempotent, and the
# API waits for it to finish, so a deploy can never race a half-applied schema.
#
# What this does NOT do is decide anything. It refuses on a missing secret
# rather than inventing one, because a stack that comes up with a default
# password is worse than one that does not come up.
set -euo pipefail

cd "$(dirname "$0")/.."

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

# ---------------------------------------------------------------- preflight
if [ ! -f .env ]; then
  echo "deploy: .env is missing. Copy .env.example and fill it in:" >&2
  echo "          cp .env.example .env" >&2
  echo "          node server/scripts/generate-secrets.mjs" >&2
  exit 1
fi

# shellcheck disable=SC1091
set -a; . ./.env; set +a

fail=0
require() {
  local name="$1" value="${!1:-}" min="${2:-1}"
  if [ -z "$value" ]; then
    echo "deploy: $name is not set in .env" >&2
    fail=1
  elif [ "${#value}" -lt "$min" ]; then
    echo "deploy: $name is too short (${#value} chars, needs $min)" >&2
    fail=1
  fi
}

require APP_JWT_SECRET 32
require STORAGE_URL_SECRET 32
require POSTGRES_PASSWORD 12

# The one value that is worse than missing: a placeholder that works.
case "${POSTGRES_PASSWORD:-}" in
  change-me|attendance_dev|postgres|password)
    echo "deploy: POSTGRES_PASSWORD is still a placeholder." >&2
    fail=1
    ;;
esac

[ "$fail" -eq 0 ] || {
  echo >&2
  echo "Generate the missing ones:  node server/scripts/generate-secrets.mjs" >&2
  exit 1
}

# ------------------------------------------------------------------- deploy
echo "==> building"
"${COMPOSE[@]}" build

echo "==> migrating (one-shot; the API will not start until this succeeds)"
"${COMPOSE[@]}" run --rm migrate

echo "==> starting"
"${COMPOSE[@]}" up -d --remove-orphans

echo "==> waiting for the API to report healthy"
for _ in $(seq 1 30); do
  status="$("${COMPOSE[@]}" ps --format '{{.Service}} {{.Health}}' 2>/dev/null | awk '$1=="api"{print $2}')"
  [ "$status" = "healthy" ] && break
  sleep 2
done

if [ "${status:-}" != "healthy" ]; then
  echo "deploy: the API did not become healthy. Recent logs:" >&2
  "${COMPOSE[@]}" logs --tail 40 api >&2
  exit 1
fi

echo
"${COMPOSE[@]}" ps
echo
echo "Deployed. The app is on 127.0.0.1:${WEB_PORT:-8080} — reachable only"
echo "through nginx, which is the point. See deploy/aapanel-nginx.conf."
echo
echo "First time on a fresh database, create the superadmin:"
echo "  ${COMPOSE[*]} logs api | grep -A4 'FIRST SUPERADMIN'   # the generated password"
echo "  ${COMPOSE[*]} exec -T api npm run superadmin:password   # or set a fresh one"
