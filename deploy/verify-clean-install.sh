#!/usr/bin/env bash
# =============================================================================
#  إثبات أن المشروع يعمل على PostgreSQL عادي بمستخدم بلا صلاحيات خاصة.
#
#  يبني قاعدة نظيفة تمامًا، يشغّل الترحيل بمستخدم التطبيق، ثم يهدمها.
#  لا يلمس قاعدة الإنتاج إطلاقًا — ولا يحتاج إليها.
#
#      sudo bash deploy/verify-clean-install.sh 'كلمة-مرور-intern_app'
#
#  الخطوة الوحيدة التي تحتاج superuser هنا هي إنشاء القاعدة والإضافات — وهي
#  بالضبط الخطوة التي يقوم بها الإنسان مرة واحدة عند تجهيز خادم جديد.
#  كل ما بعدها يعمل بـ intern_app وحده.
# =============================================================================
set -uo pipefail

APP_ROLE="${APP_ROLE:-intern_app}"
APP_PASS="${1:-${APP_PASS:-}}"
TEST_DB="${TEST_DB:-test_clean}"
PGHOST="${PGHOST:-127.0.0.1}"
PGPORT="${PGPORT:-5432}"
PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

if [[ -z "$APP_PASS" ]]; then
  echo "usage: sudo bash deploy/verify-clean-install.sh '<password for $APP_ROLE>'" >&2
  exit 2
fi

TEST_URL="postgresql://${APP_ROLE}:${APP_PASS}@${PGHOST}:${PGPORT}/${TEST_DB}"
FAILED=0

say()  { printf '\n\033[1m=== %s ===\033[0m\n' "$*"; }
step() { printf '\n--- %s\n' "$*"; }
pass() { printf '  \033[32mPASS\033[0m  %s\n' "$*"; }
fail() { printf '  \033[31mFAIL\033[0m  %s\n' "$*"; FAILED=1; }

su_psql() { sudo -u postgres psql -v ON_ERROR_STOP=1 -qtAX "$@"; }
app_psql() { psql "$TEST_URL" -v ON_ERROR_STOP=1 -qtAX "$@"; }

cleanup() {
  step "tearing the test database down"
  sudo -u postgres psql -qtAX -c \
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = '${TEST_DB}'" >/dev/null 2>&1
  sudo -u postgres psql -qtAX -c "drop database if exists ${TEST_DB}" >/dev/null 2>&1 \
    && echo "  dropped ${TEST_DB}"
}
trap cleanup EXIT

# -----------------------------------------------------------------------------
say "0. the application role has NO elevated attributes"
# -----------------------------------------------------------------------------
ATTRS=$(su_psql -c "select rolsuper::text || ' ' || rolcreaterole::text || ' ' || rolcreatedb::text || ' ' || rolbypassrls::text || ' ' || rolreplication::text from pg_roles where rolname = '${APP_ROLE}'")
echo "  rolsuper rolcreaterole rolcreatedb rolbypassrls rolreplication"
echo "  ${ATTRS:-<role not found>}"
if [[ "$ATTRS" == "false false"* && "$ATTRS" != *"true"* ]]; then
  pass "$APP_ROLE is an ordinary role"
else
  fail "$APP_ROLE still carries an elevated attribute (or was not found)"
fi

# -----------------------------------------------------------------------------
say "1. build a completely clean database"
# -----------------------------------------------------------------------------
sudo -u postgres psql -qtAX -c "drop database if exists ${TEST_DB}" >/dev/null 2>&1
su_psql -c "create database ${TEST_DB} owner ${APP_ROLE}" \
  && pass "created ${TEST_DB} owned by ${APP_ROLE}" \
  || { fail "could not create ${TEST_DB}"; exit 1; }

step "the one-off superuser preparation (one grant, and nothing else)"
# NO `create extension` OF ANY KIND. That is the assertion: this schema needs
# none, and if a migration ever starts asking for one, the run below must fail
# here rather than quietly pass on a box that happens to have it installed.
su_psql -d "$TEST_DB" -c "grant create, usage on schema public to ${APP_ROLE}" && echo "  grant on schema public      ok"

# -----------------------------------------------------------------------------
say "2. npm run migrate — as the ordinary application role"
# -----------------------------------------------------------------------------
cd "$PROJECT_DIR" || exit 1
if DATABASE_URL="$TEST_URL" npm run migrate; then
  pass "every phase completed with no elevation at any point"
else
  fail "migrate failed — the output above names the file, line and statement"
fi

