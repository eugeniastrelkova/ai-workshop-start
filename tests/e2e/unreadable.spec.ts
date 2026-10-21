// A directory that cannot be read, in a local repository (spec/analysis.md, Listing): its skills on the page,
// the directory as a warning under them, not the whole repository refused.
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { expect, test } from './demo.ts';

const repo = 'test-results/repos/unreadable-dir';

test.beforeAll(() => {
  rmSync(repo, { recursive: true, force: true });
  mkdirSync(`${repo}/.claude/skills/commits`, { recursive: true });
  writeFileSync(`${repo}/.claude/skills/commits/SKILL.md`, '---\nname: commits\ndescription: Writes commit messages.\n---\n');
  mkdirSync(`${repo}/build/private`, { recursive: true });
  chmodSync(`${repo}/build/private`, 0o000); // a build output, a mounted volume: not ours to read
});

test.afterAll(() => chmodSync(`${repo}/build/private`, 0o755));

test('unreadable directory', async ({ page, demo }) => {
  await page.goto('/');
  await demo.caption('A repository with 1 skill, and one folder no one may read: build/private');
  await demo.pause();
  await demo.type('input[name=repo]', `./${repo}`);
  await Promise.all([page.waitForEvent('load'), page.keyboard.press('Enter')]);
  await expect(page.locator('h2').first()).toHaveText('unreadable-dir · 1 skill');
  await expect(page.locator('summary b')).toHaveText(['commits']);
  await expect(page.locator('.warnings li')).toHaveText(['warning: build/private: cannot be read; skipped']);
  await demo.caption('Its skill on the page; the folder, a warning under it');
  await demo.screenshot('skill-and-warning');
  await demo.pause(2500);
});
