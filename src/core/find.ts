/** A project skill's SKILL.md, named after its directory. */
export type SkillFile = { path: string; name: string };

/** Where agents keep a repository's own skills, in the order a skill's copies are linked. */
export const SKILL_ROOTS = ['.agents/skills', '.claude/skills', '.github/skills', 'agent/skills'];

/** Never part of a repository's own files, wherever they are. */
const SKIPPED = ['.git', 'node_modules'];

/** `<subproject>/<agents' folder>/<name>/SKILL.md`, the subproject optional. */
const SKILL = new RegExp(`^(?:(.+)/)?(${SKILL_ROOTS.map((root) => root.replace(/\./g, '\\.')).join('|')})/([^/]+)/SKILL\\.md$`);

/**
 * Every project skill: a file named exactly SKILL.md, directly in a skill's directory in
 * an agents' folder, in any subproject. Anything else named SKILL.md is not a project skill.
 */
export function findSkills(paths: string[]): SkillFile[] {
  return paths
    .filter((path) => SKILL.test(path) && !path.split('/').some((segment) => SKIPPED.includes(segment)))
    .sort()
    .map((path) => ({ path, name: path.split('/').at(-2)! }));
}

/**
 * Where a project skill is, apart from the agents' folder: copies share the place,
 * and the rank says which of them is linked.
 */
export function placeOf(path: string): { place: string; rank: number } {
  const [, subproject = '', root, name] = SKILL.exec(path)!;
  return { place: `${subproject}/${name}`, rank: SKILL_ROOTS.indexOf(root) };
}
