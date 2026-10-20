// The web view: one page with a field for the repository, then its skills and their SKILL.md.
// Each request scans afresh; nothing is stored. Local only: it reads local directories.
import { createServer, type Server } from 'node:http';
import { firstSentence } from './commands.ts';
import { AtlasError } from './core/errors.ts';
import { skillLink, type Skill } from './core/model.ts';
import { scan, type ScanResult, type Source } from './core/scan.ts';

export type Open = (input: string) => Promise<Source>;

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

/** `/`: the field; `/?repo=<input>`: the field, then the scan or why it failed. */
export async function render(url: URL, open: Open): Promise<Page> {
  if (url.pathname !== '/') return { status: 404, html: layout('Not found', '', '<p class="error">Not found</p>') };
  const input = url.searchParams.get('repo')?.trim() ?? '';
  if (!input) return { status: 200, html: layout('Skill Atlas', '', '') };
  try {
    const result = await scan(await open(input));
    return { status: 200, html: layout(`${result.repository.id} · Skill Atlas`, input, repository(result)) };
  } catch (error) {
    const message = error instanceof AtlasError ? error.message : `Unexpected error: ${error instanceof Error ? error.message : String(error)}`;
    const status = error instanceof AtlasError ? 400 : 500;
    return { status, html: layout('Skill Atlas', input, `<p class="error">${escape(message)}</p>`) };
  }
}

/** `<owner>/<repo> · N skills`, each skill folded over its SKILL.md, then the warnings. */
function repository({ repository, skills, warnings }: ScanResult): string {
  const count = `${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}`;
  const list = skills.map((skill) => skillItem(skill, skillLink(repository, skill))).join('\n');
  const warned = warnings.length
    ? `<ul class="warnings">${warnings.map((warning) => `<li>warning: ${escape(warning)}</li>`).join('')}</ul>`
    : '';
  return `<h2><a href="${escape(repository.url)}">${escape(repository.id)}</a> · ${count}</h2>\n<ul class="skills">\n${list}\n</ul>\n${warned}`;
}

function skillItem(skill: Skill, link: string): string {
  const description = skill.description ? ` — ${escape(firstSentence(skill.description))}` : '';
  const copies = skill.copies.length ? `<div class="copies">also in ${escape(skill.copies.join(', '))}</div>` : '';
  return `<li class="skill">
<details>
<summary><b>${escape(skill.name)}</b>${description}</summary>
<div class="link"><a href="${escape(link)}">${escape(link)}</a></div>
${copies}
<pre class="skill-md">${escape(skill.text)}</pre>
</details>
</li>`;
}

function layout(title: string, input: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escape(title)}</title>
<style>
body { font: 15px/1.5 system-ui, sans-serif; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; }
form { display: flex; gap: .5rem; }
input[name=repo] { flex: 1; font: inherit; padding: .3rem .5rem; }
.skills { list-style: none; padding: 0; }
.skill { border-bottom: 1px solid #ddd; padding: .5rem 0; }
summary { cursor: pointer; }
.link, .copies { font-size: 13px; color: #555; margin-left: 1rem; }
pre { background: #f6f8fa; padding: .75rem; overflow: auto; white-space: pre-wrap; }
.error, .warnings { color: #b00020; }
</style>
</head>
<body>
<h1><a href="/">Skill Atlas</a></h1>
<form method="get" action="/">
<input name="repo" value="${escape(input)}" placeholder="https://github.com/owner/repo or a local directory" aria-label="Repository" autofocus>
<button type="submit">Scan</button>
</form>
${body}
</body>
</html>
`;
}

function escape(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
