// The skill-atlas commands. The same code serves the Node CLI and the browser
// terminal: everything that differs between them comes in through the context.
import { AtlasError } from './core/errors.ts';
import { skillLink, type Repository, type Skill } from './core/model.ts';
import { scan, scanOwner, type Owner, type Source } from './core/scan.ts';

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

  scan <GitHub URL | directory>   find every SKILL.md in a repository, or an organization, and print it
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
  if (args.length !== 1) throw new AtlasError('Usage: skill-atlas scan <GitHub URL | directory>');
  const opened = await context.open(args[0]);
  const result = isOwner(opened) ? await scanOwner(opened) : await scan(opened);
  if ('owner' in result) {
    const skills = result.repositories.reduce((sum, repository) => sum + repository.skills.length, 0);
    context.print(`${result.owner.id} · ${countOf(skills, result.repositories.length)}`);
    for (const repository of result.repositories) {
      context.print('');
      printRepository(repository.repository, repository.skills, context);
    }
  } else printRepository(result.repository, result.skills, context);
  for (const warning of result.warnings) context.error(`warning: ${warning}`);
}

export function isOwner(opened: Source | Owner): opened is Owner {
  return 'repositories' in opened;
}

/** `N skills`, and ` in M repositories` for an organization. */
export function countOf(skills: number, repositories?: number): string {
  const count = `${skills} ${skills === 1 ? 'skill' : 'skills'}`;
  return repositories === undefined ? count : `${count} in ${repositories} ${repositories === 1 ? 'repository' : 'repositories'}`;
}

async function serveCommand(args: string[], context: Context) {
  if (!context.serve) throw new AtlasError('serve runs only in the Node CLI: ./skill-atlas serve');
  const port = args.length === 0 ? 4321 : args.length === 2 && args[0] === '--port' ? Number(args[1]) : NaN;
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new AtlasError('Usage: skill-atlas serve [--port <port>]');
  context.print(`Skill Atlas at ${await context.serve(port)}`);
}

/** `<owner>/<repo> · N skills`, then each skill's name, first sentence and link. */
function printRepository(repository: Repository, skills: Skill[], { print }: Context) {
  print(`${repository.id} · ${countOf(skills.length)}`);
  for (const skill of skills) {
    print(skill.description ? `${skill.name} — ${firstSentence(skill.description)}` : skill.name);
    print(`  ${skillLink(repository, skill)}`);
    if (skill.copies.length > 0) print(`  also in ${skill.copies.join(', ')}`);
  }
}

export function firstSentence(text: string): string {
  const line = text.replace(/\s+/g, ' ').trim();
  return /^.*?[.!?](?=\s|$)/.exec(line)?.[0] ?? line;
}
