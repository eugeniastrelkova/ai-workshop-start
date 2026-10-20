// The decisions in spec/analysis.md and spec/cli.md, checked on what the real command prints for
// ./fixture and for a small GitHub repository answered in tests/helpers.ts. The edge cases of
// where skills live are yours to add.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { openGitHub } from '../src/core/github.ts';
import { parseSkill } from '../src/core/parse.ts';
import { replay } from '../src/core/replay.ts';
import { atlas, CLI, EXAMPLE_COMMIT, FIXTURE, github, KOTLIN_COMMIT, opener } from './helpers.ts';

const fixture = await atlas(['scan', FIXTURE]);
const example = await atlas(['scan', 'github.com/JetBrains/example']);

test('malformed front matter → the directory name, no description and a warning', () => {
  const parsed = parseSkill(readFileSync(join(FIXTURE, '.agents/skills/release-checklist/SKILL.md'), 'utf8'));
  assert.equal(parsed.name, undefined);
  assert.equal(parsed.description, '');
  assert.equal(
    parsed.warning,
    'malformed front matter: Nested mappings are not allowed in compact mappings at line 3, column 14; using the directory name',
  );
});

test('scan prints the repository, then each skill with its first sentence and pinned link', () => {
  assert.equal(example.code, 0, example.stderr);
  assert.equal(
    example.stdout,
    [
      'JetBrains/example · 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
});

test('./fixture: every skill, sorted by name, linked to its file, copies merged, with a warning for the malformed one', () => {
  const root = pathToFileURL(FIXTURE).href;
  assert.equal(fixture.code, 0);
  assert.equal(
    fixture.stdout,
    [
      'fixture · 4 skills',
      "code-style — Follow the project's code style.",
      `  ${root}/.github/skills/code-style/SKILL.md`,
      'commits — Write commit messages the way this repository does.',
      `  ${root}/.agents/skills/commits/SKILL.md`,
      '  also in .claude/skills/commits/SKILL.md',
      'commits — Write commit messages for the Kotlin plugin.',
      `  ${root}/plugins/kotlin/.claude/skills/commits/SKILL.md`,
      'release-checklist',
      `  ${root}/.agents/skills/release-checklist/SKILL.md`,
    ].join('\n'),
  );
  assert.match(fixture.stderr, /^warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('the CLI prints the result at once and stores nothing', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const scanned = spawnSync(process.execPath, [CLI, 'scan', FIXTURE], { cwd, encoding: 'utf8' });
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.equal(scanned.stdout, `${fixture.stdout}\n`);
  assert.deepEqual(readdirSync(cwd), []);
});

test('unreachable repository → a clear message, exit code 1', async () => {
  const missing = spawnSync(process.execPath, [CLI, 'scan', join(FIXTURE, 'no-such-directory')], { encoding: 'utf8' });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /^Not a GitHub URL or a readable directory: .*no-such-directory\n$/);

  // What GitHub answers for a repository that does not exist.
  const notFound = replay({ 'https://api.github.com/repos/JetBrains/no-such-repository': { status: 404, body: { message: 'Not Found' } } });
  await assert.rejects(openGitHub('https://github.com/JetBrains/no-such-repository', { fetch: notFound }), {
    message: 'Repository not found: https://github.com/JetBrains/no-such-repository',
  });

  const offline = await atlas(['scan', 'https://github.com/JetBrains/not-answered']);
  assert.equal(offline.code, 1);
  assert.match(offline.stderr, /^Cannot reach GitHub: not recorded: https:\/\/api\.github\.com\/repos\/JetBrains\/not-answered$/);
});

test('rate limit → a message that asks for GITHUB_TOKEN', async () => {
  const limited = replay({
    'https://api.github.com/repos/JetBrains/MPS': {
      status: 403,
      body: { message: 'API rate limit exceeded for 192.0.2.1. (But here is the good news: ...)' },
    },
  });
  await assert.rejects(openGitHub('https://github.com/JetBrains/MPS', { fetch: limited }), {
    message: 'GitHub rate limit reached; set GITHUB_TOKEN',
  });
});

test('an organization: each repository with skills, sorted, after a blank line; warnings name the repository', async () => {
  const organization = await atlas(['scan', 'https://github.com/JetBrains']);
  assert.equal(organization.code, 0, organization.stderr);
  assert.equal(
    organization.stdout,
    [
      'JetBrains · 2 skills in 2 repositories',
      '',
      'JetBrains/example · 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
      '',
      'JetBrains/kotlin · 1 skill',
      'build',
      `  https://github.com/JetBrains/kotlin/blob/${KOTLIN_COMMIT}/.agents/skills/build/SKILL.md`,
    ].join('\n'),
  );
  // JetBrains/docs has no project skill: it is not opened, nor listed.
  assert.equal(
    organization.stderr,
    [
      'warning: JetBrains/gone: Repository not found: https://github.com/JetBrains/gone; skipped',
      'warning: JetBrains/kotlin: .agents/skills/build/SKILL.md: no front matter; using the directory name',
    ].join('\n'),
  );
});

test('an organization without GITHUB_TOKEN: its repositories listed, forks and empty ones skipped', async () => {
  // JetBrains/forked and JetBrains/empty are not recorded: opening either would be a warning.
  const organization = await atlas(['scan', 'github.com/JetBrains/'], { open: opener({ fetch: github }) });
  assert.equal(organization.code, 0, organization.stderr);
  assert.equal(
    organization.stdout,
    [
      'JetBrains · 1 skill in 1 repository',
      '',
      'JetBrains/example · 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
  assert.equal(organization.stderr, '');
});

test('an organization with more than 1000 files for the code search → the first 1000 and a warning', async () => {
  const pages = Object.fromEntries(
    Array.from({ length: 10 }, (_, page) => [
      `https://api.github.com/search/code?q=filename:SKILL.md+user:big&per_page=100&page=${page + 1}`,
      {
        status: 200,
        body: { total_count: 1234, items: Array.from({ length: 100 }, (_, i) => ({ path: `docs/${page * 100 + i}/SKILL.md`, repository: { full_name: 'big/docs' } })) },
      },
    ]),
  );
  const big = replay({ 'https://api.github.com/users/big': { status: 200, body: { login: 'big', type: 'User' } }, ...pages });
  const organization = await atlas(['scan', 'https://github.com/big'], { open: opener({ fetch: big, token: 'test' }) });
  assert.equal(organization.code, 0, organization.stderr);
  assert.equal(organization.stdout, 'big · 0 skills in 0 repositories');
  assert.equal(organization.stderr, 'warning: code search lists at most 1000 SKILL.md files; 234 more not looked at');
});

test('an organization: the rate limit ends the scan, exit code 1', async () => {
  const limited = replay(
    { 'https://api.github.com/repos/JetBrains/kotlin': { status: 403, body: { message: 'API rate limit exceeded for user ID 1.' } } },
    github,
  );
  const organization = await atlas(['scan', 'https://github.com/JetBrains'], { open: opener({ fetch: limited, token: 'test' }) });
  assert.equal(organization.code, 1);
  assert.equal(organization.stdout, '');
  assert.equal(organization.stderr, 'GitHub rate limit reached; try again in a minute');
});

test('unknown organization → a clear message, exit code 1', async () => {
  const notFound = replay({ 'https://api.github.com/users/no-such-owner': { status: 404, body: { message: 'Not Found' } } });
  const missing = await atlas(['scan', 'https://github.com/no-such-owner'], { open: opener({ fetch: notFound }) });
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, '');
  assert.equal(missing.stderr, 'Organization or user not found: https://github.com/no-such-owner');
});
