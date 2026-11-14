import type { Config } from '../../../config';
import { workspaceSources } from './workspace-sources';
import { Workspace } from '../../../workspace';
import { contextOfSource } from './context-of-source';
import { type IndexPicture, indexPicture } from './index-picture';
import { readTablesFile } from './read-tables-file';

/** What a region of the kit holds, between its markers. */
const REGION = /\/\/ ddd-ts-kit:[\w-]+\n([\s\S]*?)\/\/ \/ddd-ts-kit:[\w-]+/g;

/** The two pictures of a command, and the command. */
interface Compared {
  readonly before: IndexPicture;
  readonly after: IndexPicture;
  readonly command: 'generate' | 'init';
}

/**
 * The last word of a command on the schema index, said once, on the state the command ends in:
 * what the index gave on disk before the command is compared with what the workspace holds when
 * every generator has run. A table within reach before and under no name after, or not listed
 * any more, or a name that exported one value and exports another: the index is left as it stood
 * on disk, reported as left, the sentences the command noted about its names are taken back, and
 * one note names every table concerned and says what to do. Nothing is done when the picture is
 * kept, nor when an earlier step of the command already left the index.
 */
export function keepThePicture(ws: Workspace, config: Config, command: 'generate' | 'init'): void {
  const index = `${config.platformDir}/database/schema.ts`;
  const before = indexPicture(new Workspace(ws.root, false), config);
  const after = indexPicture(ws, config);

  if (before.text === undefined || after.text === undefined) {
    return;
  }

  // An earlier step left the index as it stood: what a later one wrote in it goes too.
  if (ws.notes.some((note) => note.startsWith(`${index} is left as it stood`))) {
    ws.leave(index, before.text);

    return;
  }

  const { rewritten, why } = whatChanged(ws, config, { before, after, command });

  // A table the command wrote out of its tables file is not kept by leaving the index: it is said, and the command goes on.
  rewritten.forEach((sentence) => {
    ws.note(`${index}: ${sentence}.`);
  });

  if (why.length === 0) {
    return;
  }

  const told = ws.notes.filter((note) => TOLD.some((said) => note.startsWith(`${index}${said}`)));
  const byHand = told.flatMap((note) => note.match(/^ {2}export .*$/gm) ?? []).map((line) => line.trim());
  const lines = command === 'init' ? [] : [...new Set([...written(before, after), ...byHand])];

  ws.notes.splice(0, ws.notes.length, ...ws.notes.filter((note) => !told.includes(note)));
  ws.leave(index, before.text);
  ws.note(`${index} is left as it stood before the command: ${why.join('; ')}.${toDo(ws, config, { command, lines })}`);
}

/** How the notes a step of the command wrote about the names of the index start, after the path of the index: taken back with it. */
const TOLD = [' lists the ', ': the kit wrote no name in it', ' imported ', ' imports '];

/** What the command would change: the tables it wrote out of a tables file, said alone, and the tables it would lose or the names it would move, which leave the index. */
function whatChanged(
  ws: Workspace,
  config: Config,
  { before, after }: Compared,
): { rewritten: string[]; why: string[] } {
  const gone = config.stack.orm === 'typeorm' ? 'listed no more' : 'under no name';
  const sources = workspaceSources(ws, config);
  const lost = [...before.reachable].filter((table) => !after.reachable.has(table));

  // With --force a tables file is written again whole: a table it held and the command does not declare is gone from it.
  const isRewritten = (table: string): boolean => {
    const [file = '', name = ''] = table.split('#');

    return ws.read(file) !== undefined && !readTablesFile(sources, file).symbols.some((symbol) => symbol.name === name);
  };

  const moved = [...before.names].flatMap(([name, was]) => {
    const is = after.names.get(name);

    return is === undefined || is === was ? [] : [`\`${name}\`, which exported ${was}, would export ${is}`];
  });

  return {
    rewritten: lost.filter(isRewritten).map((table) => {
      const [file = '', name = ''] = table.split('#');

      return `\`${name}\` is no more in ${file}, which the command wrote again without it: restore its declaration there, as git holds it${config.stack.orm === 'typeorm' ? ', or the index, which still imports it, does not compile' : ''}`;
    }),
    why: [...lost.filter((table) => !isRewritten(table)).map((table) => `${table} would be ${gone}`), ...moved],
  };
}

/** What to do about it: the lines of a generation, to write by hand, and what leaving them out costs; for `init --force`, where the line belongs. */
function toDo(
  ws: Workspace,
  config: Config,
  { command, lines }: { command: string; lines: readonly string[] },
): string {
  if (command === 'init') {
    const where =
      config.stack.orm === 'typeorm'
        ? 'its import inside the `// ddd-ts-kit:imports` region and its entry inside the `// ddd-ts-kit:schemas` region of `entities`, which the rewrite keeps,'
        : 'the line that keeps this table inside the `// ddd-ts-kit:schemas` region, which the rewrite keeps,';

    return ` \`init --force\` writes the index again from its template, and a line written outside the regions of the kit goes with it: move ${where} and run the command again. Until then every \`init --force\` leaves the index as it stood and exits 3.`;
  }

  if (lines.length === 0) {
    return '';
  }

  const unlisted = lines.flatMap((line) => {
    const context = contextOfSource(ws, config, /^export \* from '([^']+)'/.exec(line)?.[1] ?? '');

    return context === undefined ? [] : [context];
  });

  const cost =
    unlisted.length === 0
      ? ''
      : ` Until these lines are written, the tables of ${unlisted.join(', ')} are listed nowhere: no migration will create them.`;

  return ` To write by hand, where it is right:\n${lines.map((line) => `  ${line}`).join('\n')}\n${cost.trimStart()}`.trimEnd();
}

/** The lines the command wrote in the regions of the index, or anywhere in it. */
function written(before: IndexPicture, after: IndexPicture): string[] {
  const linesOf = (text: string): string[] =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');

  const stood = new Set(linesOf(before.text ?? ''));
  const held = [...(after.text ?? '').matchAll(REGION)].map(([, lines = '']) => lines).join('\n');

  return linesOf(held).filter((line) => !stood.has(line));
}
