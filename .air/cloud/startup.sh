#!/usr/bin/env bash
# Air cloud startup: installs dependencies for Skill Atlas (a Node CLI, no server to start).
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

# Mirrors CI (.github/workflows): typecheck, tests, and the real CLI on the fixture.
healthcheck() {
  echo "healthcheck: typecheck"
  npm run typecheck
  echo "healthcheck: tests"
  npm test
  echo "healthcheck: CLI smoke"
  ./skill-atlas help
  ./skill-atlas scan ./fixture
  echo "healthcheck: OK"
}

if [ -n "${WARMUP:-}" ]; then healthcheck; fi
