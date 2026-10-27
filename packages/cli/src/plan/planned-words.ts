import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Glossary } from '../check/language/parse-glossary';
import { parseGlossary } from '../check/language/parse-glossary';
import { technicalWordsOf } from '../check/language/technical-words-of';
import { unknownWords } from '../check/language/unknown-words';
import { findKind } from '../generate/find-kind';
import type { HeardName, LanguageProbe } from '../generate/language-probe';
import { toName } from '../naming';
import type { Slice } from '../progress/slice';
import { type PlannedCommand, plannedCommands } from './planned-commands';
import { rowsToPlan } from './rows-to-plan';
import type { NotReplayed, PlanProblem } from './wave-plan';
import { waveNumbers } from './wave-numbers';

/** Runs `generate` with the arguments that follow it, hearing its names with the probe; throws what the generator refuses. */
type Generate = (argv: readonly string[], language: LanguageProbe) => void;

export interface WordsRequest {
  /** The context whose rows to judge; null for every row. */
  readonly context: string | null;
  readonly generate: Generate;
}

/** What the replay of the planned commands found. */
export interface PlannedWords {
  /** The names a worker following the rows would have refused, for a word: one per name and row. */
  readonly problems: readonly PlanProblem[];
  /** The commands the generator refused for another reason: the names they would have introduced after it are not judged. */
  readonly notReplayed: readonly NotReplayed[];
}

/** Directories never copied when the project is not a git repository. */
const NOT_COPIED = new Set(['node_modules', '.git', 'dist', 'coverage', '.worktrees']);

/**
 * Replays the generator commands of the rows not done, in a copy of the project, in the order of
 * their waves, so that each command finds what the rows before it generate. The generator itself
 * says which names each command introduces; each is judged against the glossary of its context as
 * it stands, with the `--term` of its row and of the rows it waits for, transitively: what a worker
 * following that row would have when they run it.
 */
export function plannedWords(root: string, rows: readonly Slice[], request: WordsRequest): PlannedWords {
  const planned = rowsToPlan(rows, request.context);
  const waves = waveNumbers(planned);
  const ordered = [...planned].sort((left, right) => (waves.get(left.id) ?? 0) - (waves.get(right.id) ?? 0));
  const termsOf = rowTerms(rows);
  const copy = copyOfProject(root);

  try {
    const inCopy: Generate = (argv, language) => request.generate([...argv, '--cwd', copy], language);

    const replays = ordered.flatMap((row) =>
      plannedCommands(row.startWith).map((command) => replayed(row, command, inCopy)),
    );

    return {
      problems: firstOfEachWord(
        replays.flatMap((replay) => {
          const terms = termsOf(replay.row);

          return replay.heard.flatMap((heard) => judged({ ...replay, heard }, glossaryFor(root, heard, terms)));
        }),
      ),
      notReplayed: replays.flatMap(({ row, command, refusal }) =>
        refusal === undefined ? [] : [{ row: row.id, command, refusal }],
      ),
    };
  } finally {
    fs.rmSync(copy, { recursive: true, force: true });
  }
}

/** One planned command run in the copy: the names the generator introduced, and what it refused if it did. */
interface Replay {
  readonly row: Slice;
  /** As the row writes it. */
  readonly command: string;
  readonly heard: readonly HeardName[];
  readonly refusal: string | undefined;
}

function replayed(row: Slice, { text, argv }: PlannedCommand, generate: Generate): Replay {
  const heard: HeardName[] = [];

  try {
    generate(argv, (name) => heard.push(name));

    return { row, command: text, heard, refusal: undefined };
  } catch (error) {
    return { row, command: text, heard, refusal: error instanceof Error ? error.message : String(error) };
  }
}

/** The glossary a name is judged against: its context's as it stands, and the terms the rows add to that context. */
function glossaryFor(root: string, heard: HeardName, added: ReadonlyMap<string, readonly string[]>): Glossary {
  const doc = path.join(root, heard.dir, 'CONTEXT.md');
  const standing = fs.existsSync(doc) ? parseGlossary(fs.readFileSync(doc, 'utf8')).terms : [];

  return { terms: [...standing, ...(added.get(heard.context) ?? [])], line: undefined, lastRowLine: undefined };
}

/** A name refused for a word, with the words: the same word refused again in the row is said once, at its first name. */
type Judged = PlanProblem & { readonly words: readonly string[] };

