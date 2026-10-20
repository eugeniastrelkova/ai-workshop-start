// The skill-atlas commands. The same code serves the Node CLI and the browser
// terminal: everything that differs between them comes in through the context.
import { AtlasError } from './core/errors.ts';
import { skillLink, type Repository, type Skill } from './core/model.ts';
import { scan, scanOwner, type Owner, type ScanResult, type Source } from './core/scan.ts';

export type Context = {
  /** Opens what the user asked to scan: a repository, or an organization's repositories. */
  open(input: string): Promise<Source | Owner>;
  print(text: string): void;
  /** Errors and warnings. */
  error(text: string): void;
  /** Starts the web view on the port and returns its address; only the Node CLI has it. */
  serve?(port: number): Promise<string>;
};

const usage = `Usage: skill-atlas <command>

  scan <GitHub URL | directory> [<word>...]
                                  find every SKILL.md in a repository, or an organization, and print it;
                                  with words, only the skills that contain every one
  serve [--port <port>]           open the web view on 127.0.0.1, port 4321 by default
  help                            show this help`;

/** Runs one command; returns its exit code. */
export async function run(args: string[], context: Context): Promise<number> {
  const [command = 'help', ...rest] = args;
  try {
    if (command === 'scan') await scanCommand(rest, context);
    else if (command === 'serve') await serveCommand(rest, context);
    else if (command === 'help') context.print(usage);
    else throw new AtlasError(`Unknown command: ${command}\n\n${usage}`);
    return 0;
  } catch (error) {
    if (!(error instanceof AtlasError)) throw error;
    context.error(error.message);
    return 1;
  }
}

async function scanCommand(args: string[], context: Context) {
  const [input, ...words] = args;
  if (!input) throw new AtlasError('Usage: skill-atlas scan <GitHub URL | directory> [<word>...]');
  const opened = await context.open(input);
  const result = isOwner(opened) ? await scanOwner(opened) : await scan(opened);
  if ('owner' in result) {
    const { shown, count } = filterOwner(result.repositories, words);
    context.print(`${result.owner.id} · ${count}`);
    for (const repository of shown) {
      context.print('');
      printRepository(repository.repository, repository.skills, words, context);
    }
  } else printRepository(result.repository, result.skills, words, context);
  for (const warning of result.warnings) context.error(`warning: ${warning}`);
}

export function isOwner(opened: Source | Owner): opened is Owner {
  return 'repositories' in opened;
}

/**
 * An organization's repositories with skills left after the words, and its count:
 * `N skills in M repositories`; filtered, `N of M skills in K repositories`.
 */
export function filterOwner(repositories: ScanResult[], words: string[]): { shown: ScanResult[]; count: string } {
  const shown = repositories.filter((repository) => filterSkills(repository.skills, words).length > 0);
  const skills = countSkills(
    shown.flatMap((repository) => filterSkills(repository.skills, words)),
    repositories.flatMap((repository) => repository.skills),
    words,
  );
  return { shown, count: `${skills} in ${shown.length} ${shown.length === 1 ? 'repository' : 'repositories'}` };
}

async function serveCommand(args: string[], context: Context) {
  if (!context.serve) throw new AtlasError('serve runs only in the Node CLI: ./skill-atlas serve');
  const port = args.length === 0 ? 4321 : args.length === 2 && args[0] === '--port' ? Number(args[1]) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new AtlasError('Usage: skill-atlas serve [--port <port>]');
  context.print(`Skill Atlas at ${await context.serve(port)}`);
}

/** `<owner>/<repo> · N skills`, then each skill's name, first sentence and link. */
function printRepository(repository: Repository, skills: Skill[], words: string[], { print }: Context) {
  const shown = filterSkills(skills, words);
  print(`${repository.id} · ${countSkills(shown, skills, words)}`);
  for (const skill of shown) {
    print(skill.description ? `${skill.name} — ${firstSentence(skill.description)}` : skill.name);
    print(`  ${skillLink(repository, skill)}`);
    if (skill.copies.length > 0) print(`  also in ${skill.copies.join(', ')}`);
  }
}

/** The skills whose name or description contains every word, case-insensitive; no words: all. */
export function filterSkills(skills: Skill[], words: string[]): Skill[] {
  const wanted = words.map((word) => word.toLowerCase()).filter(Boolean);
  return skills.filter((skill) => {
    const text = `${skill.name}\n${skill.description}`.toLowerCase();
    return wanted.every((word) => text.includes(word));
  });
}

/** `N skills`; filtered by words, `N of M skills`. */
export function countSkills(shown: Skill[], all: Skill[], words: string[]): string {
  const noun = all.length === 1 ? 'skill' : 'skills';
  return words.some(Boolean) ? `${shown.length} of ${all.length} ${noun}` : `${shown.length} ${noun}`;
}

export function firstSentence(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return /^.*?[.!?](?=\s|$)/.exec(line)?.[0] ?? line;
}
