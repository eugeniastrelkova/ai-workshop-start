// Records a demo video: a real terminal (ttyd) and the web view, driven by Playwright, one case after
// another on one page. `node scripts/demo.ts <case>... --out docs/demo/<name>.webm`.
// A case is a JSON list of steps, in .agents/skills/demo-video/cases/<case>.json; see the skill there.
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright';

/** The page's document, in the functions that run there. */
declare const document: any;

type Step =
  | { type: string }
  | { wait: string; timeout?: number }
  | { pause: number }
  | { open: string }
  | { fill: string; text: string }
  | { press: string }
  | { click: string }
  | { caption: string };

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CASES = resolve(ROOT, '.agents/skills/demo-video/cases');
const TERMINAL = 'http://127.0.0.1:7681/';
const WEB = 'http://127.0.0.1:4321/';
const SIZE = { width: 1280, height: 720 };

const args = process.argv.slice(2);
const at = args.indexOf('--out');
const out = resolve(at >= 0 ? args.splice(at, 2)[1] ?? '' : 'docs/demo/demo.webm');
if (!args.length) {
  console.error('usage: node scripts/demo.ts <case>... [--out docs/demo/<name>.webm]');
  process.exit(2);
}
const cases = await Promise.all(
  args.map(async (name) => {
    const file = name.endsWith('.json') ? resolve(name) : resolve(CASES, `${name}.json`);
    return { name, steps: JSON.parse(await readFile(file, 'utf8')) as Step[] };
  }),
);

const servers = [
  // A plain bash with a short prompt; the DOM renderer, so the page can wait for text on screen.
  start('ttyd', [
    '-W', '-p', '7681', '-i', '127.0.0.1',
    '-t', 'rendererType=dom', '-t', 'fontSize=20', '-t', 'disableLeaveAlert=true',
    '-t', 'theme={"background":"#1e1e1e","foreground":"#e6e6e6"}',
    'env', 'PS1=\\[\\e[32m\\]$\\[\\e[0m\\] ', 'bash', '--norc', '-i',
  ]),
  start('./skill-atlas', ['serve', '--port', '4321']),
];
let failed = false;
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: dirname(out) + '/.recording', size: SIZE } });
const page = await context.newPage();
try {
  await Promise.all([up(TERMINAL), up(WEB)]);
  let caption = '';
  // What the screen said before the last action: a `wait` looks for text that appeared after it.
  let before = '';
  for (const { name, steps } of cases) {
    for (const step of steps) {
      const action = !('wait' in step || 'pause' in step || 'caption' in step);
      if (action) before = await text(page);
      if ('type' in step) {
        // Each command starts on a clear screen, so a `wait` sees only what it printed.
        await page.locator('.xterm-helper-textarea').focus();
        await page.keyboard.press('Control+L');
        await page.waitForTimeout(300);
        before = await text(page);
        await page.keyboard.type(step.type, { delay: 45 });
        await page.waitForTimeout(300);
        await page.keyboard.press('Enter');
      } else if ('wait' in step) {
        await settled(() => page
          .waitForFunction(
            ([expected, earlier]) => {
              const caption = document.getElementById('demo-caption')?.textContent ?? '';
              const now = document.body.innerText.replace(caption, '');
              return now.split(expected).length > earlier.split(expected).length;
            },
            [step.wait, before],
            { timeout: step.timeout ?? 30_000, polling: 100 },
          ))
          .catch(() => {
            throw new Error(`${name}: "${step.wait}" never appeared`);
          });
      } else if ('pause' in step) {
        await page.waitForTimeout(step.pause);
      } else if ('open' in step) {
        await page.goto(step.open.replace(/^terminal:/, TERMINAL).replace(/^web:/, WEB));
        if (page.url().startsWith(TERMINAL)) await page.locator('.xterm-rows').waitFor();
      } else if ('fill' in step) {
        await page.locator(step.fill).click();
        await page.keyboard.type(step.text, { delay: 45 });
      } else if ('click' in step) {
        await page.locator(step.click).first().click();
      } else if ('press' in step) {
        await page.keyboard.press(step.press);
        await page.waitForLoadState();
      } else {
        caption = step.caption;
      }
      if (action || 'caption' in step) await show(page, caption);
    }
  }
  await page.waitForTimeout(1500);
} catch (error) {
  failed = true;
  console.error(error instanceof Error ? error.message : error);
  // What the screen showed when it failed, beside where the video would have been.
  const shot = out.replace(/\.webm$/, '') + '.failed.png';
  await mkdir(dirname(out), { recursive: true });
  await page.screenshot({ path: shot }).then(() => console.error(`the screen: ${shot}`), () => {});
}
await context.close();
const video = page.video();
if (failed) await video?.delete();
else {
  await mkdir(dirname(out), { recursive: true });
  await video?.saveAs(out);
  console.log(out);
}
await rm(dirname(out) + '/.recording', { recursive: true, force: true });
await browser.close();
for (const server of servers) server.kill();
process.exitCode = failed ? 1 : 0;

function start(command: string, argv: string[]): ChildProcess {
  return spawn(command, argv, { cwd: ROOT, stdio: 'ignore', env: { ...process.env, NODE_USE_ENV_PROXY: '1' } });
}

async function up(url: string) {
  for (let i = 0; i < 100; i++) {
    if (await fetch(url).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`${url} did not start`);
}

/** The text on screen, without the caption. */
function text(page: Page): Promise<string> {
  return settled(() => page.evaluate(() =>
    document.body.innerText.replace(document.getElementById('demo-caption')?.textContent ?? '', ''),
  ));
}

/** Runs `f` in the page, again once a navigation that started under it (a submitted form) has loaded. */
async function settled<T>(f: () => Promise<T>): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await f();
    } catch (error) {
      if (i > 5 || !String(error).includes('Execution context was destroyed')) throw error;
      await page.waitForLoadState();
    }
  }
}

/** A one-line caption at the bottom of the frame; redrawn after each navigation. */
async function show(page: Page, caption: string) {
  await settled(() => page.evaluate((caption) => {
    let bar = document.getElementById('demo-caption');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-caption';
      bar.style.cssText =
        'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:10px 20px;font:600 20px system-ui,sans-serif;' +
        'background:#0b5cad;color:#fff;pointer-events:none';
      document.body.append(bar);
    }
    bar.textContent = caption;
    bar.style.display = caption ? 'block' : 'none';
  }, caption));
}
