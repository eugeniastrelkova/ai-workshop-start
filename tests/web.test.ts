// The decisions in spec/web.md, checked on the real server: ./fixture, and the small GitHub
// repository answered in tests/helpers.ts.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, test } from 'node:test';
import { createBrowserBackend } from '../src/browser.ts';
import { run } from '../src/commands.ts';
import { serve } from '../src/web.ts';
import { CLI, EXAMPLE_COMMIT, FIXTURE, github, KOTLIN_COMMIT, open } from './helpers.ts';

const { server, url } = await serve(open, 0);
after(() => server.close());

async function page(query: string) {
  const response = await fetch(new URL(query, url));
  return { status: response.status, type: response.headers.get('content-type'), html: await response.text() };
}

/** The skills on a page, in order: name and description, as the summary shows them. */
function summaries(html: string): string[] {
  return [...html.matchAll(/<summary>(.*?)<\/summary>/g)].map(([, summary]) => summary.replace(/<[^>]+>/g, ''));
}

test('serve listens on 127.0.0.1', () => {
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/$/);
});

test('the page: a field for the repository, submitted as /?repo=<input>, and no result yet', async () => {
  const empty = await page('/');
  assert.equal(empty.status, 200);
  assert.equal(empty.type, 'text/html; charset=utf-8');
  assert.match(empty.html, /<form method="get" action="\/">/);
  assert.match(empty.html, /<input name="repo" value=""/);
  assert.doesNotMatch(empty.html, /class="skills"/);
});

test('a GitHub repository: its skills, each with its first sentence, pinned link and the whole SKILL.md, folded', async () => {
  const example = await page(`/?repo=${encodeURIComponent('https://github.com/JetBrains/example')}`);
  assert.equal(example.status, 200);
  assert.match(example.html, /<input name="repo" value="https:\/\/github\.com\/JetBrains\/example"/);
  assert.match(example.html, /<h2><a href="https:\/\/github\.com\/JetBrains\/example">JetBrains\/example<\/a> · 1 skill<\/h2>/);
  assert.deepEqual(summaries(example.html), ['commits — Write commit messages the way this repository does.']);
  const link = `https://github.com/JetBrains/example/blob/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`;
  assert.ok(example.html.includes(`<a href="${link}">${link}</a>`));
  assert.ok(
    example.html.includes(
      '<pre class="skill-md">---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n</pre>',
    ),
  );
  assert.doesNotMatch(example.html, /<details open/);
});

test('./fixture: the order of scan, copies as also in, the malformed skill by its directory, the warning under the skills', async () => {
  const fixture = await page(`/?repo=${encodeURIComponent(FIXTURE)}`);
  assert.equal(fixture.status, 200);
  assert.match(fixture.html, /fixture<\/a> · 4 skills/);
  assert.deepEqual(summaries(fixture.html), [
    'code-style — Follow the project&#39;s code style.',
    'commits — Write commit messages the way this repository does.',
    'commits — Write commit messages for the Kotlin plugin.',
    'release-checklist',
  ]);
  assert.ok(fixture.html.includes(`${pathToFileURL(FIXTURE).href}/.agents/skills/commits/SKILL.md`));
  assert.ok(fixture.html.includes('<div class="copies">also in .claude/skills/commits/SKILL.md</div>'));
  const skillMd = readFileSync(join(FIXTURE, '.github/skills/code-style/SKILL.md'), 'utf8').replaceAll("'", '&#39;');
  assert.ok(fixture.html.includes(`<pre class="skill-md">${skillMd}</pre>`));
  assert.match(
    fixture.html,
    /<\/ul>\n<ul class="warnings"><li>warning: \.agents\/skills\/release-checklist\/SKILL\.md: malformed front matter: /,
  );
});

