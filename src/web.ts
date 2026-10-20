// The web view: one page with a field for the repository, then its skills and their SKILL.md; for an
// organization, each of its repositories with skills.
// Each request scans afresh; nothing is stored. Local only: it reads local directories.
import { createServer, type Server } from 'node:http';
import { countSkills, filterOwner, filterSkills, firstSentence, isOwner } from './commands.ts';
import { AtlasError } from './core/errors.ts';
import { skillLink, type Skill } from './core/model.ts';
import { scan, scanOwner, type Owner, type OwnerResult, type ScanResult, type Source } from './core/scan.ts';

export type Open = (input: string) => Promise<Source | Owner>;

export type Page = { status: number; html: string };

/** Listens on 127.0.0.1; port 0 picks a free one. Resolves to the server and its address. */
export function serve(open: Open, port: number): Promise<{ server: Server; url: string }> {
  const server = createServer(async (request, response) => {
    const page = await render(new URL(request.url ?? '/', 'http://127.0.0.1'), open);
    response.writeHead(page.status, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end(page.html);
  });
  return new Promise((resolve, reject) => {
    server.once('error', (error) => reject(new AtlasError(`Cannot listen on 127.0.0.1:${port}: ${error.message}`)));
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const actual = typeof address === 'object' && address ? address.port : port;
      resolve({ server, url: `http://127.0.0.1:${actual}/` });
    });
  });
}

/** `/`: the fields; `/?repo=<input>&words=<words>`: the fields, then the scan or why it failed. */
export async function render(url: URL, open: Open): Promise<Page> {
  if (url.pathname !== '/') return { status: 404, html: layout('Not found', '', '', '<p class="error">Not found</p>') };
  const input = url.searchParams.get('repo')?.trim() ?? '';
  const words = url.searchParams.get('words') ?? '';
  if (!input) return { status: 200, html: layout('Skill Atlas', '', words, '') };
  try {
    const opened = await open(input);
    const filter = words.split(/\s+/).filter(Boolean);
    if (isOwner(opened)) {
      const result = await scanOwner(opened);
      return { status: 200, html: layout(`${result.owner.id} · Skill Atlas`, input, words, owner(result, filter)) };
    }
    const result = await scan(opened);
    return { status: 200, html: layout(`${result.repository.id} · Skill Atlas`, input, words, repository(result, filter)) };
  } catch (error) {
    const message = error instanceof AtlasError ? error.message : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    const status = error instanceof AtlasError ? 400 : 500;
    return { status, html: layout('Skill Atlas', input, words, `<p class="error">${escape(message)}</p>`) };
  }
}

/** `<owner> · N skills in M repositories`, each repository with skills left after the words, then all the warnings. */
function owner({ owner, repositories, warnings }: OwnerResult, words: string[]): string {
  const { shown, count } = filterOwner(repositories, words);
  const heading = `<h2><a href="${escape(owner.url)}">${escape(owner.id)}</a> · ${count}</h2>`;
  return [heading, ...shown.map((result) => repository({ ...result, warnings: [] }, words, 'h3')), warned(warnings)].join('\n');
}

/** `<owner>/<repo> · N skills`, filtered `N of M skills`, each skill folded over its SKILL.md, then the warnings. */
function repository({ repository, skills, warnings }: ScanResult, words: string[], heading = 'h2'): string {
  const shown = filterSkills(skills, words);
  const list = shown.map((skill) => skillItem(skill, skillLink(repository, skill))).join('\n');
  const title = `<a href="${escape(repository.url)}">${escape(repository.id)}</a> · ${countSkills(shown, skills, words)}`;
  return `<${heading}>${title}</${heading}>\n<ul class="skills">\n${list}\n</ul>\n${warned(warnings)}`;
}

function warned(warnings: string[]): string {
  return warnings.length
    ? `<ul class="warnings">${warnings.map((warning) => `<li>warning: ${escape(warning)}</li>`).join('')}</ul>`
    : '';
}

function skillItem(skill: Skill, link: string): string {
  const description = skill.description
    ? `<span class="description"> — ${escape(firstSentence(skill.description))}</span>`
    : '';
  const copies = skill.copies.length ? `<div class="copies">also in ${escape(skill.copies.join(', '))}</div>` : '';
  return `<li class="skill">
<details>
<summary><b>${escape(skill.name)}</b>${description}</summary>
<div class="body">
<div class="link"><a href="${escape(link)}">${escape(link)}</a></div>
${copies}
<pre class="skill-md">${escape(skill.text)}</pre>
</div>
</details>
</li>`;
}