/** One name a command of a row introduced. */
interface Introduced {
  readonly row: Slice;
  readonly command: string;
  readonly heard: HeardName;
}

function judged({ row, command, heard }: Introduced, glossary: Glossary): Judged[] {
  const technical = technicalWordsOf(heard.name, glossary);
  const unknown = unknownWords(heard.name, glossary, heard.qualifiers);
  const at = `#${row.id} \`${command}\`: "${heard.name}"`;

  return [
    ...(technical.length === 0
      ? []
      : [
          {
            kind: 'technical-word' as const,
            rows: [row.id],
            words: technical,
            message: `${at} carries the technical word ${quoted(technical)}: use the word of the business, or define the term that holds it with --term in this row or a row it depends on`,
          },
        ]),
    ...(unknown.length === 0
      ? []
      : [
          {
            kind: 'undefined-word' as const,
            rows: [row.id],
            words: unknown,
            message: `${at} uses ${quoted(unknown)}, which the glossary of ${heard.context} does not define: add ${unknown.map((word) => `--term "${toName(word).pascal}=<what it means for the business>"`).join(' ')} to this row or to a row it depends on`,
          },
        ]),
  ];
}

function quoted(words: readonly string[]): string {
  return words.map((word) => `"${word}"`).join(', ');
}

/** Each word once per row, at the first name that carries it: a name whose words were all said already is left out. */
function firstOfEachWord(problems: readonly Judged[]): PlanProblem[] {
  const said = new Set<string>();

  return problems.flatMap(({ words, ...problem }) => {
    const fresh = words.filter((word) => !said.has(`${problem.kind} ${problem.rows.join()} ${word}`));

    for (const word of fresh) {
      said.add(`${problem.kind} ${problem.rows.join()} ${word}`);
    }

    return fresh.length === 0 ? [] : [problem];
  });
}

/**
 * The terms a row can count on, by context: the `--term` of its own commands and of the rows it
 * waits for, transitively, each given to the context its command writes in.
 */
function rowTerms(rows: readonly Slice[]): (row: Slice) => ReadonlyMap<string, readonly string[]> {
  const byId = new Map(rows.map((row) => [row.id, row]));

  return (row) => {
    const terms = new Map<string, string[]>();
    const seen = new Set<string>();
    const queue = [row];

    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      if (seen.has(next.id)) {
        continue;
      }

      seen.add(next.id);
      queue.push(...next.dependsOn.flatMap((id) => byId.get(id) ?? []));

      for (const { argv } of plannedCommands(next.startWith)) {
        const context = contextOf(argv);

        if (context !== undefined) {
          terms.set(context, [...(terms.get(context) ?? []), ...termFlags(argv)]);
        }
      }
    }

    return terms;
  };
}

/** The context a generator command writes in: its first argument after the kind, for a kind that takes one. */
function contextOf([kindName = '', context]: readonly string[]): string | undefined {
  return findKind(kindName)?.positionals[0] === 'context' && context !== undefined ? toName(context).kebab : undefined;
}

/** The terms of `--term "<Term>=<meaning>"` and `--term=<Term>=<meaning>`. */
function termFlags(argv: readonly string[]): string[] {
  return argv.flatMap((word, index) => {
    const value = word === '--term' ? argv[index + 1] : word.startsWith('--term=') ? word.slice(7) : undefined;
    const term = value?.split('=')[0]?.trim() ?? '';

    return term === '' ? [] : [term];
  });
}

/** A copy of the project, its sources only, in a directory of its own that the caller removes. */
function copyOfProject(root: string): string {
  const copy = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-plan-'));

  for (const file of sourceFiles(root)) {
    fs.mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
    fs.copyFileSync(path.join(root, file), path.join(copy, file));
  }

  return copy;
}

/** The files git sees, tracked or not, the ignored ones left out; every file outside the build folders when git does not answer. */
function sourceFiles(root: string): string[] {
  const listed = spawnSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 1 << 28,
  });

  if (listed.status === 0) {
    return listed.stdout
      .split('\0')
      .filter((file) => file !== '' && fs.statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile());
  }

  return walk(root, '');
}

function walk(root: string, directory: string): string[] {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return NOT_COPIED.has(entry.name) ? [] : walk(root, relative);
    }

    return entry.isFile() ? [relative] : [];
  });
}
