// Any other path, `//` too, on the page (spec/web.md): status 404, and the server stays up for the next page.
import { expect, test } from './demo.ts';

test('double slash not found', async ({ page, demo, baseURL }) => {
  await page.goto('/?repo=./fixture');
  await expect(page.locator('h2').first()).toHaveText('fixture · 4 skills');
  await demo.caption('The web view works: ./fixture, 4 skills. Now open the path "//"');
  await demo.pause(2500);

  const response = await page.goto(`${baseURL}//`);
  expect(response?.status()).toBe(404);
  await expect(page.locator('p.error')).toHaveText('Not found');
  await demo.caption('"//": status 404, Not found, as for any other path');
  await demo.pause(2500);

  await page.goto('/?repo=./fixture');
  await expect(page.locator('h2').first()).toHaveText('fixture · 4 skills');
  await demo.caption('The server is still up: ./fixture, 4 skills');
  await demo.pause(2500);
});
