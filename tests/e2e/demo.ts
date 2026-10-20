// The UI e2e tests, written to be watched: typing at a reading pace, a caption saying what is shown,
// and, with DEMO=<directory>, each test's video kept there as <name>.webm.
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test as base, type Page } from '@playwright/test';

/** The page's document, in the functions that run there. */
declare const document: any;

export { expect } from '@playwright/test';

export const test = base.extend<{ demo: Demo }>({
  demo: async ({ page }, use, info) => {
    // The caption survives a navigation (a submitted form): it is kept in sessionStorage and painted again.
    await page.addInitScript(`
      document.addEventListener('DOMContentLoaded', () => (${paint})(sessionStorage.getItem('demo-caption') ?? ''));
    `);
    await use(new Demo(page));
    const dir = process.env.DEMO;
    // The video is complete once the page is closed; a failed test keeps none.
    if (!dir || info.status !== info.expectedStatus) return;
    await page.close();
    await mkdir(dir, { recursive: true });
    const name = info.titlePath.at(-1)!.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    await page.video()?.saveAs(resolve(dir, `${name}.webm`));
  },
});

class Demo {
  page: Page;
  constructor(page: Page) {
    this.page = page;
  }

  /** A caption bar at the bottom from here on, through navigations; '' hides it. */
  async caption(text: string) {
    await this.page.evaluate((text) => {
      (globalThis as any).sessionStorage.setItem('demo-caption', text);
    }, text);
    await this.page.evaluate(paint, text);
  }

  /** Types at the end of a field, key by key, as a user would. */
  async type(selector: string, text: string) {
    await this.page.locator(selector).click();
    await this.page.keyboard.press('End');
    await this.page.keyboard.type(text, { delay: 45 });
  }

  /** Time to read what is on screen. */
  pause(ms = 1500) {
    return this.page.waitForTimeout(ms);
  }
}

function paint(text: string) {
  let bar = document.getElementById('demo-caption');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'demo-caption';
    bar.style.cssText =
      'position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:10px 20px;font:600 20px system-ui,sans-serif;' +
      'background:#0b5cad;color:#fff;pointer-events:none';
    document.body.append(bar);
  }
  bar.textContent = text;
  bar.style.display = text ? 'block' : 'none';
}
