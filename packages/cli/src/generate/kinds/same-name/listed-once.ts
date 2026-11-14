import type { Workspace } from '../../../workspace';
import { bindingOf } from './binding-of';
import { type Bound, boundBy, type EntityOf } from './bound-by';
import { type EntityReading, entityReading } from './entity-reading';
import { entryOf } from './entry-of';
import { regionOf } from './region-of';

/** The index, how its imports name their entities, and the index of the trunk in a merge. */
interface Reading {
  readonly index: string;
  readonly entityOf: EntityOf;
}

/**
 * An entity the region imports under exactly two names, each listed once, as
 * a merge leaves the one each side had given it, is listed twice. It keeps one name, the one the
 * trunk gives it when the trunk imports it, else the first: the other import goes, with its entry.
 * Any other shape of an entity under two names is left as it stands.
 */
export function listedOnce(ws: Workspace, { index, onTrunk, entityOf }: Reading & { onTrunk: string }): string[] {
  const ofTheTrunk = new Set(boundBy(onTrunk, entityOf).map(bindingOf));
  const said: string[] = [];
  let twice = importedAgain(entityReading(ws.read(index) ?? '', entityOf), ofTheTrunk);

  while (twice !== undefined) {
    const { gone, kept } = twice;
    const whose = ofTheTrunk.has(bindingOf(kept)) ? ', the name the trunk gives it' : '';

    withoutImport(ws, { index, entityOf }, gone);

    said.push(
      `${index} imported the entity \`${gone.name}\` of '${gone.source}' under two names, \`${gone.local}\` and \`${kept.local}\`: it keeps \`${kept.local}\`${whose}, and is listed once.`,
    );

    twice = importedAgain(entityReading(ws.read(index) ?? '', entityOf), ofTheTrunk);
  }

  return said;
}

/** The first entity of the region in the one shape `listedOnce` settles, with the import it keeps and the one that goes. */
function importedAgain(
  reading: EntityReading,
  ofTheTrunk: ReadonlySet<string>,
): { gone: Bound; kept: Bound } | undefined {
  for (const { entity } of reading.bound) {
    const [one, other, ...more] = reading.bound.filter((bound) => bound.entity === entity);

    if (one !== undefined && other !== undefined && more.length === 0 && isListedOnceEach(reading, [one, other])) {
      const isOtherKept = ofTheTrunk.has(bindingOf(other)) && !ofTheTrunk.has(bindingOf(one));

      return isOtherKept ? { gone: one, kept: other } : { gone: other, kept: one };
    }
  }

  return undefined;
}

/** Whether the two imports of one entity, each from the tables file that declares it, give two names, each of which `entities` lists once. */
function isListedOnceEach({ listed }: EntityReading, [one, other]: readonly [Bound, Bound]): boolean {
  const once = (local: string): boolean => listed.filter((entry) => entry === local).length === 1;

  return one.told && other.told && one.local !== other.local && once(one.local) && once(other.local);
}

/** Takes one import out of the index, with its entry when nothing else bears its name. */
function withoutImport(ws: Workspace, { index, entityOf }: Reading, { statement, source, local, others }: Bound): void {
  const held = ws.read(index) ?? '';
  const rest = others.length === 0 ? '' : `import { ${others.join(', ')} } from '${source}';\n`;
  const without = held.replace(statement, rest);
  const isBound = boundBy(without, entityOf).some((bound) => bound.local === local);
  const entries = regionOf(without, 'schemas');
  const lines = entries.split('\n');
  const at = lines.findIndex((line) => entryOf(line) === local);
  const kept = [...lines.slice(0, at), ...lines.slice(at + 1)].join('\n');

  ws.update(index, isBound || at < 0 ? without : without.replace(entries, kept));
}
