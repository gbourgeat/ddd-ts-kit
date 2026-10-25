import { DEFAULT_STACK, type StackFlags } from '../helpers';
import { initRefusal, valuesOf } from './refusals-of-the-matrix';

/**
 * The flags whose values change what a project is able to do, each value of which must meet each
 * value of every other one in some generated stack: the flags of writing style and of tooling
 * change no capability and are left to the proven stacks.
 */
export const CAPABILITY_FLAGS = [
  'http',
  'validation',
  'di',
  'tests',
  'orm',
  'broker',
  'cache',
  'queue',
  'tenancy',
  'audit',
  'event-sourcing',
  'privacy',
  'storage',
  'authz',
  'style',
] as const;

type Flag = (typeof CAPABILITY_FLAGS)[number];

type Choice = Readonly<Partial<Record<Flag, string>>>;

/** A pair of values of two flags, `orm=prisma × tenancy=shared-table`. */
export type Pair = string;

/** Every pair of values of two capability flags that `init` accepts on its own. */
export function acceptedPairs(): Pair[] {
  const values = valuesByFlag();

  return CAPABILITY_FLAGS.flatMap((first, index) =>
    CAPABILITY_FLAGS.slice(index + 1).flatMap((second) =>
      (values.get(first) ?? []).flatMap((a) =>
        (values.get(second) ?? [])
          .filter((b) => refusalOf({ [first]: a, [second]: b }) === undefined)
          .map((b) => pairOf(first, a, second, b)),
      ),
    ),
  );
}

/** The pairs a list of stacks meets, each stack read over the defaults of `init` the e2e helpers start from. */
export function pairsMet(stacks: readonly StackFlags[]): Set<Pair> {
  const met = new Set<Pair>();

  for (const stack of stacks) {
    const flags: Record<string, unknown> = { ...DEFAULT_STACK, ...stack };

    CAPABILITY_FLAGS.forEach((first, index) => {
      for (const second of CAPABILITY_FLAGS.slice(index + 1)) {
        const [a, b] = [flags[first], flags[second]];

        if (typeof a === 'string' && typeof b === 'string') {
          met.add(pairOf(first, a, second, b));
        }
      }
    });
  }

  return met;
}

/**
 * The stacks that meet every pair `init` accepts and `given` leaves unmet, chosen greedily and in
 * a fixed order: each starts from the first unmet pair and takes, flag after flag, the value that
 * meets the most unmet pairs among those `init` accepts with what is already chosen.
 */
export function pairwiseStacks(given: readonly StackFlags[]): StackFlags[] {
  const values = valuesByFlag();
  const unmet = new Set(acceptedPairs().filter((pair) => !pairsMet(given).has(pair)));
  const stacks: StackFlags[] = [];

  for (const seed of [...unmet]) {
    if (!unmet.has(seed)) {
      continue;
    }

    const stack = completed(seedOf(seed), values, unmet);

    if (stack === undefined) {
      unmet.delete(seed);
      continue;
    }

    for (const pair of pairsMet([stack])) {
      unmet.delete(pair);
    }

    stacks.push(stack);
  }

  return stacks;
}

function completed(seed: Choice, values: Map<Flag, string[]>, unmet: Set<Pair>): StackFlags | undefined {
  if (refusalOf(seed) !== undefined) {
    return undefined;
  }

  let choice: Choice = seed;

  for (const flag of CAPABILITY_FLAGS.filter((name) => choice[name] === undefined)) {
    const accepted = (values.get(flag) ?? []).filter((value) => refusalOf({ ...choice, [flag]: value }) === undefined);
    const best = accepted.sort((a, b) => gain(choice, flag, b, unmet) - gain(choice, flag, a, unmet))[0];

    choice = best === undefined ? choice : { ...choice, [flag]: best };
  }

  return { ...DEFAULT_STACK, ...choice };
}

/** The unmet pairs a value of a flag would meet with the values already chosen. */
function gain(choice: Choice, flag: Flag, value: string, unmet: Set<Pair>): number {
  return Object.entries(choice).filter(([other, chosen]) => unmet.has(ordered(flag, value, other, chosen ?? '')))
    .length;
}

function seedOf(pair: Pair): Choice {
  return Object.fromEntries(pair.split(' × ').map((side) => side.split('=')));
}

function pairOf(first: string, a: string, second: string, b: string): Pair {
  return `${first}=${a} × ${second}=${b}`;
}

/** The pair in the order of `CAPABILITY_FLAGS`. */
function ordered(flag: string, value: string, other: string, chosen: string): Pair {
  const flags: readonly string[] = CAPABILITY_FLAGS;

  return flags.indexOf(flag) < flags.indexOf(other)
    ? pairOf(flag, value, other, chosen)
    : pairOf(other, chosen, flag, value);
}

/** What `init` answers a choice, over the defaults of the e2e helpers: a refusal, or `undefined`. */
function refusalOf(choice: Choice): string | undefined {
  const flags = Object.entries({ ...DEFAULT_STACK, ...choice }).map(([flag, value]) => [
    flag.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase()),
    value,
  ]);

  return initRefusal(Object.fromEntries(flags));
}

function valuesByFlag(): Map<Flag, string[]> {
  return new Map(
    CAPABILITY_FLAGS.map((flag) => [
      flag,
      valuesOf(flag.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())),
    ]),
  );
}
