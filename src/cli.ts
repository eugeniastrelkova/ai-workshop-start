#!/usr/bin/env node
// The Node client: a GitHub repository or organization through the GitHub API, or a local directory; stdout and
// stderr, or the web view. Nothing is stored.
import { run } from './commands.ts';
import { openGitHub, openGitHubOwner, parseGitHubOwner, parseGitHubUrl } from './core/github.ts';
import { openDirectory } from './local.ts';
import { serve } from './web.ts';

const open = (input: string) =>
  parseGitHubUrl(input)
    ? openGitHub(input, { fetch })
    : parseGitHubOwner(input)
      ? openGitHubOwner(input, { fetch })
      : openDirectory(input);

process.exitCode = await run(process.argv.slice(2), {
  open,
  print: (text) => console.log(text),
  error: (text) => console.error(text),
  // The server keeps the process running until it is stopped.
  serve: async (port) => (await serve(open, port)).url,
});
