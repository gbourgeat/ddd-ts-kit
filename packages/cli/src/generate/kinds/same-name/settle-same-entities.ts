import { scan } from '../../../check/scan/scan';
import { escapeRegExp } from '../../../check/text/escape-reg-exp';
import type { Config } from '../../../config';
import { toName } from '../../../naming/to-name';
import type { Workspace } from '../../../workspace';
import { applyWiring } from '../../apply-wiring';
import { bindingOf } from './binding-of';
import { type Bound, boundBy, type EntityOf } from './bound-by';
import { contextOfSource } from './context-of-source';
import { entitiesNotOnceEach } from './entities-not-once-each';
import { type EntityReading, entityReading } from './entity-reading';
import { declaredEntityOf } from './declared-entity-of';
import { freeName } from './free-name';
import { listedOnce } from './listed-once';
import { lineTheKitDidNotWrite } from './line-the-kit-did-not-write';
import { tablesConstants } from './tables-constants';
import { tablesFilesHeld } from './tables-files-held';
import { workspaceSources } from './workspace-sources';

/** What a merge tells the settle, and learns from it. */
interface MergedEntities {
  /** The index of the trunk: its imports keep their names. */
  readonly onTrunk?: string;
}

/** What every step of a settle reads the index with. */
interface Reading {
  readonly index: string;
  readonly entityOf: EntityOf;
}

/** What a step of the settle said, and the names it left to the team. */
interface Said {
  readonly said: string[];
  readonly left: Set<string>;
}

/** One name two imports give, as the region holds it, and the names left to the team so far. */
interface SharedName {
  readonly index: string;
  readonly name: string;
  readonly imports: readonly Bound[];
  readonly listed: number;
  readonly left: Set<string>;
}

/**
 * The schema index of a TypeORM project imports each entity by name. A name two statements import,
 * the entity of the same name of two contexts as a merge of two branches leaves them, does not
 * compile, and its one entry lists one table for the two. The second import is written under a
 * name that carries its context, `orders as shippingOrders`, and listed under it; the first keeps
 * the name and its entry. Only that shape is settled: any other (three imports of one name, one
 * entity twice, two entries) is left to the team, in one sentence per name. In a merge, the
 * imports of the trunk keep their names. Only an index the kit wrote whole is settled, and what the
 * settle leaves is checked: every entity it touched under one name listed once, no name on another
 * entity, else the index is put back. Answers what it did, in sentences.
 */
export function settleSameEntities(ws: Workspace, config: Config, merge: MergedEntities = {}): string[] {
  const { onTrunk = '' } = merge;
  const index = `${config.platformDir}/database/schema.ts`;
  const before = ws.read(index);

  try {
    if (before === undefined) {
      return [];
    }

    const entityOf = declaredEntityOf(ws, config);

    // Only what the kit wrote in its region is settled, and only in an index the kit wrote whole: a line of the team may read any name.
    if (!hasTwice(entityReading(before, entityOf))) {
      return [];
    }

    const foreign = lineTheKitDidNotWrite(ws, config, before);

    if (foreign !== undefined) {
      return [notWritten(index, foreign)];
    }

    return checked(ws, { index, entityOf, before }, settledWhole(ws, config, { index, entityOf, onTrunk }));
  } catch (error) {
    ws.update(index, before ?? '');

    return [
      `${index}: the kit rewrote no import of it: reading it failed (${String(error)}). An entity imported twice under one name is written \`<entity> as <another name>\` by hand, and that name listed in \`entities\`.`,
    ];
  }
}

/** The two steps of a settle: an entity under two names listed once, then a name two entities share told apart. */
function settledWhole(
  ws: Workspace,
  config: Config,
  { index, entityOf, onTrunk }: Reading & { onTrunk: string },
): Said {
  const once = listedOnce(ws, { index, onTrunk, entityOf });
  const keepers = boundBy(onTrunk, entityOf).map(bindingOf);
  const names = entitiesSettled(ws, config, { index, keepers, entityOf });

  return { said: [...once, ...names.said], left: names.left };
}

