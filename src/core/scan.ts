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
