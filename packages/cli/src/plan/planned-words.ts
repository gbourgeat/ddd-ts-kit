import fs from 'node:fs';
import path from 'node:path';
import type { Glossary } from '../check/language/parse-glossary';
import { parseGlossary } from '../check/language/parse-glossary';
import { technicalWordsOf } from '../check/language/technical-words-of';
import { unknownWords } from '../check/language/unknown-words';
import { generateArguments } from '../commands/generate';
import { findKind } from '../generate/find-kind';
import type { HeardName } from '../generate/language-probe';
import { toName } from '../naming';
import type { Slice } from '../progress/slice';
import { plannedCommands } from './planned-commands';
import type { Replay } from './replay';
import type { RowProblem } from './wave-plan';

/** A name refused for a word, with the words: the same word refused again in the row is said once, at its first name. */
export type Judged = RowProblem & { readonly words: readonly string[] };

/**
 * The names a replayed command introduced that a worker following its row would have refused for
 * a word: each judged against the glossary of its context as it stands, with the `--term` of its
 * row and of the rows it waits for, transitively, what that worker would have when they run it.
 */
export function plannedWords(root: string, rows: readonly Slice[]): (replay: Replay) => Judged[] {
  const termsOf = rowTerms(rows);

  return (replay) => {
    const terms = termsOf(replay.row);

    return replay.heard.flatMap((heard) => judged({ ...replay, heard }, glossaryFor(root, heard, terms)));
  };
}

/** The glossary a name is judged against: its context's as it stands, and the terms the rows add to that context. */
function glossaryFor(root: string, heard: HeardName, added: ReadonlyMap<string, readonly string[]>): Glossary {
  const doc = path.join(root, heard.dir, 'CONTEXT.md');
  const standing = fs.existsSync(doc) ? parseGlossary(fs.readFileSync(doc, 'utf8')).terms : [];

  return { terms: [...standing, ...(added.get(heard.context) ?? [])], line: undefined, lastRowLine: undefined };
}

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

/**
 * The terms a row can count on, by context: the `--term` of its own commands and of the rows it
 * waits for, transitively, each given to the context its command writes in.
 */
function rowTerms(rows: readonly Slice[]): (row: Slice) => ReadonlyMap<string, readonly string[]> {
  const byId = new Map(rows.map((row) => [row.id, row]));
  // Each command is read once, and the terms of a row once, however many of its commands are replayed.
  const own = new Map(rows.map((row) => [row, termsOfCommands(row)]));
  const counted = new Map<Slice, ReadonlyMap<string, readonly string[]>>();

  return (row) => {
    const known = counted.get(row);

    if (known !== undefined) {
      return known;
    }

    const terms = new Map<string, string[]>();
    const seen = new Set<string>();
    const queue = [row];

    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      if (seen.has(next.id)) {
        continue;
      }

      seen.add(next.id);
      queue.push(...next.dependsOn.flatMap((id) => byId.get(id) ?? []));

      for (const read of own.get(next) ?? termsOfCommands(next)) {
        terms.set(read.context, [...(terms.get(read.context) ?? []), ...read.terms]);
      }
    }

    counted.set(row, terms);

    return terms;
  };
}

/** The terms each command of a row gives, with the context it gives them to. */
function termsOfCommands(row: Slice): CommandTerms[] {
  return plannedCommands(row.startWith).flatMap(({ argv }) => readCommand(argv) ?? []);
}

interface CommandTerms {
  readonly context: string;
  readonly terms: readonly string[];
}

/**
 * The context a generator command writes in, its first argument after the kind for a kind that
 * takes one or that creates it, and the terms of its `--term "<Term>=<meaning>"`, read as the generator reads them:
 * nothing for a command it cannot read, which the replay reports.
 */
function readCommand(argv: readonly string[]): CommandTerms | undefined {
  try {
    const args = generateArguments(argv);
    const [kindName = '', context] = args.positionals;

    const terms = args.many('term').flatMap((value) => {
      const term = value.split('=')[0]?.trim() ?? '';

      return term === '' ? [] : [term];
    });

    const kind = findKind(kindName);
    // `generate context <name>` writes the glossary of the context it creates.
    const inContext = kind?.positionals[0] === 'context' || kind?.name === 'context';

    return inContext && context !== undefined ? { context: toName(context).kebab, terms } : undefined;
  } catch {
    return undefined;
  }
}