/** What the settle left, held to every entity once: else the index goes back as it stood, and the sentences with it. */
function checked(
  ws: Workspace,
  { index, entityOf, before }: Reading & { before: string },
  { said, left }: Said,
): string[] {
  const wrong = entitiesNotOnceEach({
    before: entityReading(before, entityOf),
    after: entityReading(ws.read(index) ?? '', entityOf),
    left,
  });

  if (wrong === undefined) {
    return said;
  }

  ws.update(index, before);

  return [
    `${index}: the kit put the index back as it stood: what it wrote would leave ${wrong}; give each entity one import under its own name, and list each name once, by hand.`,
  ];
}

/**
 * The one sentence of an index that holds a line the kit did not write. Outside the regions such a
 * line is most often one of the template of an earlier version: writing the index again from the
 * template of this one settles the names.
 */
function notWritten(
  index: string,
  { line, text, inRegion }: { line: number; text: string; inRegion: boolean },
): string {
  const again = inRegion
    ? ''
    : '; run `npx ddd-ts-kit init --force` after a commit to write the index again from the template of this version: it settles the names then';

  return `${index}: the kit wrote nothing for the entities: the index holds a line the kit did not write (line ${line}: \`${text.trim()}\`); import the entities of one name under two names by hand${again}.`;
}

/** Whether two imports of the region give one name, or one entity two names: what a settle would rewrite. */
function hasTwice({ bound }: EntityReading): boolean {
  const locals = bound.map(({ local }) => local);
  const entities = bound.map(({ entity }) => entity);

  return new Set(locals).size < locals.length || new Set(entities).size < entities.length;
}

/**
 * Each name the region imports more than once, in its order: told apart when it is in the one shape
 * the kit settles, two imports of two entities each bound under that name alone and one entry; left
 * to the team otherwise, with what the index holds.
 */
function entitiesSettled(ws: Workspace, config: Config, settling: Reading & { keepers: readonly string[] }): Said {
  const { index, keepers, entityOf } = settling;
  const said: string[] = [];
  const left = new Set<string>();
  const seen = new Set<string>();
  let name = sharedName(entityReading(ws.read(index) ?? '', entityOf), seen);

  while (name !== undefined) {
    const reading = entityReading(ws.read(index) ?? '', entityOf);
    const imports = reading.bound.filter(({ local }) => local === name);
    const shared = { index, name, imports, listed: reading.listed.filter((entry) => entry === name).length, left };

    const pair = settledPair(reading, shared);

    seen.add(name);
    said.push(pair === undefined ? nameLeft(ws, config, shared) : nameSettled(ws, config, { shared, keepers, pair }));

    name = sharedName(entityReading(ws.read(index) ?? '', entityOf), seen);
  }

  return { said, left };
}

function sharedName({ bound }: EntityReading, seen: ReadonlySet<string>): string | undefined {
  return bound.find(({ local }) => !seen.has(local) && bound.filter((held) => held.local === local).length > 1)?.local;
}

/** The two imports of the one shape a name is settled in: two entities, each under that name alone, and one entry. */
function settledPair(
  { bound }: EntityReading,
  { name, imports, listed }: SharedName,
): readonly [Bound, Bound] | undefined {
  const [one, other, ...more] = imports;
  const isElsewhere = imports.some(({ entity }) => bound.some((held) => held.entity === entity && held.local !== name));
  const isAnyNotTold = imports.some(({ told }) => !told);

  return one === undefined ||
    other === undefined ||
    more.length > 0 ||
    one.entity === other.entity ||
    listed !== 1 ||
    isElsewhere ||
    isAnyNotTold
    ? undefined
    : [one, other];
}

