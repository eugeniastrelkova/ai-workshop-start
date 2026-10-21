import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AtlasError } from './core/errors.ts';
import type { Source } from './core/scan.ts';

/** Never part of a repository's own files. */
const SKIPPED = new Set(['.git', 'node_modules']);

/** A local checkout as a repository: named after its directory, linked with file:// URLs. */
export async function openDirectory(input: string): Promise<Source> {
  const root = resolve(input);
  const name = basename(root);
  let entries: Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    throw new AtlasError(`Not a GitHub URL or a readable directory: ${input}`);
  }
  const paths: string[] = [];
  const warnings: string[] = [];
  await walk(root, '', entries, paths, warnings);
  return {
    repository: { id: name, organization: 'local', name, url: pathToFileURL(root).href, commit: '' },
    paths,
    warnings,
    read: (path) => readFile(join(root, path)).then((bytes) => new Uint8Array(bytes), () => undefined),
  };
}

/**
 * Every regular file under the directory's entries, as a path relative to the root. A directory
 * that cannot be read is a warning; the walk goes on.
 */
async function walk(root: string, directory: string, entries: Dirent[], paths: string[], warnings: string[]): Promise<void> {
  // One list for the whole walk: a large repository has more files than a spread can pass.
  for (const entry of entries) {
    const path = directory ? `${directory}/${entry.name}` : entry.name;
    if (entry.isDirectory() && !SKIPPED.has(entry.name)) {
      let inner: Dirent[];
      try {
        inner = await readdir(join(root, path), { withFileTypes: true });
      } catch {
        warnings.push(`${path}: cannot be read; skipped`);
        continue;
      }
      await walk(root, path, inner, paths, warnings);
    } else if (entry.isFile()) paths.push(path);
  }
}
