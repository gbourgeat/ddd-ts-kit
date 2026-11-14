import type { Config } from '../config';
import { indexExports } from '../generate/kinds/same-name/index-exports';
import type { IndexReading } from '../generate/kinds/same-name/index-reading';
import { readTablesFile } from '../generate/kinds/same-name/read-tables-file';
import { workspaceSources } from '../generate/kinds/same-name/workspace-sources';
import type { Workspace } from '../workspace';
import { tablesFilesHeld } from '../generate/kinds/same-name/tables-files-held';

/** What a merge leaves when a context holds two tables files that declare names in common. */
export interface TwoTablesFiles {
  readonly sentence: string;
  /** The names both files of a context declare. */
  readonly names: readonly string[];
}

/**
 * A context the merged tree holds two tables files for, one side having laid the context out in
 * modules, its tables file in `shared/`, while the other stored a table in the flat one, and the
 * two files declare values of one name, the schema of the context first: the index cannot tell
 * them apart, and the kit writes nothing in it. The sentence says the situation and what must
 * hold once a person made the two files one; the name the trunk's index exports is the one that
 * keeps it. Undefined when no context holds two such files.
 */
export function twoTablesFiles(ws: Workspace, config: Config, trunk: IndexReading): TwoTablesFiles | undefined {
  const sources = workspaceSources(ws, config);
  const onTrunk = indexExports(trunk);

  const held = Object.keys(config.contexts).flatMap((context) => heldTwice(ws, config, { context, sources }));

  if (held.length === 0) {
    return undefined;
  }

  const sentence = held.map((twice) => sentenceOf(config, { ...twice, onTrunk })).join('\n');

  return { sentence, names: held.flatMap(({ schemas, tables }) => [...schemas, ...tables]) };
}

/** The two tables files of a context and the names both declare, schemas apart; nothing when it holds one, or no name in common. */
function heldTwice(
  ws: Workspace,
  config: Config,
  { context, sources }: { context: string; sources: ReturnType<typeof workspaceSources> },
): Omit<HeldTwice, 'onTrunk'>[] {
  const [kept = '', ...others] = tablesFilesHeld(
    config,
    (file) => (ws.existsAsIs(file) ? ws.read(file) : undefined),
    context,
  );

  const valuesOf = (file: string): string[] =>
    readTablesFile(sources, file).symbols.flatMap(({ name, kind }) => (kind === 'value' ? [name] : []));

  const ofKept = new Set(valuesOf(kept));
  const names = [...new Set(others.flatMap(valuesOf).filter((name) => ofKept.has(name)))];

  // A schema constant is no table: a person keeps one, and builds the tables of the other file on it.
  const isSchema = (name: string): boolean =>
    [kept, ...others].some((file) =>
      new RegExp(`\\bconst ${name}\\b[^=;]*=\\s*(?:pgSchema|contextSchema)\\(`).test(ws.read(file) ?? ''),
    );

  return names.length === 0
    ? []
    : [
        {
          context,
          kept,
          flat: others.join(', '),
          schemas: names.filter(isSchema),
          tables: names.filter((name) => !isSchema(name)),
        },
      ];
}

/** A context with two tables files that declare names in common, and what the trunk's index exports. */
interface HeldTwice {
  readonly context: string;
  readonly kept: string;
  readonly flat: string;
  /** The schema constants both declare. */
  readonly schemas: readonly string[];
  /** The other values both declare: tables. */
  readonly tables: readonly string[];
  readonly onTrunk: ReturnType<typeof indexExports>;
}

/** The situation, and what must hold once a person made the two files one. */
function sentenceOf(config: Config, held: HeldTwice): string {
  const { context, kept, flat, schemas, tables } = held;
  const all = [...schemas, ...tables].map((name) => `\`${name}\``).join(', ');

  const onSchemas = schemas.map((name) => `; the \`${name}\` of ${flat} goes, its tables built on the one of ${kept}`);

  const onTables =
    tables.length === 0
      ? ''
      : `; where both declare one table name, ${keeperOf(held)} and the other takes a new name, in every file that imports it (its repository, its mapper)`;

  return `${config.platformDir}/database/schema.ts: the kit wrote no name in it, nor any other line of this merge: the merged tree holds two tables files for ${context}, ${kept} and ${flat}, and both declare ${all}. Make them one file, ${kept}, by hand: every table of ${flat} goes there, built on the schema ${kept} declares${onSchemas.join('')}${onTables}. Then delete ${flat} and the \`export *\` line of the index that names it, and write every other import and every other line of the index that names ${flat} to name ${kept}. Then commit and run \`npx ddd-ts-kit init --force\`.`;
}

/** Which table keeps each name both files declare: the one of the two files the trunk's index exports it from, under that name or another. */
function keeperOf({ kept, flat, tables, onTrunk }: HeldTwice): string {
  const keepers = tables.flatMap((name) => {
    const fromTheTrunk = [...onTrunk].find(
      ([, { value }]) => value === `${kept}#${name}` || value === `${flat}#${name}`,
    );

    const [file = ''] = fromTheTrunk?.[1].value?.split('#') ?? [];

    return fromTheTrunk === undefined
      ? []
      : [`\`${name}\`: ${file}, which the trunk's index exports as \`${fromTheTrunk[0]}\``];
  });

  return keepers.length === 0
    ? 'decide which one keeps it'
    : `the one of the two files the trunk's index exports it from keeps it (${keepers.join('; ')})`;
}
