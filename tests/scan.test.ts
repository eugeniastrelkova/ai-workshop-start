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
import { openGitHub, type Fetch } from '../src/core/github.ts';
import { parseSkill } from '../src/core/parse.ts';
import { replay } from '../src/core/replay.ts';
import { atlas, CLI, EXAMPLE_COMMIT, FIXTURE, github, KOTLIN_COMMIT, opener, writeAliased } from './helpers.ts';

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

test('a YAML alias without its anchor, or too many aliases → malformed front matter: the directory name and a warning', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  writeAliased(directory);
  const root = pathToFileURL(directory).href;
  const scanned = spawnSync(process.execPath, [CLI, 'scan', directory], { encoding: 'utf8' });
  assert.equal(scanned.status, 0, scanned.stderr);
  assert.equal(
    scanned.stdout,
    [
      `${directory.split('/').at(-1)} · 3 skills`,
      'aliased',
      `  ${root}/.claude/skills/aliased/SKILL.md`,
      'bomb',
      `  ${root}/.claude/skills/bomb/SKILL.md`,
      'commits — Writes commit messages.',
      `  ${root}/.claude/skills/commits/SKILL.md`,
      '',
    ].join('\n'),
  );
  assert.equal(
    scanned.stderr,
    [
      'warning: .claude/skills/aliased/SKILL.md: malformed front matter: Unresolved alias (the anchor must be set before the alias): nothere; using the directory name',
      'warning: .claude/skills/bomb/SKILL.md: malformed front matter: Excessive alias count indicates a resource exhaustion attack; using the directory name',
      '',
    ].join('\n'),
  );
});

