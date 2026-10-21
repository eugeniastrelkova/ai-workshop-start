// Runs the commands the way the CLI does, with GitHub answering from EXAMPLE below.
import { fileURLToPath } from 'node:url';
import { run } from '../src/commands.ts';
import { openGitHub, openGitHubOwner, parseGitHubOwner, parseGitHubUrl, type Fetch } from '../src/core/github.ts';
import { replay, type Recording } from '../src/core/replay.ts';
import { openDirectory } from '../src/local.ts';

export const FIXTURE = fileURLToPath(new URL('../fixture', import.meta.url));
export const CLI = fileURLToPath(new URL('../src/cli.ts', import.meta.url));

/** The commit GitHub answers for JetBrains/example. */
export const EXAMPLE_COMMIT = '5ab6270ab772d113e8ad52ebfcaa0109c522ae00';

/** The commit GitHub answers for JetBrains/kotlin. */
export const KOTLIN_COMMIT = '9c1d0e7b2f4a6c8e0b1d3f5a7c9e1b3d5f7a9c0e';

/**
 * What GitHub answers for a small repository, JetBrains/example, with one skill, and for the
 * JetBrains organization: example; kotlin, a skill without front matter; gone, listed but no
 * longer there; a fork and an empty one.
 */
const EXAMPLE: Recording = {
  'https://api.github.com/repos/JetBrains/example': { status: 200, body: { full_name: 'JetBrains/example', default_branch: 'main' } },
  'https://api.github.com/repos/JetBrains/example/commits/main': { status: 200, body: { sha: EXAMPLE_COMMIT } },
  [`https://raw.githubusercontent.com/JetBrains/example/${EXAMPLE_COMMIT}/.claude/skills/commits/SKILL.md`]: {
    status: 200,
    body: '---\nname: commits\ndescription: Write commit messages the way this repository does. Use for every commit.\n---\n# Commits\n',
  },
  [`https://api.github.com/repos/JetBrains/example/git/trees/${EXAMPLE_COMMIT}?recursive=1`]: {
    status: 200,
    body: {
      truncated: false,
      tree: [
        { path: '.claude/skills/commits', mode: '040000', type: 'tree', sha: 'a1' },
        { path: '.claude/skills/commits/SKILL.md', mode: '100644', type: 'blob', sha: 'a2' },
      ],
    },
  },
  'https://api.github.com/users/JetBrains': { status: 200, body: { login: 'JetBrains', type: 'Organization' } },
  'https://api.github.com/repos/JetBrains/kotlin': { status: 200, body: { full_name: 'JetBrains/kotlin', default_branch: 'master' } },
  'https://api.github.com/repos/JetBrains/kotlin/commits/master': { status: 200, body: { sha: KOTLIN_COMMIT } },
  [`https://api.github.com/repos/JetBrains/kotlin/git/trees/${KOTLIN_COMMIT}?recursive=1`]: {
    status: 200,
    body: {
      truncated: false,
      tree: [
        { path: '.agents/skills/build', mode: '040000', type: 'tree', sha: 'b1' },
        { path: '.agents/skills/build/SKILL.md', mode: '100644', type: 'blob', sha: 'b2' },
      ],
    },
  },
  [`https://raw.githubusercontent.com/JetBrains/kotlin/${KOTLIN_COMMIT}/.agents/skills/build/SKILL.md`]: {
    status: 200,
    body: '# Build\n',
  },
  // Listed, but gone by the time it is scanned.
  'https://api.github.com/repos/JetBrains/gone/commits/main': { status: 404, body: { message: 'Not Found' } },
  // The organization's repositories, listed.
  'https://api.github.com/users/JetBrains/repos?per_page=100&page=1': {
    status: 200,
    body: [
      { full_name: 'JetBrains/example', default_branch: 'main', fork: false, size: 12 },
      { full_name: 'JetBrains/kotlin', default_branch: 'master', fork: false, size: 900 },
      { full_name: 'JetBrains/gone', default_branch: 'main', fork: false, size: 3 },
      { full_name: 'JetBrains/forked', default_branch: 'main', fork: true, size: 40 },
      { full_name: 'JetBrains/empty', default_branch: 'main', fork: false, size: 0 },
    ],
  },
};

/** GitHub, answering from EXAMPLE. */
export const github = replay(EXAMPLE);

/** What the CLI opens, as src/cli.ts does: a repository, an organization or a directory. */
export function opener(options: { fetch: Fetch }) {
  return (input: string) =>
    parseGitHubUrl(input)
      ? openGitHub(input, options)
      : parseGitHubOwner(input)
        ? openGitHubOwner(input, options)
        : openDirectory(input);
}

/** What the CLI opens, with GitHub answering from EXAMPLE. */
export const open = opener({ fetch: github });

/** `skill-atlas <args>`, as the CLI runs it, with GitHub answering from EXAMPLE unless `open` says otherwise. */
export async function atlas(args: string[], options: { open?: ReturnType<typeof opener> } = {}) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await run(args, {
    open: options.open ?? open,
    print: (text) => stdout.push(text),
    error: (text) => stderr.push(text),
  });
  return { code, stdout: stdout.join('\n'), stderr: stderr.join('\n') };
}
