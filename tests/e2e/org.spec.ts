// An organization, on the page (spec/web.md): each of its repositories with skills, then filtered.
// Real GitHub, asked anonymously: JetBrains can run out of the 60 requests an hour.
import { expect, test } from './demo.ts';

test('organization scan', async ({ page, demo }) => {
  // On CI, the 60 requests an hour are shared with every other job on the runner's address.
  test.skip(!!process.env.CI, 'real GitHub, asked anonymously: not on CI');
  await page.goto('/');
  await demo.caption('Organization scan: every repository of JetBrains with a skill');
  await demo.type('input[name=repo]', 'https://github.com/JetBrains');
  await page.keyboard.press('Enter');
  // A failed scan shows its message instead of a heading: fail on it, saying why.
  await page.locator('h2, p.error').first().waitFor({ timeout: 60_000 });
  expect(await page.locator('p.error').allTextContents()).toEqual([]);
  // The counts move with JetBrains; the shape does not.
  await expect(page.locator('h2').first()).toHaveText(/^JetBrains · \d+ skills in \d+ repositories$/, { timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'JetBrains/kotlin', exact: true })).toBeVisible();
  await demo.pause();
  await page.mouse.wheel(0, 900);
  await demo.pause();

  await demo.caption('The same organization, filtered by "kotlin": only the repositories with a match');
  await demo.type('input[name=words]', 'kotlin');
  await page.keyboard.press('Enter');
  await expect(page.locator('h2').first()).toHaveText(/^JetBrains · \d+ of \d+ skills in \d+ repositor(y|ies)$/, { timeout: 60_000 });
  await demo.pause(3000);
});
