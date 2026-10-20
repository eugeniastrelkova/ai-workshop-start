// Filter by words, on the page (spec/web.md): the words field keeps the skills of scan <repo> <word>...
import { expect, test } from './demo.ts';

test('filter by words', async ({ page, demo }) => {
  await page.goto('/');
  await demo.caption('Every skill of ./fixture: the web view, ./skill-atlas serve');
  await demo.type('input[name=repo]', './fixture');
  await page.keyboard.press('Enter');
  await expect(page.locator('h2').first()).toHaveText('fixture · 4 skills');
  await demo.pause();

  await demo.caption('Only the skills whose name or description contains "commit"');
  await demo.type('input[name=words]', 'commit');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/?repo=.%2Ffixture&words=commit');
  await expect(page.locator('h2').first()).toHaveText('fixture · 3 of 4 skills');
  await demo.pause();

  await demo.caption('Every word must match: "commit kotlin"');
  await demo.type('input[name=words]', ' kotlin');
  await page.keyboard.press('Enter');
  await expect(page.locator('h2').first()).toHaveText('fixture · 2 of 4 skills');
  await expect(page.locator('summary b')).toHaveText(['code-style', 'commits']);
  await demo.pause();

  await demo.caption('Each skill unfolds into its whole SKILL.md');
  await page.locator('summary').first().click();
  await expect(page.locator('details').first().locator('pre')).toContainText('name: code-style');
  await demo.pause(2500);
});
