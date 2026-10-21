// An organization, on the page (spec/web.md): each of its repositories with skills, then filtered.
// Real GitHub, asked anonymously: cvoya-com, 4 public repositories, 2 with skills, takes about 10 of the
// 60 requests an hour (JetBrains, with hundreds, would need more than the hour has).
import { expect, test } from './demo.ts';

test('organization scan', async ({ page, demo }) => {
  // On CI, the 60 requests an hour are shared with every other job on the runner's address.
  test.skip(!!process.env.CI, 'real GitHub, asked anonymously: not on CI');
  await page.goto('/');
  await demo.caption('Organization scan: every repository of cvoya-com with a skill');
  await demo.type('input[name=repo]', 'https://github.com/cvoya-com');
  await page.keyboard.press('Enter');
  // A failed scan shows its message instead of a heading: fail on it, saying why.
  await page.locator('h2, p.error').first().waitFor({ timeout: 60_000 });
  expect(await page.locator('p.error').allTextContents()).toEqual([]);
  // The counts move with cvoya-com; the shape does not.
  await expect(page.locator('h2').first()).toHaveText(/^cvoya-com · \d+ skills in \d+ repositories$/, { timeout: 60_000 });
  await expect(page.getByRole('link', { name: 'cvoya-com/spring-voyage', exact: true })).toBeVisible();
  await demo.pause();
  await page.mouse.wheel(0, 900);
  await demo.pause();

  await demo.caption('The same organization, filtered by "triage": only the repositories with a match');
  await demo.type('input[name=words]', 'triage');
  await page.keyboard.press('Enter');
  await expect(page.locator('h2').first()).toHaveText(/^cvoya-com · \d+ of \d+ skills in \d+ repositor(y|ies)$/, { timeout: 60_000 });
  await demo.pause(3000);
});
