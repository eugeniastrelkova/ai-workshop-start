// Malformed front matter on the page (spec/analysis.md, spec/web.md): a YAML alias without its anchor, or an
// alias bomb, is a warning under the skills; the other skills stay.
import { rmSync } from 'node:fs';
import { writeAliased } from '../helpers.ts';
import { expect, test } from './demo.ts';

const repo = 'test-results/repos/front-matter-alias';

test.beforeAll(() => {
  rmSync(repo, { recursive: true, force: true });
  writeAliased(repo);
});

test('malformed front matter', async ({ page, demo }) => {
  await page.goto('/');
  await demo.caption('3 skills; "aliased" has "name: *nothere", "bomb" an alias bomb in its front matter');
  await demo.type('input[name=repo]', `./${repo}`);
  await page.keyboard.press('Enter');
  await expect(page.locator('h2').first()).toHaveText('front-matter-alias · 3 skills');
  await expect(page.locator('summary b')).toHaveText(['aliased', 'bomb', 'commits']);
  await expect(page.locator('ul.warnings li')).toHaveText([
    'warning: .claude/skills/aliased/SKILL.md: malformed front matter: Unresolved alias (the anchor must be set before the alias): nothere; using the directory name',
    'warning: .claude/skills/bomb/SKILL.md: malformed front matter: Excessive alias count indicates a resource exhaustion attack; using the directory name',
  ]);
  await demo.caption('Each one named after its directory, a warning under the skills; the scan goes on');
  await demo.screenshot('front-matter-alias');
  await demo.pause(2500);
});
