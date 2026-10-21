#!/usr/bin/env bash
# Air cloud startup: installs dependencies for Skill Atlas (a Node CLI) and the Chromium the UI e2e tests
# drive. The web view (`serve`) binds 127.0.0.1 only, so there is no server to expose here.
# WARMUP runs (snapshot baking / env-setup verification) also run the healthcheck below.
set -euo pipefail

if [ "${AIR_STARTUP_MODE:-}" = warmup ]; then WARMUP=1; else WARMUP=; fi

cd "$(dirname "$0")/../.."

# The image ships Node via nvm under /usr/local/nvm; load it if node is not on PATH yet.
if ! command -v node >/dev/null 2>&1 && [ -s /usr/local/nvm/nvm.sh ]; then
  # shellcheck disable=SC1091
  . /usr/local/nvm/nvm.sh
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" -lt 24 ]; then
  echo "startup: Node >= 24 required (package.json engines), found $(node -v)" >&2
  exit 1
fi
echo "startup: using node $(node -v), npm $(npm -v)"

chmod +x ./skill-atlas

echo "startup: npm ci ..."
npm ci --no-audit --no-fund
echo "startup: npm ci done"

# `npm run e2e` (AGENTS.md definition of done) needs Playwright's Chromium; cached in ~/.cache/ms-playwright.
echo "startup: playwright install chromium ..."
npx playwright install chromium
echo "startup: playwright install done"

# Mirrors CI (.github/workflows): typecheck, tests, and the real CLI on the fixture.
healthcheck() {
  echo "healthcheck: typecheck"
  npm run typecheck
  echo "healthcheck: tests"
  npm test
  echo "healthcheck: CLI smoke"
  ./skill-atlas help
  ./skill-atlas scan ./fixture
  echo "healthcheck: web view smoke"
  ./skill-atlas serve --port 4321 &
  local pid=$!
  until curl -fs -o /dev/null http://127.0.0.1:4321/; do
    kill -0 "$pid" 2>/dev/null || { echo "healthcheck: serve exited before answering" >&2; return 1; }
    echo "healthcheck: waiting for the web view on :4321"; sleep 1
  done
  local ok=0
  curl -fsS 'http://127.0.0.1:4321/?repo=./fixture' | grep -F 'fixture</a> · 4 skills' || ok=1
  kill "$pid"
  [ "$ok" -eq 0 ] || { echo "healthcheck: web view did not list the fixture skills" >&2; return 1; }
  echo "healthcheck: Chromium launches"
  node -e "import('@playwright/test').then(async ({ chromium }) => { const b = await chromium.launch(); await b.close(); console.log('chromium ok'); })"
  echo "healthcheck: OK"
}

if [ -n "${WARMUP:-}" ]; then healthcheck; fi