# -----------------------------------------------------------------------------
say "4. the schema is what the API expects"
# -----------------------------------------------------------------------------
# The scheduled jobs are the API's own now (src/infrastructure/scheduler), not
# the API's own, so there is no scheduler table to inspect — they appear in the
# API log
# under [scheduler] once it starts, which section 7 below does.
check_empty() { # <label> <sql>
  local out; out=$(app_psql -c "$2" 2>&1)
  if [[ -z "$out" || "$out" == "0" ]]; then pass "$1"; else fail "$1 -> ${out}"; fi
}
# plpgsql is installed in every database by template1 and cannot be opted out
# of; anything else means something reintroduced a dependency.
check_empty "no extensions at all"   "select count(*) from pg_extension where extname <> 'plpgsql'"
# Authorization lives in the API (see server/README.md). These two assert that
# nothing has quietly added a SECOND layer in the database: a policy that silently
# filters rows would make the API's own checks look correct while the real rule
# lived somewhere no test reads.
check_empty "no table enforces its own row filtering"   "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity"
check_empty "no row policies"   "select count(*) from pg_policies where schemaname='public'"
check_empty "no function reads identity from the session"   "select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public'
      and pg_get_functiondef(p.oid) ~* '(auth\.(uid|jwt|role)\s*\(|request\.jwt\.claims)'"

step "table count"
app_psql -c "select count(*) || ' tables in public' from pg_tables where schemaname='public'"

# -----------------------------------------------------------------------------
say "6. the API seeds its own superadmin, then we set a known password"
# -----------------------------------------------------------------------------
# There is no seed step any more: the first superadmin is created when the API
# starts against a database that has none. The API is started below, so here we
# only need a password we know in order to sign in with it.
SUPERADMIN_NATIONAL_ID="${SUPERADMIN_NATIONAL_ID:-30110281500753}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-VerifyOnly!2026}"

# -----------------------------------------------------------------------------
say "7. the API against the clean database"
# -----------------------------------------------------------------------------
# A throwaway port, so a running production instance is untouched.
PORT_TEST="${PORT_TEST:-8799}"

if [[ ! -f "${PROJECT_DIR}/server/dist/main.js" ]]; then
  step "server/dist is missing — building the server"
  npm --prefix server run build || { fail "server build failed"; exit 1; }
fi

step "starting the API on :${PORT_TEST}"
DATABASE_URL="$TEST_URL" PORT="$PORT_TEST" NODE_ENV=production \
  APP_JWT_SECRET="${APP_JWT_SECRET:-verification_only_secret_at_least_32_chars}" \
  STORAGE_URL_SECRET="${STORAGE_URL_SECRET:-verification_only_secret_at_least_32_chars}" \
  npm start > /tmp/verify-api.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null; cleanup' EXIT

for _ in $(seq 1 40); do
  curl -fsS "http://127.0.0.1:${PORT_TEST}/api/v1/health" >/dev/null 2>&1 && break
  sleep 0.5
done

HEALTH=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${PORT_TEST}/api/v1/health")
[[ "$HEALTH" == "200" ]] && pass "GET /api/v1/health -> 200" || fail "GET /api/v1/health -> ${HEALTH}"

# The API created its own superadmin on that first start, with a generated
# password. Give it one we know, the way an operator would.
if DATABASE_URL="$TEST_URL" npm --prefix server run superadmin:password -- \
     --set "$SUPERADMIN_PASSWORD" >/dev/null 2>&1; then
  pass "superadmin:password set a known password"
else
  fail "superadmin:password failed — was a superadmin seeded at start-up?"
fi

LOGIN=$(curl -s -X POST "http://127.0.0.1:${PORT_TEST}/api/v1/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"national_id\":\"${SUPERADMIN_NATIONAL_ID}\",\"password\":\"${SUPERADMIN_PASSWORD}\"}")
TOKEN=$(printf '%s' "$LOGIN" | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')
if [[ -n "$TOKEN" ]]; then pass "POST /api/v1/auth/login returned a token"
else fail "login returned no token: ${LOGIN}"; fi

SETTINGS=$(curl -s -o /tmp/verify-settings.json -w '%{http_code}' \
  -H "Authorization: Bearer ${TOKEN}" "http://127.0.0.1:${PORT_TEST}/api/v1/settings")
if [[ "$SETTINGS" == "200" ]]; then
  pass "GET /api/v1/settings -> 200 (was 403 / 42501)"
else
  fail "GET /api/v1/settings -> ${SETTINGS}: $(cat /tmp/verify-settings.json)"
fi

if grep -q 'master_password_hash' /tmp/verify-settings.json; then
  fail "the settings response contains master_password_hash"
else
  pass "the settings response does not contain master_password_hash"
fi

step "any 42501 in the API log?"
if grep -q '42501' /tmp/verify-api.log; then
  fail "42501 appears in the log:"; grep -n '42501' /tmp/verify-api.log | head
else
  pass "no 42501 anywhere in the API log"
fi

kill $API_PID 2>/dev/null
trap cleanup EXIT

# -----------------------------------------------------------------------------
say "RESULT"
# -----------------------------------------------------------------------------
if [[ "$FAILED" == "0" ]]; then
  printf '\n  \033[32mAll checks passed.\033[0m A clean database, an ordinary role, no elevation.\n\n'
else
  printf '\n  \033[31mSomething failed — see the FAIL lines above.\033[0m\n\n'
fi
exit "$FAILED"
