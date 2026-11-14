import path from 'node:path';
import type { Config } from '../config';
import { indexExports } from '../generate/kinds/same-name/index-exports';
import { indexPicture } from '../generate/kinds/same-name/index-picture';
import type { IndexReading } from '../generate/kinds/same-name/index-reading';
import { notSettled } from '../generate/kinds/same-name/not-settled';
import type { FileReader } from '../generate/kinds/same-name/sources-of';
import { settleSameEntities } from '../generate/kinds/same-name/settle-same-entities';
import { settleSameNames } from '../generate/kinds/same-name/settle-same-names';
import { workspaceIndex } from '../generate/kinds/same-name/workspace-index';
import { yieldToTheTrunk } from '../generate/kinds/same-name/yield-to-the-trunk';
import type { Workspace } from '../workspace';
import { linesAtMovedPlaces } from './lines-at-moved-places';
import { movedTablesFiles } from './moved-tables-files';
import { sideIndex } from './side-index';
import { twoTablesFiles } from './two-tables-files';
import { cannotWrite } from '../workspace/cannot-write';

/** The two sides of a merge, each read as its commit holds it. */
export interface MergedSides {
  readonly onTrunk: FileReader;
  readonly onBranch: FileReader;
}

/**
 * Settles the names of the index a workspace holds, the lines of both sides of a merge kept in it,
 * and answers what it did, in sentences. All or nothing: the index of the trunk, the one of the
 * branch and the merged one are each read with certainty, tables files included, or nothing is
 * written and a sentence says which file was not read and what the merge would have written.
 * Nothing reaches the disk before the caller commits the workspace: an error leaves the index as
 * the merge wrote it.
 */
export function tableNamesSettled(ws: Workspace, config: Config, sides: MergedSides): string[] {
  const index = `${config.platformDir}/database/schema.ts`;
  const before = ws.read(index);

  if (before === undefined) {
    return [];
  }

  switch (config.stack.orm) {
    case 'drizzle':
      return settledOnDrizzle(ws, config, { ...sides, index, before });
    case 'typeorm':
      return settledOnTypeorm(ws, config, sides);
    default:
      return [];
  }
}

/**
 * On TypeORM, an entity both sides imported keeps one name. Every entity the merged index listed
 * is listed after it, or the index is put back as the merge wrote it and nothing is told to the
 * lost-lines check: the merge then stops on what it lost, as it would without the kit.
 */
function settledOnTypeorm(ws: Workspace, config: Config, sides: MergedSides): string[] {
  const index = `${config.platformDir}/database/schema.ts`;

  const stale = whenLinesAtMovedPlaces(ws, config, sides);

  if (stale !== undefined) {
    return stale;
  }

  const before = indexPicture(ws, config);
  const said = settleSameEntities(ws, config, { onTrunk: sides.onTrunk(index) ?? '' });
  const lost = [...before.reachable].filter((entity) => !indexPicture(ws, config).reachable.has(entity));

  if (lost.length > 0) {
    ws.update(index, before.text ?? '');

    return [
      `${index} is left as the merge wrote it: settling the names of its imports would list no more ${lost.join(', ')}.`,
    ];
  }

  return said;
}

/** The merge of a Drizzle index: its two sides, and the index as the merge left it. */
interface DrizzleMerge extends MergedSides {
  readonly index: string;
  readonly before: string;
}

function settledOnDrizzle(ws: Workspace, config: Config, { onTrunk, onBranch, index, before }: DrizzleMerge): string[] {
  // Each side as its commit lays its contexts out, named in the layout of the merged tree.
  const trunk = sideIndex(ws, config, onTrunk);
  const branch = sideIndex(ws, config, onBranch);

  const nothing =
    whenTwoTablesFiles(ws, config, { trunk, branch }) ?? whenLinesAtMovedPlaces(ws, config, { onTrunk, onBranch });

  if (nothing !== undefined) {
    return nothing;
  }

  const unread = [
    ...trunk.unread.map((what) => `on the trunk, ${what}`),
    ...branch.unread.map((what) => `on the branch, ${what}`),
    ...workspaceIndex(ws, config).unread,
  ];

  const said = written(ws, config, trunk);
  const would = ws.read(index) ?? '';
  const merged = workspaceIndex(ws, config);
  const kept = valuesOf(merged);
  const standing = new Set(merged.stars.flatMap(({ symbols }) => symbols.map(({ origin }) => origin)));

  // A name of the trunk whose table the merged tree no longer holds is no name to keep: the branch took the table away.
  const broken = [...valuesOf(trunk)]
    .filter(([name, table]) => standing.has(table) && kept.get(name) !== table)
    .map(([name]) => name);

  const because = refusal({ unread, broken, isReadOnly: cannotWrite(path.join(ws.root, index)) });

  // Nothing to take back: what the settle said of it, if anything.
  if (would === before || because === undefined) {
    return [...said, ...afterTheMerge({ trunk, branch, merged })];
  }

  ws.update(index, before);

  // What it wrote is no hint when it gave a name of the trunk to another table.
  const lines = would.split('\n').filter((line) => line.trim() !== '' && !before.split('\n').includes(line));
  const refused = notSettled({ index, because, lines: broken.length > 0 ? [] : lines });

  return [refused, ...afterTheMerge({ trunk, branch, merged: workspaceIndex(ws, config) })];
}