test('words after the repository: only the skills whose name or description contains every word', async () => {
  const root = pathToFileURL(FIXTURE).href;
  // `kotlin` is in the second sentence of code-style's description, and in the plugin's skill.
  const kotlin = await atlas(['scan', FIXTURE, 'kotlin']);
  assert.equal(kotlin.code, 0, kotlin.stderr);
  assert.equal(
    kotlin.stdout,
    [
      'fixture · 2 of 4 skills',
      "code-style — Follow the project's code style.",
      `  ${root}/.github/skills/code-style/SKILL.md`,
      'commits — Write commit messages for the Kotlin plugin.',
      `  ${root}/plugins/kotlin/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );

  // Every word, anywhere, whatever the case: `COMMIT` is in `commits`, `plugin` only in one of them.
  const both = await atlas(['scan', FIXTURE, 'COMMIT', 'plugin']);
  assert.equal(
    both.stdout,
    ['fixture · 1 of 4 skills', 'commits — Write commit messages for the Kotlin plugin.', `  ${root}/plugins/kotlin/.claude/skills/commits/SKILL.md`].join('\n'),
  );

  // The name counts as well: the malformed skill has no description.
  const byName = await atlas(['scan', FIXTURE, 'checklist']);
  assert.equal(byName.stdout, ['fixture · 1 of 4 skills', 'release-checklist', `  ${root}/.agents/skills/release-checklist/SKILL.md`].join('\n'));

  // A copy stays one skill, with its `also in`.
  const copies = await atlas(['scan', FIXTURE, 'repository']);
  assert.equal(
    copies.stdout,
    [
      'fixture · 1 of 4 skills',
      'commits — Write commit messages the way this repository does.',
      `  ${root}/.agents/skills/commits/SKILL.md`,
      '  also in .claude/skills/commits/SKILL.md',
    ].join('\n'),
  );
});

test('words that match no skill → the count alone, exit code 0, the warnings still on stderr', async () => {
  const none = await atlas(['scan', FIXTURE, 'no-such-word']);
  assert.equal(none.code, 0);
  assert.equal(none.stdout, 'fixture · 0 of 4 skills');
  assert.match(none.stderr, /^warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /);
});

test('scan without a repository → the usage, exit code 1', async () => {
  const usage = await atlas(['scan']);
  assert.equal(usage.code, 1);
  assert.equal(usage.stderr, 'Usage: skill-atlas scan <GitHub URL | directory> [<word>...]');
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

/** GitHub's answer once the requests are used up: no more until 13:45 UTC. */
const RATE_LIMITED = {
  status: 403,
  body: { message: 'API rate limit exceeded for 192.0.2.1. (But here is the good news: ...)' },
  headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1792503900', 'x-ratelimit-resource': 'core' },
};

test('rate limit → when it resets', async () => {
  const limited = opener({ fetch: replay({ 'https://api.github.com/repos/JetBrains/MPS': RATE_LIMITED }) });
  const scanned = await atlas(['scan', 'https://github.com/JetBrains/MPS'], { open: limited });
  assert.equal(scanned.code, 1);
  assert.equal(scanned.stdout, '');
  assert.equal(scanned.stderr, 'GitHub rate limit reached; try again after 13:45 UTC');
});

test('rate limit, no reset in the answer → a minute', async () => {
  const secondary = replay({
    'https://api.github.com/repos/JetBrains/MPS': { status: 403, body: { message: 'You have exceeded a secondary rate limit.' } },
  });
  const scanned = await atlas(['scan', 'https://github.com/JetBrains/MPS'], { open: opener({ fetch: secondary }) });
  assert.equal(scanned.code, 1);
  assert.equal(scanned.stderr, 'GitHub rate limit reached; try again in a minute');
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
  // JetBrains/forked and JetBrains/empty are left out by listing; JetBrains/gone is listed but no longer there.
  assert.equal(
    organization.stderr,
    [
      'warning: JetBrains/gone: Repository not found: https://github.com/JetBrains/gone; skipped',
      'warning: JetBrains/kotlin: .agents/skills/build/SKILL.md: no front matter; using the directory name',
    ].join('\n'),
  );
});

test('an organization with words: only the repositories with a match, counted `N of M skills`', async () => {
  const organization = await atlas(['scan', 'https://github.com/JetBrains', 'COMMIT']);
  assert.equal(organization.code, 0, organization.stderr);
  assert.equal(
    organization.stdout,
    [
      'JetBrains · 1 of 2 skills in 1 repository',
      '',
      'JetBrains/example · 1 of 1 skill',
      'commits — Write commit messages the way this repository does.',
      `  https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`,
    ].join('\n'),
  );
  // Warnings: all of them, filtered or not.
  assert.equal(organization.stderr.split('\n').length, 2);

  const none = await atlas(['scan', 'https://github.com/JetBrains', 'no-such-word']);
  assert.equal(none.code, 0, none.stderr);
  assert.equal(none.stdout, 'JetBrains · 0 of 2 skills in 0 repositories');
});

test('an organization: the rate limit ends the scan, exit code 1', async () => {
  const limited = replay(
    { 'https://api.github.com/repos/JetBrains/kotlin/commits/master': { status: 403, body: { message: 'API rate limit exceeded for user ID 1.' } } },
    github,
  );
  const organization = await atlas(['scan', 'https://github.com/JetBrains'], { open: opener({ fetch: limited }) });
  assert.equal(organization.code, 1);
  assert.equal(organization.stdout, '');
  assert.equal(organization.stderr, 'GitHub rate limit reached; try again in a minute');
});

/** GitHub, answering from EXAMPLE, with the requests left told on `url`; every URL asked is kept. */
function left(url: string, remaining: number, resource = 'core') {
  const asked: string[] = [];
  const headers = { 'x-ratelimit-remaining': String(remaining), 'x-ratelimit-reset': '1792503900', 'x-ratelimit-resource': resource };
  const fetch: Fetch = async (request, init) => {
    asked.push(request);
    const response = await github(request, init);
    return request === url ? new Response(await response.text(), { status: response.status, headers }) : response;
  };
  return { fetch, asked };
}

test('an organization, too few requests left → the scan ends before it starts', async () => {
  // Three repositories listed: example, kotlin and gone; at least 6 requests, 5 left.
  const { fetch, asked } = left('https://api.github.com/users/JetBrains/repos?per_page=100&page=1', 5);
  const organization = await atlas(['scan', 'https://github.com/JetBrains'], { open: opener({ fetch }) });
  assert.equal(organization.code, 1);
  assert.equal(organization.stdout, '');
  assert.equal(organization.stderr, 'GitHub rate limit too low: 3 repositories need at least 6 requests, 5 left until 13:45 UTC');
  assert.deepEqual(asked, ['https://api.github.com/users/JetBrains', 'https://api.github.com/users/JetBrains/repos?per_page=100&page=1']);

  // 6 left: enough to start.
  const enough = await atlas(['scan', 'https://github.com/JetBrains'], { open: opener(left('https://api.github.com/users/JetBrains/repos?per_page=100&page=1', 6)) });
  assert.equal(enough.code, 0, enough.stderr);
  assert.equal(enough.stdout.split('\n')[0], 'JetBrains · 2 skills in 2 repositories');

  // What is left of another resource is counted apart: it does not stop the scan.
  const other = left('https://api.github.com/users/JetBrains', 0, 'search');
  const scanned = await atlas(['scan', 'https://github.com/JetBrains'], { open: opener(other) });
  assert.equal(scanned.code, 0, scanned.stderr);
});

test('unknown organization → a clear message, exit code 1', async () => {
  const notFound = replay({ 'https://api.github.com/users/no-such-owner': { status: 404, body: { message: 'Not Found' } } });
  const missing = await atlas(['scan', 'https://github.com/no-such-owner'], { open: opener({ fetch: notFound }) });
  assert.equal(missing.code, 1);
  assert.equal(missing.stdout, '');
  assert.equal(missing.stderr, 'Organization or user not found: https://github.com/no-such-owner');
});
