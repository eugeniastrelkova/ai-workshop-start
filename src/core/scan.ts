import { AtlasError, LimitError } from './errors.ts';
import { findSkills, placeOf, type SkillFile } from './find.ts';
import { sortSkills, type Repository, type Skill } from './model.ts';
import { parseSkill } from './parse.ts';

/** A repository to scan: its files, and how to read them. */
export type Source = {
  repository: Repository;
  /** Every file path, relative to the repository root. */
  paths: string[];
  /** What listing the files had to leave out. */
  warnings: string[];
  /** The file's bytes, or undefined if it is not there. */
  read(path: string): Promise<Uint8Array | undefined>;
};

export type ScanResult = { repository: Repository; skills: Skill[]; warnings: string[] };

/** A GitHub organization or user: the repositories that may have skills, each opened when scanned. */
export type Owner = {
  id: string;
  /** `https://github.com/<owner>`. */
  url: string;
  repositories: { id: string; open(): Promise<Source> }[];
  /** What listing the repositories had to leave out. */
  warnings: string[];
};

export type OwnerResult = { owner: Owner; repositories: ScanResult[]; warnings: string[] };

/** Results kept by `<repository>@<commit>`: a commit never changes, so its result never goes stale. */
export type ScanCache = Map<string, ScanResult>;

const CACHE_LIMIT = 200;

/**
 * `scan`, reusing the result for the same commit. A local directory has no commit: always scanned afresh.
 * The oldest result goes when the cache is full.
 */
export async function scanCached(source: Source, cache?: ScanCache): Promise<ScanResult> {
  const { id, commit } = source.repository;
  if (!cache || !commit) return scan(source);
  const key = `${id}@${commit}`;
  const kept = cache.get(key);
  if (kept) return kept;
  const result = await scan(source);
  cache.set(key, result);
  if (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value!);
  return result;
}

/** fetch → find → parse. Nothing is stored: the result is all there is. */
export async function scan(source: Source): Promise<ScanResult> {
  const files = findSkills(source.paths);
  // The files are read at the same time: on GitHub, each one is a request.
  const results = await Promise.all(files.map((file) => readSkill(source, file)));
  return {
    repository: source.repository,
    skills: sortSkills(mergeCopies(results.flatMap((result) => (result.skill ? [result.skill] : [])))),
    warnings: [...source.warnings, ...results.flatMap((result) => (result.warning ? [result.warning] : []))],
  };
}

async function readSkill(source: Source, file: SkillFile): Promise<{ skill?: Skill; warning?: string }> {
  const bytes = await source.read(file.path);
  if (!bytes) return { warning: `${file.path}: listed, but not found at the scanned commit; skipped` };
  const text = new TextDecoder().decode(bytes);
  const parsed = parseSkill(text);
  const skill: Skill = {
    id: `${source.repository.id}:${file.path}`,
    repository: source.repository.id,
    path: file.path,
    name: parsed.name ?? file.name,
    description: parsed.description,
    commit: source.repository.commit,
    copies: [],
    text,
  };
  return { skill, warning: parsed.warning && `${file.path}: ${parsed.warning}` };
}

/** One skill per name and place: linked from the first agents' folder, `also in` the others. */
function mergeCopies(skills: Skill[]): Skill[] {
  const copies = new Map<string, Skill[]>();
  for (const skill of skills) {
    const key = `${skill.name}\0${placeOf(skill.path).place}`;
    copies.set(key, [...(copies.get(key) ?? []), skill]);
  }
  return [...copies.values()].map((same) => {
    const [first, ...others] = same.sort((a, b) => placeOf(a.path).rank - placeOf(b.path).rank);
    return { ...first, copies: others.map((skill) => skill.path) };
  });
}

/**
 * Each repository, scanned as one; only those with skills, by id. A repository that fails is a
 * warning, unless GitHub refuses every further request.
 */
export async function scanOwner(owner: Owner, cache?: ScanCache): Promise<OwnerResult> {
  const results = await Promise.all(
    owner.repositories.map(async ({ id, open }): Promise<{ id: string; result?: ScanResult; warnings: string[] }> => {
      try {
        const result = await scanCached(await open(), cache);
        return { id, result, warnings: result.warnings.map((warning) => `${id}: ${warning}`) };
      } catch (error) {
        if (!(error instanceof AtlasError) || error instanceof LimitError) throw error;
        return { id, warnings: [`${id}: ${error.message}; skipped`] };
      }
    }),
  );
  results.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return {
    owner,
    repositories: results.flatMap(({ result }) => (result && result.skills.length > 0 ? [result] : [])),
    warnings: [...owner.warnings, ...results.flatMap((result) => result.warnings)],
  };
}