/** When a line of the merged index names a place a side held a tables file at and the merged tree no longer holds: what is said of each. */
function whenLinesAtMovedPlaces(
  ws: Workspace,
  config: Config,
  { onTrunk, onBranch }: Pick<MergedSides, 'onTrunk' | 'onBranch'>,
): string[] | undefined {
  const moved = new Map([...movedTablesFiles(ws, config, onTrunk), ...movedTablesFiles(ws, config, onBranch)]);
  const said = linesAtMovedPlaces(ws, config, moved);

  return said.length === 0 ? undefined : said;
}

/** When a context holds two tables files that declare a name in common: that sentence, then what the merged index hides or moves. */
function whenTwoTablesFiles(
  ws: Workspace,
  config: Config,
  { trunk, branch }: Pick<Merged, 'trunk' | 'branch'>,
): string[] | undefined {
  const twice = twoTablesFiles(ws, config, trunk);

  return twice === undefined
    ? undefined
    : [twice.sentence, ...afterTheMerge({ trunk, branch, merged: workspaceIndex(ws, config), covered: twice.names })];
}

/** The index of each side of a merge, and the merged one as the command leaves it. */
interface Merged {
  readonly trunk: IndexReading;
  readonly branch: IndexReading;
  readonly merged: IndexReading;
  /** The names a sentence about two tables files of one context already covers: no hint is given for them. */
  readonly covered?: readonly string[];
}

/**
 * What the merged index does to what each side had, said whether the kit wrote in it or not, in a
 * dry run as in a real one: each table a side had within reach, still in the merged tree, that the
 * merged index exports under no name, with the name that hides it; and each name of a side that
 * names another table after the merge. The kit does not repair every such shape: it says them.
 */
function afterTheMerge({ trunk, branch, merged, covered = [] }: Merged): string[] {
  const kept = valuesOf(merged);
  const reached = new Set(kept.values());
  const standing = new Map(merged.stars.flatMap(({ symbols }) => symbols.map(({ origin, name }) => [origin, name])));
  const had = new Set([...valuesOf(trunk).values(), ...valuesOf(branch).values()]);

  const hidden = [...had]
    .filter((table) => standing.has(table) && !reached.has(table))
    .flatMap((table) => {
      const name = standing.get(table) ?? '';
      const hiding = kept.get(name);

      // The sentence about two tables files of one context says what to do of a name both declare.
      if (covered.includes(name)) {
        return [];
      }

      const why =
        hiding === undefined
          ? `several modules export \`${name}\` and no line gives it to one. No migration will hold it until the index names each: \`export { ${name} } from\` the file that keeps the name, \`export { ${name} as <another name> } from\` the other`
          : `\`${name}\` names ${described(hiding)}. No migration will hold it until a line of the index names it, \`export { ${name} as <another name> } from\` its file`;

      return [`${described(table)} is exported under no name after the merge: ${why}.`];
    });

  return [
    ...hidden,
    ...renamed(trunk, { kept, standing, side: 'trunk' }),
    ...renamed(branch, { kept, standing, side: 'branch' }),
  ];
}

/** A value of a module, by its name: a table, a schema or anything else the module exports. */
function described(table: string): string {
  const [file = '', constant = ''] = table.split('#');

  return `\`${constant}\` of '${file}'`;
}

/** Why what was settled in memory is not kept, when something keeps the kit from it. */
function refusal(found: {
  unread: readonly string[];
  broken: readonly string[];
  isReadOnly: boolean;
}): string | undefined {
  if (found.unread.length > 0) {
    return `it does not read with certainty ${found.unread.join('; ')}`;
  }

  if (found.broken.length > 0) {
    return `it did not find how to keep the names the trunk exports (${found.broken.join(', ')})`;
  }

  return found.isReadOnly ? 'the index cannot be written' : undefined;
}

/**
 * A name the trunk exports keeps naming the table of the trunk: a line of the branch that gave it
 * to another table moves first, then the whole index is settled, the table the trunk exports
 * under a name keeping it before any other and the contexts the branch brings after every other.
 */
function written(ws: Workspace, config: Config, trunk: IndexReading): string[] {
  const keeps = valuesOf(trunk);
  const isOnTrunk = (context: string): boolean => trunk.tables.some((tables) => tables.context === context);
  const newcomers = Object.keys(config.contexts).filter((context) => !isOnTrunk(context));

  return [
    ...yieldToTheTrunk(ws, config, trunk),
    ...settleSameNames(ws, config, { keeps, newcomers, whetherWritable: false }),
  ];
}

/** What the merged index exports, the tables the merged tree still holds, and the side whose names are compared. */
interface Compared {
  readonly kept: ReadonlyMap<string, string>;
  readonly standing: ReadonlyMap<string, string>;
  readonly side: 'trunk' | 'branch';
}

/** Each name of the index that named a table on a side and names another after the merge, or none: said, whatever moved it. */
function renamed(before: IndexReading, { kept, standing, side }: Compared): string[] {
  return [...valuesOf(before)]
    .filter(([name, table]) => kept.get(name) !== table && standing.has(table))
    .map(([name, table]) => {
      const now = kept.get(name);

      return `\`${name}\`, which the index of the ${side} exported as ${described(table)}, ${now === undefined ? 'is exported under no name it had' : `now names ${described(now)}`}: code of the ${side} that reads \`${name}\` from the index reads another value, or none.`;
    });
}

/** The value each name of an index exports, by the place that declares it. */
function valuesOf(reading: IndexReading): Map<string, string> {
  return new Map(
    [...indexExports(reading)].flatMap(([name, { value }]) => (value === undefined ? [] : [[name, value]])),
  );
}
