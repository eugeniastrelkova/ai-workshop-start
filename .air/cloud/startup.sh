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

# Chromium's shared libraries and a font, without root (sudo is unavailable): the packages it needs that the
# image lacks are downloaded with a private apt state and extracted under $CHROMIUM_LIBS, then found through
# LD_LIBRARY_PATH and FONTCONFIG_FILE. Without fonts, Chromium's renderer aborts in fontconfig.
CHROMIUM_LIBS="$HOME/.local/chromium-libs"
APT_DIR="$HOME/.cache/air-apt"
CHROMIUM_PKGS="libnspr4 libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libdbus-1-3 libx11-6 libxcomposite1 libxdamage1
  libxext6 libxfixes3 libxrandr2 libgbm1 libxcb1 libxkbcommon0 libasound2t64 libatspi2.0-0t64 libcairo2
  libpango-1.0-0 libcups2t64 fonts-liberation"
if [ ! -f "$CHROMIUM_LIBS/.complete" ]; then
  echo "startup: fetching Chromium's libraries into $CHROMIUM_LIBS ..."
  rm -rf "$CHROMIUM_LIBS" "$APT_DIR/debs"
  mkdir -p "$CHROMIUM_LIBS" "$APT_DIR/lists/partial" "$APT_DIR/archives/partial" "$APT_DIR/debs"
  apt_opts=(-o "Dir::State::Lists=$APT_DIR/lists" -o "Dir::Cache=$APT_DIR" -o Debug::NoLocking=1)
  apt-get "${apt_opts[@]}" -q update
  # shellcheck disable=SC2086
  closure="$(apt-cache "${apt_opts[@]}" depends --recurse --no-recommends --no-suggests --no-conflicts \
    --no-breaks --no-replaces --no-enhances $CHROMIUM_PKGS | grep -v '^[ <]' | sort -u)"
  missing=()
  for pkg in $closure; do
    dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q 'install ok installed' || missing+=("$pkg")
  done
  echo "startup: downloading ${#missing[@]} packages"
  (cd "$APT_DIR/debs" && apt-get "${apt_opts[@]}" -q download "${missing[@]}")
  for deb in "$APT_DIR"/debs/*.deb; do dpkg-deb -x "$deb" "$CHROMIUM_LIBS"; done
  rm -rf "$APT_DIR/debs"
  cat > "$CHROMIUM_LIBS/fonts.conf" <<EOF
<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <dir>$CHROMIUM_LIBS/usr/share/fonts</dir>
  <dir>/usr/share/fonts</dir>
  <cachedir>$HOME/.cache/fontconfig</cachedir>
  <include ignore_missing="yes">$CHROMIUM_LIBS/etc/fonts/conf.d</include>
</fontconfig>
EOF
  touch "$CHROMIUM_LIBS/.complete"
  echo "startup: Chromium's libraries ready"
fi

# The agent's shells get these through a login-shell hook (this script's exports die with it).
ENV_FILE="$HOME/.skill-atlas-env.sh"
cat > "$ENV_FILE" <<EOF
# Written by .air/cloud/startup.sh: Chromium's userspace libraries and fonts, for npm run e2e.
export LD_LIBRARY_PATH="$CHROMIUM_LIBS/usr/lib/x86_64-linux-gnu:$CHROMIUM_LIBS/lib/x86_64-linux-gnu\${LD_LIBRARY_PATH:+:\$LD_LIBRARY_PATH}"
export FONTCONFIG_FILE="$CHROMIUM_LIBS/fonts.conf"
EOF
source_line="[ -f \"$ENV_FILE\" ] && . \"$ENV_FILE\" # skill-atlas-env"
profile=""
for f in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
  if [ -f "$f" ]; then profile="$f"; break; fi
done
[ -n "$profile" ] || profile="$HOME/.profile"
for f in "$profile" "$HOME/.bashrc"; do
  grep -qF '# skill-atlas-env' "$f" 2>/dev/null || echo "$source_line" >> "$f"
done
# shellcheck disable=SC1090
. "$ENV_FILE"

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
  # The UI e2e test on ./fixture (org.spec.ts asks real GitHub anonymously and needs more than its 60 requests).
  echo "healthcheck: UI e2e on ./fixture"
  npx playwright test filter.spec.ts
  echo "healthcheck: OK"
}

if [ -n "${WARMUP:-}" ]; then healthcheck; fi
