import path from 'node:path';
import type { Config } from '../../../config';
import { toName } from '../../../naming/to-name';
import { regionsOf } from '../../../markers';
import type { Workspace } from '../../../workspace';
import { cannotWrite } from '../../../workspace/cannot-write';
import { applyWiring } from '../../apply-wiring';
import { freeName } from './free-name';
import { hiddenSymbols } from './hidden-symbols';
import { type IndexReading, readIndex } from './index-reading';
import { linesToSettle, type SettleLine, type SettleOrder } from './lines-to-settle';
import { mayShare } from './may-share';
import { notSettled } from './not-settled';
import { tablesFileOf } from './tables-file-of';
import { workspaceIndex } from './workspace-index';

/** How the names are settled, and whether a file that cannot be written is the caller's to say. */
interface Settling extends SettleOrder {
  /** `merge-trunk` settles in memory, then says itself what it could not write. */
  readonly whetherWritable?: boolean;
  /** The `export *` lines the command meant to write: one the index lacks, for want of a region, is given with the lines to write by hand. */
  readonly stars?: readonly string[];
}

/**
 * The schema index of a Drizzle project re-exports the tables file of each context whole, which is
 * how a table added by hand reaches the migrations. A constant two contexts export, the table of
 * the same name in each, is then exported twice: the index does not compile, and what loads it
 * finds one table or none under that name. So is a constant the index declares itself, `jobs` or
 * `outbox`, hidden without a word. The index settles each by name, below its `export *` lines, the
 * whole index at once whichever command asks (`linesToSettle`): a generator settles every name it
 * meets, not only those of its context, as `init --force` and `merge-trunk` do.
 *
 * All or nothing, and said once. Lines are written only on a reading that is certain, in an index
 * that holds its region and can be written; else nothing is written, and one sentence says why,
 * with the lines to write by hand. Once written, the index is read again: every constant of every
 * tables file must be exported under a name, a value as a value: a line written `export type`
 * never counts for a table. If one is not, or anything goes wrong, the index is
 * put back as it was, and the sentence says so. No line of the index is ever removed. With no
 * name to settle among what was read, nothing is said, unless a file that is not read may hold one. Answers what it did, in sentences.
 */
export function settleSameNames(ws: Workspace, config: Config, settling: Settling = {}): string[] {
  const index = `${config.platformDir}/database/schema.ts`;
  const before = ws.read(index);

  if (before === undefined) {
    return [];
  }

  try {
    // A line the command could not write, the index holding no region, is read as if it stood there: the lines to write by hand are those of the index it gives.
    const missing = (settling.stars ?? []).filter((star) => !before.includes(star));
    const reading = readAs(ws, config, [before, ...missing].join('\n'));
    const lines = [...missing, ...linesToSettle(reading, settling).map(({ line }) => line)];

    if (lines.length === missing.length) {
      return unseen(ws, config, reading);
    }

    const refused = refusal(ws, { index, before, unread: reading.unread, settling });

    return refused === undefined
      ? written(ws, config, { index, before, lines: linesToSettle(reading, settling) })
      : [notSettled({ index, because: refused, lines })];
  } catch (error) {
    ws.update(index, before);

    return [notSettled({ index, because: `reading it and its tables files failed (${String(error)})`, lines: [] })];
  }
}

/** The index of the workspace read as if it held this text. */
function readAs(ws: Workspace, config: Config, text: string): IndexReading {
  const index = `${config.platformDir}/database/schema.ts`;

  return readIndex(config, {
    index,
    read: (file) => (file === index ? text : ws.read(file)),
    tablesFile: (context) => tablesFileOf(ws, config, context),
    place: (file) => ws.placed(file),
  });
}

/**
 * Nothing to settle among what was read. Something that is not read with certainty may still
 * export the name of a value of a tables file: said when that name is written in it, with the line
 * that gives the value a name of its own. Silent otherwise.
 */
function unseen(ws: Workspace, config: Config, reading: IndexReading): string[] {
  const shared = reading.unread.length === 0 ? [] : mayShare(ws, config, reading);

  if (shared.length === 0) {
    return [];
  }

  const names = [...new Set(shared.map(({ name }) => `\`${name}\``))].join(', ');
  const taken = new Set(reading.stars.flatMap(({ symbols }) => symbols.map(({ name }) => name)));

  const lines = shared.map(({ name, context, source }) => {
    const alias = freeName(
      toName(context),
      name,
      (candidate) => taken.has(candidate) || reading.text.includes(candidate),
    );

    return `export { ${name} as ${alias} } from '${source}';`;
  });

  const because = `it does not read with certainty ${reading.unread.join('; ')}, which may export ${names}, a name a tables file exports: if it does, one of the two is under no name, and needs a line by name`;

  return [notSettled({ index: reading.index, because, lines })];
}

/** The index of a settle: where it is, what it held, what is not read with certainty, and how it is settled. */
interface Asked {
  readonly index: string;
  readonly before: string;
  readonly unread: readonly string[];
  readonly settling: Settling;
}

/** Why nothing may be written, when something keeps the kit from it. */
function refusal(ws: Workspace, { index, before, unread, settling }: Asked): string | undefined {
  if (unread.length > 0) {
    return `it does not read with certainty ${unread.join('; ')}`;
  }

  if (!regionsOf(before.split('\n')).some(({ name }) => name === 'schemas')) {
    return 'the index holds no `// ddd-ts-kit:schemas` region to write them in';
  }

  return settling.whetherWritable !== false && cannotWrite(path.join(ws.root, index))
    ? 'the index cannot be written'
    : undefined;
}

/** The lines written, the index read again: every constant under a name, or the index put back. */
function written(
  ws: Workspace,
  config: Config,
  { index, before, lines }: { index: string; before: string; lines: readonly SettleLine[] },
): string[] {
  for (const { line } of lines) {
    applyWiring(ws, index, `@@schemas\n${line}\n`);
  }

  const ended = workspaceIndex(ws, config);
  const hidden = [...hiddenSymbols(ended), ...ended.unread];

  if (hidden.length > 0) {
    ws.update(index, before);

    return [
      notSettled({
        index,
        because: `what it was about to write would leave under no name ${hidden.join(', ')}`,
        lines: lines.map(({ line }) => line),
      }),
    ];
  }

  return lines.flatMap(({ context, constant, alias, isType }) =>
    alias === undefined
      ? []
      : [
          `${index} lists the ${isType ? 'type' : 'name'} \`${constant}\` of ${context} as \`${alias}\`: another module, or the index itself, holds the name \`${constant}\`. The tables file and what reads it keep that name.`,
        ],
  );
}