/** The import the kit renames, the second in the order of the index unless only it is the trunk's, written under an alias. */
function nameSettled(
  ws: Workspace,
  config: Config,
  { shared, keepers, pair }: { shared: SharedName; keepers: readonly string[]; pair: readonly [Bound, Bound] },
): string {
  const { index, name, left } = shared;
  const [first, second] = pair;
  const twice = keepers.includes(bindingOf(second)) && !keepers.includes(bindingOf(first)) ? first : second;
  const context = contextOfSource(ws, config, twice.source);

  if (context === undefined) {
    left.add(name);

    return `${index} imports \`${name}\` twice, and the kit cannot rewrite the second import, from '${twice.source}' (${whyNot(ws, config, twice.source)}): write it \`${twice.name} as <another name>\` by hand and list that name in \`entities\`.`;
  }

  return settled(ws, config, { index, context, twice });
}

/** A name in any other shape: the kit writes nothing for it, and says what the index holds. */
function nameLeft(ws: Workspace, config: Config, { index, name, imports, listed, left }: SharedName): string {
  const contextOf = (bound: Bound): string => contextOfSource(ws, config, bound.source) ?? `'${bound.source}'`;
  const [one, other, ...more] = imports;

  left.add(name);

  const unknown = notToldApart(index, { name, imports });

  if (unknown !== undefined) {
    return unknown;
  }

  if (one !== undefined && other !== undefined && more.length === 0 && one.entity === other.entity && listed === 1) {
    return `${index}: imports the entity \`${one.name}\` of ${contextOf(one)} twice under one name; the kit wrote nothing for it: take out one of the two imports.`;
  }

  const which = imports.map((bound) => `\`${bound.name}\` of ${contextOf(bound)}`).join(', ');

  return `${index}: imports \`${name}\` ${times(imports.length)} (${which}) and lists it ${times(listed)}; the kit wrote nothing for it: keep one import of each entity, each under its own name, and list each name once.`;
}

/** A name whose imports the kit cannot tell apart: one of them is of no tables file that declares the name itself. */
function notToldApart(index: string, { name, imports }: Pick<SharedName, 'name' | 'imports'>): string | undefined {
  const untold = imports.find(({ told }) => !told);

  return untold === undefined
    ? undefined
    : `${index}: imports \`${name}\` ${times(imports.length)} and the kit cannot tell the entities apart: '${untold.file ?? untold.source}' does not declare \`${untold.name}\` itself; the kit wrote nothing for it: import each entity from the tables file that declares it.`;
}

function times(count: number): string {
  return count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`;
}

/** Why the kit cannot rewrite an import: its module is a second tables file of a context, or no tables file at all. */
function whyNot(ws: Workspace, config: Config, source: string): string {
  const resolved = workspaceSources(ws, config).resolve(`${config.platformDir}/database/schema.ts`, source);

  const twice = Object.keys(config.contexts)
    .map((context) => ({
      context,
      files: tablesFilesHeld(config, (file) => (ws.existsAsIs(file) ? ws.read(file) : undefined), context),
    }))
    .find(({ files }) => files.length > 1 && resolved.kind === 'file' && files.includes(resolved.path));

  return twice === undefined
    ? 'it is not the tables file of a context'
    : `${twice.context} holds two tables files in the merged tree, ${twice.files.join(' and ')}`;
}

/** The second import of a name moves to an alias that carries its context, which joins the entities. */
function settled(
  ws: Workspace,
  config: Config,
  { index, context, twice }: { index: string; context: string; twice: Bound },
): string {
  const held = ws.read(index) ?? '';
  const { code } = scan(held);
  const reserved = tablesConstants(ws, config);

  const isTaken = (name: string): boolean =>
    new RegExp(`\\b${escapeRegExp(name)}\\b`).test(code) || reserved.includes(name);

  const alias = freeName(toName(context), twice.name, isTaken);
  const rest = twice.others.length === 0 ? '' : `import { ${twice.others.join(', ')} } from '${twice.source}';\n`;

  ws.update(index, held.replace(twice.statement, rest));

  applyWiring(
    ws,
    index,
    `@@imports\nimport { ${twice.name} as ${alias} } from '${twice.source}';\n@@schemas\n${alias},\n`,
  );

  return `${index} imported two entities under the name \`${twice.local}\`: \`${twice.name}\` of ${context} is now imported as \`${alias}\` and listed under that name, the other keeps \`${twice.local}\`. The tables file and what reads it keep their names.`;
}
