import { namedBindingsOf } from '../../../migration';
import { toName } from '../../../naming/to-name';
import { freeName } from './free-name';
import { indexExports } from './index-exports';
import { signatureOf } from './signature-of';
import { type Bound, symbolOf } from './symbol-of';
import type { IndexReading, StarModule } from './index-reading';

/** Which tables file keeps a name several export, when the index does not say. */
export interface SettleOrder {
  /** The value that keeps each name before any other, by the place that declares it: the one the trunk of a merge exports under it. */
  readonly keeps?: ReadonlyMap<string, string>;
  /** The contexts that keep a name after every other: the one a generator writes a table for, those a branch brings. */
  readonly newcomers?: readonly string[];
  /** The names the command brings to the newcomers: they yield those alone. Every name, when not said. */
  readonly brought?: readonly string[];
}

/** One line the index lacks: the constant of a context, exported under its name or under one that carries its context. */
export interface SettleLine {
  readonly line: string;
  readonly context: string;
  readonly constant: string;
  /** The name the index gives the constant, when it is not its own. */
  readonly alias?: string;
  /** Whether the line exports a type alone: the tables file holds no value under the name. */
  readonly isType: boolean;
}

/** A symbol a file exports under a name, with the first file that holds it. */
interface Holder extends Bound {
  readonly star: StarModule;
}

/**
 * Every line the schema index of a Drizzle project lacks for each symbol of each file it
 * re-exports whole to be exported under a name, the whole index at once. Two files that export
 * the same symbol under a name, a table of the shared kernel each re-exports, hold one symbol:
 * `export *` brings it, as it brings a name one file alone exports. Different symbols under one
 * name, or a symbol whose name the index gives to something else, are settled: one keeps the
 * name, `export { orders } from`, unless the index already gives it to something, and every other
 * that the index exports under no name yet gets a name that carries its context, one nothing
 * holds, `export { orders as shippingOrders } from`. A name that has a value in a file is exported
 * from it with a plain line, which carries its type too; `export type` is written for a name that
 * is a type and no value in that file. The one that keeps the name is the value the trunk of a
 * merge exports under it, then one of a module that is no tables file of a context, which no name
 * of a context could be given to, one of a newcomer last, else of the file the index re-exports
 * first.
 */
export function linesToSettle(reading: IndexReading, order: SettleOrder): SettleLine[] {
  const exported = indexExports(reading);
  const values = new Set([...exported.values()].map(({ value }) => value));
  const types = new Set([...exported.values()].map(({ type }) => type));
  const isReached = ({ value, type }: Bound): boolean => (value === undefined ? types.has(type) : values.has(value));

  const taken = new Set([
    ...exported.keys(),
    ...namedBindingsOf(reading.text, 'import').flatMap(({ names }) => names.map(({ local }) => local)),
    ...reading.stars.flatMap(({ symbols }) => symbols.map(({ name }) => name)),
  ]);

  return [...new Set(reading.stars.flatMap(({ symbols }) => symbols.map(({ name }) => name)))].flatMap((constant) => {
    const isExplicit = isGiven(reading, constant);
    const holders = holdersOf(ranked(reading.stars, constant, order), constant);
    const pending = holders.filter((holder) => !isReached(holder));

    if (!isExplicit && holders.length < 2) {
      return [];
    }

    // One export by name ends the ambiguity of several `export *`: without it no holder is exported.
    const keeper = isExplicit ? undefined : (pending[0] ?? holders[0]);

    return [
      ...(keeper === undefined ? [] : [lineOf(keeper, constant)]),
      ...pending.filter((holder) => holder !== keeper).flatMap((holder) => aliased(holder, constant, taken)),
    ];
  });
}

/** The files in the order they would keep a name: the newcomers yield only the names this command brings them. */
function ranked(stars: readonly StarModule[], constant: string, order: SettleOrder): StarModule[] {
  const { keeps, newcomers = [], brought } = order;
  const yields = brought === undefined || brought.includes(constant);
  const kept = keeps?.get(constant);

  const rank = (star: StarModule): number => {
    if (kept !== undefined && symbolOf(star, constant).value === kept) {
      return -2;
    }

    if (star.context === undefined) {
      return -1;
    }

    return yields && newcomers.includes(star.context) ? 1 : 0;
  };

  return [...stars].sort((one, other) => rank(one) - rank(other));
}

/** Whether the index declares the name or exports it by name: it then names that, whatever the files hold. */
function isGiven({ values, types, given }: IndexReading, constant: string): boolean {
  return values.includes(constant) || types.includes(constant) || given.some(({ local }) => local === constant);
}

/** The different symbols the files export under a name, in their order, each with the first file that holds it. */
function holdersOf(stars: readonly StarModule[], constant: string): Holder[] {
  const holders = new Map<string, Holder>();

  for (const star of stars) {
    const symbol = symbolOf(star, constant);
    const signature = signatureOf(symbol);

    if (signature !== '|' && !holders.has(signature)) {
      holders.set(signature, { ...symbol, star });
    }
  }

  return [...holders.values()];
}

/** The line that gives a symbol a name of its context; none for a module that is no tables file of a context, which the kit has no name for. */
function aliased(holder: Holder, constant: string, taken: Set<string>): SettleLine[] {
  const { context } = holder.star;

  if (context === undefined) {
    return [];
  }

  const alias = freeName(toName(context), constant, (name) => taken.has(name));

  taken.add(alias);

  return [lineOf(holder, constant, alias)];
}

function lineOf({ star: { source, context }, value }: Holder, constant: string, alias?: string): SettleLine {
  const isType = value === undefined;
  const exported = alias === undefined ? constant : `${constant} as ${alias}`;

  return {
    line: `export ${isType ? 'type ' : ''}{ ${exported} } from '${source}';`,
    context: context ?? source,
    constant,
    isType,
    ...(alias === undefined ? {} : { alias }),
  };
}
