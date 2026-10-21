# The one machine the UI e2e tests run on, in the cloud and on CI: its fonts and its Chromium draw the
# screenshot baselines (tests/e2e/screenshots/), so both sides draw the same pixels. Built by scripts/e2e.sh.
# Both bases pinned by digest: a rebuild gives the same image until someone changes it on purpose.
FROM node:24-bookworm-slim@sha256:91acba91b842bec0bf7ea6f5e09c644c7ccad72c4996ed9616d861d1c7cd60d4 AS node
FROM ubuntu:24.04@sha256:68ee22004a9109b44973313b02ff7b1de250f1de0f5ecb628d73f579aaff33ac
COPY --from=node /usr/local/bin/node /usr/local/bin/
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
# The versions of node_modules/playwright-core/browsers.json, passed by scripts/e2e.sh.
ARG PLAYWRIGHT_VERSION
ARG CHROMIUM_REVISION
ARG CHROMIUM_VERSION
ARG FFMPEG_REVISION
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
# Every package from one Ubuntu snapshot, the fonts and fontconfig that draw the pixels included: a
# rebuild installs the same ones until someone moves the date. The snapshot is HTTPS only, so the
# certificates come first, from the live archive.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates \
 && echo 'APT::Snapshot "20261021T000000Z";' > /etc/apt/apt.conf.d/50snapshot
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