test('an organization: the owner, then each repository with skills, then the warnings', async () => {
  const organization = await page(`/?repo=${encodeURIComponent('https://github.com/JetBrains')}`);
  assert.equal(organization.status, 200);
  assert.match(organization.html, /<title>JetBrains · Skill Atlas<\/title>/);
  assert.match(organization.html, /<h2><a href="https:\/\/github\.com\/JetBrains">JetBrains<\/a> · 2 skills in 2 repositories<\/h2>/);
  const repositories = [...organization.html.matchAll(/<h3><a href="([^"]+)">([^<]+)<\/a> · ([^<]+)<\/h3>/g)].map(([, link, id, count]) => [link, id, count]);
  assert.deepEqual(repositories, [
    ['https://github.com/JetBrains/example', 'JetBrains/example', '1 skill'],
    ['https://github.com/JetBrains/kotlin', 'JetBrains/kotlin', '1 skill'],
  ]);
  assert.deepEqual(summaries(organization.html), ['commits — Write commit messages the way this repository does.', 'build']);
  assert.ok(organization.html.includes(`https://github.com/JetBrains/kotlin/blob/${KOTLIN_COMMIT}/.agents/skills/build/SKILL.md`));
  assert.ok(
    organization.html.includes(
      '<ul class="warnings"><li>warning: JetBrains/gone: Repository not found: https://github.com/JetBrains/gone; skipped</li>' +
        '<li>warning: JetBrains/kotlin: .agents/skills/build/SKILL.md: no front matter; using the directory name</li></ul>',
    ),
  );
});

test('the browser terminal scans an organization too', async () => {
  const browser = createBrowserBackend({ fetch: github });
  assert.equal(
    await browser.run('$ skill-atlas scan https://github.com/JetBrains'),
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
      'warning: JetBrains/gone: Repository not found: https://github.com/JetBrains/gone; skipped',
      'warning: JetBrains/kotlin: .agents/skills/build/SKILL.md: no front matter; using the directory name',
    ].join('\n'),
  );
});

test('an organization with words: only the repositories with a match, all the warnings', async () => {
  const organization = await page(`/?repo=${encodeURIComponent('https://github.com/JetBrains')}&words=build`);
  assert.equal(organization.status, 200);
  assert.match(organization.html, /JetBrains<\/a> · 1 of 2 skills in 1 repository<\/h2>/);
  assert.match(organization.html, /<h3><a href="https:\/\/github\.com\/JetBrains\/kotlin">JetBrains\/kotlin<\/a> · 1 of 1 skill<\/h3>/);
  assert.doesNotMatch(organization.html, /<h3><a href="https:\/\/github\.com\/JetBrains\/example"/);
  assert.deepEqual(summaries(organization.html), ['build']);
  assert.match(organization.html, /<input name="words" value="build"/);
  assert.match(organization.html, /warning: JetBrains\/gone/);
});

test('words: a second field, submitted as &words=<words>, filtering as scan does', async () => {
  assert.match((await page('/')).html, /<input name="words" value=""/);
  const repo = encodeURIComponent(FIXTURE);

  const filtered = await page(`/?repo=${repo}&words=${encodeURIComponent('COMMIT  plugin')}`);
  assert.equal(filtered.status, 200);
  assert.match(filtered.html, /fixture<\/a> · 1 of 4 skills<\/h2>/);
  assert.deepEqual(summaries(filtered.html), ['commits — Write commit messages for the Kotlin plugin.']);
  assert.match(filtered.html, /<input name="words" value="COMMIT  plugin"/);
  assert.match(filtered.html, /<ul class="warnings">/);

  const kotlin = await page(`/?repo=${repo}&words=kotlin`);
  assert.deepEqual(summaries(kotlin.html), ['code-style — Follow the project&#39;s code style.', 'commits — Write commit messages for the Kotlin plugin.']);

  const none = await page(`/?repo=${repo}&words=no-such-word`);
  assert.equal(none.status, 200);
  assert.match(none.html, /fixture<\/a> · 0 of 4 skills<\/h2>/);
  assert.deepEqual(summaries(none.html), []);

  const empty = await page(`/?repo=${repo}&words=`);
  assert.match(empty.html, /fixture<\/a> · 4 skills<\/h2>/);
  assert.equal(summaries(empty.html).length, 4);
});

