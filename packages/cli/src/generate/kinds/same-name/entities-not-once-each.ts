import type { EntityReading } from './entity-reading';

/** The readings of the index before and after a settle, and the names it left to the team. */
interface Settle {
  readonly before: EntityReading;
  readonly after: EntityReading;
  readonly left: ReadonlySet<string>;
}

/**
 * What a settle of a TypeORM index must leave, whatever it wrote: no entity the index did not
 * import, no name it kept on another entity, no entry left without its import, and every entity it touched imported under one name
 * listed once, no name it touched listed twice. The names it left to the team, and what it did not
 * touch, are as they were. Answers the first thing that does not hold, in words, or undefined.
 */
export function entitiesNotOnceEach(settle: Settle): string | undefined {
  return newEntity(settle) ?? nameMoved(settle) ?? unboundEntry(settle) ?? listedTwice(settle) ?? notOnce(settle);
}

function newEntity({ before, after }: Settle): string | undefined {
  const known = new Set(before.bound.map(({ entity }) => entity));
  const found = after.bound.find(({ entity }) => !known.has(entity));

  return found === undefined
    ? undefined
    : `\`${found.local}\` naming ${described(found.entity)}, which it did not import`;
}

function nameMoved({ before, after, left }: Settle): string | undefined {
  const found = after.bound.find(
    ({ local, entity }) =>
      !left.has(local) && before.bound.some((bound) => bound.local === local) && !entitiesOf(before, local).has(entity),
  );

  return found === undefined ? undefined : `\`${found.local}\` naming another entity, ${described(found.entity)}`;
}

/** An entry of `entities` no import of the region binds, unless the index held it so before the settle. */
function unboundEntry({ before, after }: Settle): string | undefined {
  const isBound = (reading: EntityReading, local: string): boolean =>
    reading.bound.some((bound) => bound.local === local);

  const wasUnbound = (local: string): boolean => before.listed.includes(local) && !isBound(before, local);
  const found = after.listed.find((local) => !isBound(after, local) && !wasUnbound(local));

  return found === undefined ? undefined : `\`${found}\` listed in \`entities\` while no import gives that name`;
}

function listedTwice(settle: Settle): string | undefined {
  const { after, left } = settle;

  const found = [...new Set(after.listed)].find(
    (local) => !left.has(local) && listings(after, local) > 1 && isTouched(settle, local),
  );

  return found === undefined ? undefined : `\`${found}\` listed ${times(listings(after, found))} in \`entities\``;
}

function notOnce(settle: Settle): string | undefined {
  const { before, after, left } = settle;
  const exempt = new Set(before.bound.filter(({ local }) => left.has(local)).map(({ entity }) => entity));

  for (const entity of new Set(before.bound.map((bound) => bound.entity))) {
    const bindings = after.bound.filter((bound) => bound.entity === entity);
    const locals = [...localsOf(before, entity), ...localsOf(after, entity)];

    const touched =
      !sameSet(localsOf(before, entity), localsOf(after, entity)) || locals.some((local) => isTouched(settle, local));

    const listed = listings(after, bindings[0]?.local ?? '');

    if (!exempt.has(entity) && touched && (bindings.length !== 1 || listed !== 1)) {
      return `${described(entity)} imported ${times(bindings.length)} and listed ${times(listed)}`;
    }
  }

  return undefined;
}

/** Whether a settle changed what a name binds or how many times `entities` lists it. */
function isTouched({ before, after }: Settle, local: string): boolean {
  return (
    !sameSet(entitiesOf(before, local), entitiesOf(after, local)) || listings(before, local) !== listings(after, local)
  );
}

function entitiesOf(reading: EntityReading, local: string): Set<string> {
  return new Set(reading.bound.filter((bound) => bound.local === local).map(({ entity }) => entity));
}

function localsOf(reading: EntityReading, entity: string): Set<string> {
  return new Set(reading.bound.filter((bound) => bound.entity === entity).map(({ local }) => local));
}

function listings(reading: EntityReading, local: string): number {
  return reading.listed.filter((listed) => listed === local).length;
}

function sameSet(one: ReadonlySet<string>, other: ReadonlySet<string>): boolean {
  return one.size === other.size && [...one].every((held) => other.has(held));
}

/** An entity as the settle knows it, `<file>#<name>`, in words. */
function described(entity: string): string {
  const at = entity.lastIndexOf('#');

  return `the entity \`${entity.slice(at + 1)}\` of '${entity.slice(0, at)}'`;
}

function times(count: number): string {
  return count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`;
}
