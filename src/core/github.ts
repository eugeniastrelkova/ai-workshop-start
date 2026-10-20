import { AtlasError, LimitError } from './errors.ts';
import { findSkills, SKILL_ROOTS } from './find.ts';
import type { Owner, Source } from './scan.ts';

/** The part of `fetch` the core uses, so tests and the browser can pass their own. */
export type Fetch = (url: string, init?: { headers?: Record<string, string> }) => Promise<Response>;

export type GitHubOptions = {
  fetch: Fetch;
  /** With a token, skills are found through code search; without it, through the tree. */
  token?: string;
};

const API = 'https://api.github.com';
const RAW = 'https://raw.githubusercontent.com';

/** `https://github.com/owner/repo`, with or without the scheme, a trailing slash or `.git`. */
export function parseGitHubUrl(input: string): { owner: string; repo: string } | undefined {
  const match = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/i.exec(input.trim());
  return match ? { owner: match[1], repo: match[2] } : undefined;
}

/** `https://github.com/owner`: an organization or a user, with or without the scheme or a trailing slash. */
export function parseGitHubOwner(input: string): string | undefined {
  return /^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/?$/i.exec(input.trim())?.[1];
}

/** Resolves the default branch to a commit and lists the files that may be skills. */
export async function openGitHub(input: string, options: GitHubOptions): Promise<Source> {
  const name = parseGitHubUrl(input);
  if (!name) throw new AtlasError(`Not a GitHub repository URL: ${input}`);
  return openRepository(client(options), `${name.owner}/${name.repo}`);
}

/**
 * An organization's or a user's repositories, forks and empty ones left out. With a token, one
 * code search finds the repositories with a project skill; without, every one is listed.
 */
export async function openGitHubOwner(input: string, options: GitHubOptions): Promise<Owner> {
  const name = parseGitHubOwner(input);
  if (!name) throw new AtlasError(`Not a GitHub organization URL: ${input}`);
  const github = client(options);
  const { login, type } = await github.json<{ login: string; type: string }>(
    `${API}/users/${name}`,
    `Organization or user not found: https://github.com/${name}`,
  );
  const warnings: string[] = [];
  const repositories = options.token
    ? await searchRepositories(github, `${type === 'Organization' ? 'org' : 'user'}:${login}`, warnings)
    : await listRepositories(github, login);
  github.afford(repositories.length);
  return {
    id: login,
    url: `https://github.com/${login}`,
    repositories: repositories.map(({ id, branch, paths }) => ({ id, open: () => openRepository(github, id, branch, paths) })),
    warnings,
  };
}

/** One repository at its default branch; the branch and the paths when already known. */
async function openRepository(github: Client, name: string, branch?: string, listed?: string[]): Promise<Source> {
  let id = name;
  if (!branch) {
    const info = await github.json<{ full_name: string; default_branch: string }>(
      `${API}/repos/${name}`,
      `Repository not found: https://github.com/${name}`,
    );
    id = info.full_name;
    branch = info.default_branch;
  }
  const { sha } = await github.json<{ sha: string }>(`${API}/repos/${id}/commits/${encodePath(branch)}`);
  const warnings: string[] = [];
  const paths = listed ?? (github.token ? await searchPaths(github, id) : await treePaths(github, id, sha, warnings));
  const [organization, repo] = id.split('/');
  return {
    repository: { id, organization, name: repo, url: `https://github.com/${id}`, commit: sha },
    paths,
    warnings,
    read: (path) => github.raw(`${RAW}/${id}/${sha}/${encodePath(path)}`),
  };
}

type Found = { id: string; branch?: string; paths?: string[] };

/** The repositories code search finds a project skill in, with its paths; forks are not searched. */
async function searchRepositories(github: Client, qualifier: string, warnings: string[]): Promise<Found[]> {
  const { items, total } = await search(github, qualifier);
  if (total > items.length) {
    warnings.push(`code search lists at most 1000 SKILL.md files; ${total - items.length} more not looked at`);
  }
  const paths = new Map<string, string[]>();
  for (const item of items) paths.set(item.repository.full_name, [...(paths.get(item.repository.full_name) ?? []), item.path]);
  return [...paths].filter(([, found]) => findSkills(found).length > 0).map(([id, found]) => ({ id, paths: found }));
}

/** Every public repository, 100 a page, but forks and empty ones. */
async function listRepositories(github: Client, login: string): Promise<Found[]> {
  type Listed = { full_name: string; default_branch: string; fork: boolean; size: number };
  const repositories: Found[] = [];
  for (let page = 1; ; page++) {
    const listed = await github.json<Listed[]>(`${API}/users/${login}/repos?per_page=100&page=${page}`);
    for (const repository of listed) {
      if (!repository.fork && repository.size > 0) repositories.push({ id: repository.full_name, branch: repository.default_branch });
    }
    if (listed.length < 100) return repositories;
  }
}

/** Code search looks at the whole default branch, 100 results a page. */
async function searchPaths(github: Client, id: string): Promise<string[]> {
  return [...new Set((await search(github, `repo:${id}`)).items.map((item) => item.path))];
}

type Item = { path: string; repository: { full_name: string } };

/** Every SKILL.md code search finds; pages can repeat a result. GitHub returns at most 1000: ten pages. */
async function search(github: Client, qualifier: string): Promise<{ items: Item[]; total: number }> {
  const items = new Map<string, Item>();
  let total = 0;
  for (let page = 1; page <= 10; page++) {
    const result = await github.json<{ total_count: number; items: Item[] }>(
      `${API}/search/code?q=filename:SKILL.md+${qualifier}&per_page=100&page=${page}`,
    );
    total = result.total_count;
    for (const item of result.items) items.set(`${item.repository?.full_name}\0${item.path}`, item);
    if (result.items.length < 100 || page * 100 >= result.total_count) break;
  }
  return { items: [...items.values()], total: Math.max(total, items.size) };
}

