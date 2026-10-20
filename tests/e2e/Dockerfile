# The one machine the UI e2e tests run on, in the cloud and on CI: its fonts and its Chromium draw the
# screenshot baselines (tests/e2e/screenshots/), so both sides draw the same pixels. Built by scripts/e2e.sh.
FROM node:24-bookworm-slim AS node
FROM ubuntu:24.04
COPY --from=node /usr/local/bin/node /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
# The versions of node_modules/playwright-core/browsers.json, passed by scripts/e2e.sh.
ARG PLAYWRIGHT_VERSION
ARG CHROMIUM_REVISION
ARG CHROMIUM_VERSION
ARG FFMPEG_REVISION
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Chromium's libraries and fonts, from Playwright; Chromium itself straight from Chrome for Testing,
# which Playwright's CDN mirrors (the CDN is not reachable from every cloud); for the videos, Ubuntu's ffmpeg.
RUN npx -y playwright@${PLAYWRIGHT_VERSION} install-deps chromium \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates ffmpeg \
 && cft=https://storage.googleapis.com/chrome-for-testing-public/${CHROMIUM_VERSION}/linux64 \
 && for b in chromium:chrome-linux64 chromium_headless_shell:chrome-headless-shell-linux64; do \
      dir=/ms-playwright/${b%%:*}-${CHROMIUM_REVISION}; mkdir -p $dir; \
      curl -fsSL -o /tmp/b.zip $cft/${b#*:}.zip && unzip -q /tmp/b.zip -d $dir && rm /tmp/b.zip; \
      touch $dir/INSTALLATION_COMPLETE $dir/DEPENDENCIES_VALIDATED; \
    done \
 && mkdir /ms-playwright/ffmpeg-${FFMPEG_REVISION} && ln -s /usr/bin/ffmpeg /ms-playwright/ffmpeg-${FFMPEG_REVISION}/ffmpeg-linux \
 && touch /ms-playwright/ffmpeg-${FFMPEG_REVISION}/INSTALLATION_COMPLETE \
 && chmod -R a+rX /ms-playwright && rm -rf /var/lib/apt/lists/* /root/.npm
