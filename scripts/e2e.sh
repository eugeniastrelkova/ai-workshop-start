#!/bin/sh
# npm run e2e [-- <playwright test options>]: the UI e2e tests, in the image of tests/e2e/Dockerfile,
# so that the screenshots match the baselines wherever they run (the cloud, CI). Needs Docker.
set -eu
cd "$(dirname "$0")/.."

# The browser versions of the installed Playwright and the hash of the Dockerfile: the image is rebuilt
# when either changes.
eval "$(node -e '
  const v = require("./node_modules/playwright-core/package.json").version;
  const browsers = require("./node_modules/playwright-core/browsers.json").browsers;
  const c = browsers.find((b) => b.name === "chromium");
  const f = browsers.find((b) => b.name === "ffmpeg");
  console.log(`PLAYWRIGHT_VERSION=${v} CHROMIUM_REVISION=${c.revision} CHROMIUM_VERSION=${c.browserVersion} FFMPEG_REVISION=${f.revision}`);
')"
export PLAYWRIGHT_VERSION CHROMIUM_REVISION CHROMIUM_VERSION FFMPEG_REVISION
image="skill-atlas-e2e:$PLAYWRIGHT_VERSION-$CHROMIUM_REVISION-$FFMPEG_REVISION-$(sha256sum tests/e2e/Dockerfile | cut -c1-12)"

if [ -z "$(docker images -q "$image")" ]; then
  echo "e2e: building $image" >&2
  # The proxy, when there is one, for apt and the downloads.
  docker build -q -t "$image" \
    --build-arg PLAYWRIGHT_VERSION --build-arg CHROMIUM_REVISION --build-arg CHROMIUM_VERSION --build-arg FFMPEG_REVISION \
    --build-arg HTTPS_PROXY --build-arg HTTP_PROXY --build-arg NO_PROXY \
    --build-arg https_proxy --build-arg http_proxy --build-arg no_proxy \
    tests/e2e >&2
fi

tty=; [ -t 1 ] && tty=-t
# The checkout always at /skill-atlas: a local repository's links are absolute paths, on the page.
exec docker run --rm $tty --init --ipc=host --network host -u "$(id -u):$(id -g)" -e HOME=/tmp \
  -v "$PWD:/skill-atlas" -w /skill-atlas \
  -e NPM_CONFIG_UPDATE_NOTIFIER=false -e CI -e DEMO -e HTTPS_PROXY -e HTTP_PROXY -e NO_PROXY -e https_proxy -e http_proxy -e no_proxy \
  "$image" npx playwright test "$@"