function layout(title: string, input: string, words: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escape(title)}</title>
<style>
:root {
  --bg: #f7f7fb; --surface: #fff; --text: #16161d; --muted: #6b6b7b; --border: #e4e4ec;
  --accent: #6d4aff; --accent-text: #fff; --code: #f3f3f8;
  --error: #c62828; --error-bg: #fdecec; --warn: #8a5a00; --warn-bg: #fff6e0;
  --radius: 14px; --shadow: 0 1px 2px rgb(20 20 40 / 4%), 0 4px 16px rgb(20 20 40 / 6%);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f14; --surface: #18181f; --text: #ececf1; --muted: #9a9aab; --border: #2a2a35;
    --accent: #9b84ff; --accent-text: #0f0f14; --code: #111118;
    --error: #ff8a80; --error-bg: #2a1616; --warn: #ffcc66; --warn-bg: #2a2212;
    --shadow: 0 1px 2px rgb(0 0 0 / 30%), 0 4px 16px rgb(0 0 0 / 25%);
  }
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--bg); color: var(--text);
  font: 15px/1.6 Inter, system-ui, -apple-system, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased;
}
main { max-width: 52rem; margin: 0 auto; padding: 3rem 1.25rem 4rem; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
h1 { margin: 0 0 .25rem; font-size: 1.75rem; letter-spacing: -.02em; }
h1 a { color: inherit; }
h1 a:hover { text-decoration: none; }
.tagline { margin: 0 0 1.5rem; color: var(--muted); }
form {
  display: flex; gap: .5rem; padding: .375rem; background: var(--surface);
  border: 1px solid var(--border); border-radius: 999px; box-shadow: var(--shadow);
}
form:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 18%, transparent); }
input[name=repo], input[name=words] {
  flex: 1; min-width: 0; padding: .5rem 1rem; border: 0; outline: 0; background: transparent;
  color: inherit; font: inherit;
}
input[name=words] { flex: 0 1 12rem; border-left: 1px solid var(--border); }
button {
  padding: .5rem 1.25rem; border: 0; border-radius: 999px; background: var(--accent); color: var(--accent-text);
  font: inherit; font-weight: 600; cursor: pointer; transition: filter .15s;
}
button:hover { filter: brightness(1.1); }
h2 { margin: 2.5rem 0 1rem; font-size: 1.125rem; font-weight: 600; color: var(--muted); }
h2 a { color: var(--text); }
h3 { margin: 2rem 0 .75rem; font-size: 1rem; font-weight: 600; color: var(--muted); }
h3 a { color: var(--text); }
.skills { display: grid; gap: .75rem; margin: 0; padding: 0; list-style: none; }
.skill {
  background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  box-shadow: var(--shadow); overflow: hidden; transition: border-color .15s;
}
.skill:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--border)); }
summary {
  display: flex; align-items: baseline; gap: .25rem; padding: 1rem 1.25rem; cursor: pointer; list-style: none;
}
summary::-webkit-details-marker { display: none; }
summary::after {
  content: ""; flex: none; align-self: center; width: .5rem; height: .5rem; margin-left: auto;
  border: solid var(--muted); border-width: 0 2px 2px 0; transform: rotate(45deg); transition: transform .2s;
}
details[open] summary::after { transform: rotate(-135deg); }
summary b { font-weight: 600; }
.description { color: var(--muted); }
.body { padding: 0 1.25rem 1.25rem; }
.link, .copies { font: 12.5px/1.5 var(--mono); color: var(--muted); overflow-wrap: anywhere; }
.copies { margin-top: .25rem; }
pre {
  margin: .875rem 0 0; padding: 1rem 1.125rem; max-height: 32rem; overflow: auto;
  background: var(--code); border: 1px solid var(--border); border-radius: 10px;
  font: 13px/1.6 var(--mono); white-space: pre-wrap;
}
.error, .warnings { margin: 1.5rem 0 0; padding: .875rem 1.125rem; border-radius: var(--radius); }
.error { background: var(--error-bg); color: var(--error); }
.warnings { background: var(--warn-bg); color: var(--warn); list-style: none; font-size: 14px; }
</style>
</head>
<body>
<main>
<h1><a href="/">Skill Atlas</a></h1>
<p class="tagline">Every agent skill in a repository, with its SKILL.md.</p>
<form method="get" action="/">
<input name="repo" value="${escape(input)}" placeholder="https://github.com/owner/repo, https://github.com/owner or a local directory" aria-label="Repository" autofocus>
<input name="words" value="${escape(words)}" placeholder="Words to filter by" aria-label="Words">
<button type="submit">Scan</button>
</form>
${body}
</main>
</body>
</html>
`;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