test('the input and SKILL.md are text, never markup', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'skill-atlas-web-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = join(root, '<b>"x"');
  cpSync(join(FIXTURE, '.github'), join(directory, '.github'), { recursive: true });
  writeFileSync(join(directory, '.github/skills/code-style/SKILL.md'), '---\nname: <script>alert(1)</script>\n---\n<img src=x onerror=alert(1)>\n');
  const result = await page(`/?repo=${encodeURIComponent(directory)}`);
  assert.equal(result.status, 200);
  assert.doesNotMatch(result.html, /<script>|<img|<b>"x"/);
  assert.ok(result.html.includes('&#60;script&#62;alert(1)&#60;/script&#62;'));
  assert.ok(result.html.includes('&#60;b&#62;&#34;x&#34;'));
});

test('each request scans afresh', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'skill-atlas-web-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  cpSync(join(FIXTURE, '.github'), join(directory, '.github'), { recursive: true });
  const query = `/?repo=${encodeURIComponent(directory)}`;
  assert.deepEqual(summaries((await page(query)).html), ['code-style — Follow the project&#39;s code style.']);
  writeFileSync(join(directory, '.github/skills/code-style/SKILL.md'), '---\nname: code-style\ndescription: Changed.\n---\n');
  assert.deepEqual(summaries((await page(query)).html), ['code-style — Changed.']);
});

test('unreachable repository → the message of scan, on the page, status 400', async () => {
  const missing = await page(`/?repo=${encodeURIComponent(join(FIXTURE, 'no-such-directory'))}`);
  assert.equal(missing.status, 400);
  assert.match(missing.html, /<p class="error">Not a GitHub URL or a readable directory: .*no-such-directory<\/p>/);
  assert.match(missing.html, /<input name="repo" value=".*no-such-directory"/);

  const offline = await page(`/?repo=${encodeURIComponent('https://github.com/JetBrains/not-answered')}`);
  assert.equal(offline.status, 400);
  assert.match(offline.html, /<p class="error">Cannot reach GitHub: not recorded: https:\/\/api\.github\.com\/repos\/JetBrains\/not-answered<\/p>/);
});

test('any other path → 404', async () => {
  assert.equal((await page('/skills')).status, 404);
  assert.equal((await page('/favicon.ico')).status, 404);
});

test('serve: port 4321 by default, --port to change it, anything else is a usage error', async () => {
  const ports: number[] = [];
  const output: string[] = [];
  const context = {
    open,
    print: (text: string) => output.push(text),
    error: (text: string) => output.push(text),
    serve: async (port: number) => (ports.push(port), `http://127.0.0.1:${port}/`),
  };
  assert.equal(await run(['serve'], context), 0);
  assert.equal(await run(['serve', '--port', '8080'], context), 0);
  assert.deepEqual(ports, [4321, 8080]);
  assert.deepEqual(output, ['Skill Atlas at http://127.0.0.1:4321/', 'Skill Atlas at http://127.0.0.1:8080/']);
  assert.equal(await run(['serve', '--port', 'x'], context), 1);
  assert.equal(await run(['serve', '8080'], context), 1);
  assert.equal(output.at(-1), 'Usage: skill-atlas serve [--port <port>]');
});

test('serve: a port in use → a clear message', async () => {
  const port = Number(new URL(url).port);
  await assert.rejects(serve(open, port), { message: new RegExp(`^Cannot listen on 127\\.0\\.0\\.1:${port}: .*EADDRINUSE`) });
});

test('serve runs only in the Node CLI, not in the browser terminal', async () => {
  const browser = createBrowserBackend({ fetch: () => Promise.reject(new Error('offline')) });
  assert.equal(await browser.run('skill-atlas serve'), 'serve runs only in the Node CLI: ./skill-atlas serve');
});

test('the CLI serves the page and stores nothing', async (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'skill-atlas-'));
  const child = spawn(process.execPath, [CLI, 'serve', '--port', '0'], { cwd });
  t.after(() => {
    child.kill();
    rmSync(cwd, { recursive: true, force: true });
  });
  const address = await new Promise<string>((resolve, reject) => {
    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      const match = /^Skill Atlas at (http:\/\/127\.0\.0\.1:\d+\/)\n/.exec(stdout);
      if (match) resolve(match[1]);
    });
    child.once('exit', (code) => reject(new Error(`exited with ${code}: ${stdout}`)));
  });
  const response = await fetch(`${address}?repo=${encodeURIComponent(FIXTURE)}`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /fixture<\/a> · 4 skills/);
  assert.deepEqual(readdirSync(cwd), []);
});