type Tree = { truncated: boolean; tree: { path: string; mode: string; type: string; sha: string }[] };

/** The whole tree at once, or only the skill roots when it is too large for one answer. */
async function treePaths(github: Client, id: string, sha: string, warnings: string[]): Promise<string[]> {
  const tree = await github.json<Tree>(`${API}/repos/${id}/git/trees/${sha}?recursive=1`);
  if (!tree.truncated) return files(tree);
  warnings.push(`the tree is too large to list at once; looked only in the top-level ${SKILL_ROOTS.join(', ')} (GITHUB_TOKEN searches everywhere)`);
  const paths: string[] = [];
  for (const root of SKILL_ROOTS) {
    const rootSha = await directory(github, id, sha, root);
    if (!rootSha) continue;
    const subtree = await github.json<Tree>(`${API}/repos/${id}/git/trees/${rootSha}?recursive=1`);
    paths.push(...files(subtree).map((path) => `${root}/${path}`));
  }
  return paths;
}

/** Walks down one level at a time; the directory's tree, or undefined if it does not exist. */
async function directory(github: Client, id: string, sha: string, path: string): Promise<string | undefined> {
  let current = sha;
  for (const segment of path.split('/')) {
    const tree = await github.json<Tree>(`${API}/repos/${id}/git/trees/${current}`);
    const entry = tree.tree.find((item) => item.path === segment && item.type === 'tree');
    if (!entry) return undefined;
    current = entry.sha;
  }
  return current;
}

/** Regular files only: a symbolic link's content is its target, not a SKILL.md. */
function files(tree: Tree): string[] {
  return tree.tree.filter((item) => item.type === 'blob' && item.mode !== '120000').map((item) => item.path);
}

type Client = ReturnType<typeof client>;

function client({ fetch, token }: GitHubOptions) {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const answers = new Map<string, Promise<unknown>>(); // the root tree is asked for once per skill root
  let left: { remaining: number; reset: number } | undefined; // of the core API, as its last answer told

  /** What to do: set GITHUB_TOKEN, or wait until the reset when GitHub tells it; a secondary limit does not. */
  function advice(reset?: number): string {
    const after = reset === undefined ? undefined : `try again after ${utc(reset)}`;
    if (token) return `; ${after ?? 'try again in a minute'}`;
    return after ? `; set GITHUB_TOKEN, or ${after}` : '; set GITHUB_TOKEN';
  }

  function remember(response: Response) {
    const remaining = Number(response.headers.get('x-ratelimit-remaining') ?? NaN);
    const reset = Number(response.headers.get('x-ratelimit-reset') ?? NaN);
    const resource = response.headers.get('x-ratelimit-resource') ?? 'core'; // code search is counted apart
    if (resource === 'core' && Number.isInteger(remaining) && Number.isInteger(reset)) left = { remaining, reset };
  }

  async function get(url: string, init?: { headers: Record<string, string> }): Promise<Response> {
    try {
      return await fetch(url, init);
    } catch (error) {
      throw new AtlasError(`Cannot reach GitHub: ${describe(error)}`);
    }
  }

  async function request(url: string, notFound: string): Promise<unknown> {
    const response = await get(url, { headers });
    remember(response);
    if (response.ok) return response.json();
    const body: unknown = await response.json().catch(() => undefined);
    const message = (body as { message?: unknown } | undefined)?.message;
    const text = typeof message === 'string' ? message : '';
    if (response.status === 404) throw new AtlasError(notFound);
    if ((response.status === 403 || response.status === 429) && /rate limit/i.test(text)) {
      throw new LimitError(`GitHub rate limit reached${advice(left?.remaining === 0 ? left.reset : undefined)}`);
    }
    if (response.status === 401) throw new LimitError('GitHub rejected the token in GITHUB_TOKEN');
    throw new AtlasError(`GitHub answered ${response.status} for ${url}${text && `: ${text}`}`);
  }

  return {
    token,
    /** Ends the scan before it starts when GitHub said fewer requests are left than the repositories take, 2 each at least. */
    afford(repositories: number) {
      const needed = 2 * repositories;
      if (!left || left.remaining >= needed) return;
      const counted = `${repositories} ${repositories === 1 ? 'repository needs' : 'repositories need'} at least ${needed} requests`;
      throw new LimitError(`GitHub rate limit too low: ${counted}, ${left.remaining} left until ${utc(left.reset)}${token ? '' : '; set GITHUB_TOKEN'}`);
    },
    /** A GitHub API answer; `notFound` explains a 404. */
    json<T>(url: string, notFound = `Not found on GitHub: ${url}`): Promise<T> {
      if (!answers.has(url)) answers.set(url, request(url, notFound));
      return answers.get(url) as Promise<T>;
    },
    /** A file's bytes at the scanned commit, or undefined if it is not there. */
    async raw(url: string): Promise<Uint8Array | undefined> {
      const response = await get(url);
      if (response.status === 404) return undefined;
      if (!response.ok) throw new AtlasError(`GitHub answered ${response.status} for ${url}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}

/** A reset time, in seconds since the epoch: `13:45 UTC`. */
function utc(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(11, 16)} UTC`;
}

function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/');
}

function describe(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message} (${error.cause.message})` : error.message;
}
