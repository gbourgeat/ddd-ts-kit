import { CommandError, array, bulk, integer, integerOf } from '../reply';
import { type Commands, upper } from './command';

/** ZADD, ZREM, ZCARD, ZSCORE, ZRANGE by rank, ZRANGEBYSCORE, ZREMRANGEBYSCORE. Scores as RESP2 writes them. */
export const SORTED_SET_COMMANDS: Commands = {
  ZADD: {
    arity: -4,
    run: ([key = '', ...rest], { keyspace }) => {
      const { flags, pairs } = zaddOptionsOf(rest);
      const { scores } = keyspace.write(key, 'zset');
      let changed = 0;

      for (const [score, member] of pairs) {
        const current = scores.get(member);

        const allowed =
          (current === undefined ? !flags.has('XX') : !flags.has('NX')) &&
          (current === undefined || !flags.has('GT') || score > current) &&
          (current === undefined || !flags.has('LT') || score < current);

        if (allowed && current !== score) {
          changed += current === undefined || flags.has('CH') ? 1 : 0;
          scores.set(member, score);
        }
      }

      keyspace.dropIfEmpty(key);

      return integer(changed);
    },
  },

  ZREM: {
    arity: -3,
    run: ([key = '', ...members], { keyspace }) => {
      const zset = keyspace.read(key, 'zset');
      const removed = members.filter((member) => zset?.scores.delete(member) === true).length;

      keyspace.dropIfEmpty(key);

      return integer(removed);
    },
  },

  ZCARD: {
    arity: 2,
    run: ([key = ''], { keyspace }) => integer(keyspace.read(key, 'zset')?.scores.size ?? 0),
  },

  ZSCORE: {
    arity: 3,
    run: ([key = '', member = ''], { keyspace }) => {
      const score = keyspace.read(key, 'zset')?.scores.get(member);

      return bulk(score === undefined ? null : scoreText(score));
    },
  },

  ZRANGE: {
    arity: -4,
    run: ([key = '', start, stop, ...options], { keyspace }) => {
      const withScores = options.some((option) => upper(option) === 'WITHSCORES');

      if (options.some((option) => upper(option) !== 'WITHSCORES')) {
        throw CommandError.syntax();
      }

      const members = ordered(keyspace.read(key, 'zset')?.scores);
      const from = indexOf(integerOf(start), members.length);
      const to = indexOf(integerOf(stop), members.length);

      return listed(members.slice(from, to + 1), withScores);
    },
  },

  ZRANGEBYSCORE: {
    arity: -4,
    run: ([key = '', min = '', max = '', ...options], { keyspace }) => {
      const { withScores, offset, count } = byScoreOptionsOf(options);
      const inRange = between(min, max);
      const members = ordered(keyspace.read(key, 'zset')?.scores).filter(([, score]) => inRange(score));

      return listed(members.slice(offset, count < 0 ? undefined : offset + count), withScores);
    },
  },

  ZREMRANGEBYSCORE: {
    arity: 4,
    run: ([key = '', min = '', max = ''], { keyspace }) => {
      const zset = keyspace.read(key, 'zset');
      const inRange = between(min, max);
      const removed = ordered(zset?.scores).filter(([member, score]) => inRange(score) && zset?.scores.delete(member));

      keyspace.dropIfEmpty(key);

      return integer(removed.length);
    },
  },
};

type Scored = readonly [member: string, score: number];

function ordered(scores: ReadonlyMap<string, number> | undefined): Scored[] {
  return [...(scores ?? [])].sort(([left, leftScore], [right, rightScore]) =>
    leftScore === rightScore ? (left < right ? -1 : left > right ? 1 : 0) : leftScore - rightScore,
  );
}

function listed(members: readonly Scored[], withScores: boolean) {
  return array(
    members.flatMap(([member, score]) => (withScores ? [bulk(member), bulk(scoreText(score))] : [bulk(member)])),
  );
}

/** A negative rank counts from the end, as in Redis. */
function indexOf(rank: number, length: number): number {
  return rank < 0 ? Math.max(0, length + rank) : rank;
}

/** `-inf`, `+inf`, a number, or `(number` for a bound that is left out. */
function between(min: string, max: string): (score: number) => boolean {
  const low = boundOf(min);
  const high = boundOf(max);

  return (score) =>
    (low.exclusive ? score > low.value : score >= low.value) &&
    (high.exclusive ? score < high.value : score <= high.value);
}

function boundOf(text: string): { readonly value: number; readonly exclusive: boolean } {
  const exclusive = text.startsWith('(');

  return { value: scoreOf(exclusive ? text.slice(1) : text), exclusive };
}

function scoreOf(text: string | undefined): number {
  const lower = (text ?? '').toLowerCase();

  if (lower === '-inf' || lower === '+inf' || lower === 'inf') {
    return lower === '-inf' ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  }

  const value = Number(text);

  if (text === undefined || text.trim() === '' || Number.isNaN(value)) {
    throw new CommandError('ERR min or max is not a float');
  }

  return value;
}

/** A score as Redis writes it: `%.17g`, the shortest form for the integers kept here. */
function scoreText(score: number): string {
  if (!Number.isFinite(score)) {
    return score > 0 ? 'inf' : '-inf';
  }

  return Number.isInteger(score) ? String(score) : String(Number(score.toPrecision(17)));
}

function zaddOptionsOf(rest: readonly string[]): { flags: Set<string>; pairs: (readonly [number, string])[] } {
  const flags = new Set<string>();
  let index = 0;

  while (['NX', 'XX', 'GT', 'LT', 'CH'].includes(upper(rest[index]))) {
    flags.add(upper(rest[index]));
    index += 1;
  }

  const pairs: (readonly [number, string])[] = [];

  if ((rest.length - index) % 2 !== 0 || index === rest.length) {
    throw CommandError.syntax();
  }

  for (; index < rest.length; index += 2) {
    const score = Number(rest[index]);

    if (Number.isNaN(score) || (rest[index] ?? '').trim() === '') {
      throw CommandError.notAFloat();
    }

    pairs.push([score, rest[index + 1] ?? '']);
  }

  return { flags, pairs };
}

function byScoreOptionsOf(options: readonly string[]): { withScores: boolean; offset: number; count: number } {
  let withScores = false;
  let offset = 0;
  let count = -1;

  for (let index = 0; index < options.length; index += 1) {
    const option = upper(options[index]);

    if (option === 'WITHSCORES') {
      withScores = true;
    } else if (option === 'LIMIT') {
      offset = integerOf(options[index + 1]);
      count = integerOf(options[index + 2]);
      index += 2;
    } else {
      throw CommandError.syntax();
    }
  }

  return { withScores, offset, count };
}
