import { CommandError, NIL, OK, array, bulk, integer, integerOf } from '../reply';
import { type Commands, upper } from './command';

/** GET, SET with its conditions and expiries, INCR, INCRBY. */
export const STRING_COMMANDS: Commands = {
  GET: {
    arity: 2,
    run: ([key = ''], { keyspace }) => bulk(keyspace.read(key, 'string')?.text ?? null),
  },

  SET: {
    arity: -3,
    run: ([key = '', text = '', ...options], { keyspace, now }) => {
      const { condition, expiresAt, keepTtl, get } = setOptionsOf(options, now());
      const previous = keyspace.get(key);

      if (get && previous !== undefined && previous.type !== 'string') {
        throw CommandError.wrongType();
      }

      const before = get ? bulk(previous?.type === 'string' ? previous.text : null) : OK;

      if ((condition === 'NX' && previous !== undefined) || (condition === 'XX' && previous === undefined)) {
        return get ? before : NIL;
      }

      const ttl = keyspace.ttl(key);
      const kept = keepTtl && ttl > 0 ? now() + ttl : undefined;

      keyspace.set(key, { type: 'string', text }, expiresAt ?? kept);

      return before;
    },
  },

  INCR: {
    arity: 2,
    run: ([key = ''], { keyspace }) => increment(keyspace.write(key, 'string'), 1),
  },

  INCRBY: {
    arity: 3,
    run: ([key = '', by], { keyspace }) => increment(keyspace.write(key, 'string'), integerOf(by)),
  },
};

/** HGET, HSET, HEXISTS, HINCRBY, HDEL, HGETALL, HLEN. */
export const HASH_COMMANDS: Commands = {
  HGET: {
    arity: 3,
    run: ([key = '', field = ''], { keyspace }) => bulk(keyspace.read(key, 'hash')?.fields.get(field) ?? null),
  },

  HSET: {
    arity: -4,
    run: ([key = '', ...pairs], { keyspace }) => {
      if (pairs.length % 2 !== 0) {
        throw CommandError.arity('HSET');
      }

      const { fields } = keyspace.write(key, 'hash');
      let added = 0;

      for (let index = 0; index < pairs.length; index += 2) {
        const field = pairs[index] ?? '';

        added += fields.has(field) ? 0 : 1;
        fields.set(field, pairs[index + 1] ?? '');
      }

      return integer(added);
    },
  },

  HEXISTS: {
    arity: 3,
    run: ([key = '', field = ''], { keyspace }) => integer(keyspace.read(key, 'hash')?.fields.has(field) ? 1 : 0),
  },

  HINCRBY: {
    arity: 4,
    run: ([key = '', field = '', by], { keyspace }) => {
      const { fields } = keyspace.write(key, 'hash');
      const current = fields.get(field) ?? '0';

      if (!/^-?\d+$/.test(current)) {
        throw new CommandError('ERR hash value is not an integer');
      }

      const value = Number(current) + integerOf(by);

      fields.set(field, String(value));

      return integer(value);
    },
  },

  HDEL: {
    arity: -3,
    run: ([key = '', ...names], { keyspace }) => {
      const hash = keyspace.read(key, 'hash');
      const deleted = names.filter((name) => hash?.fields.delete(name) === true).length;

      keyspace.dropIfEmpty(key);

      return integer(deleted);
    },
  },

  HGETALL: {
    arity: 2,
    run: ([key = ''], { keyspace }) =>
      array([...(keyspace.read(key, 'hash')?.fields ?? [])].flatMap(([field, value]) => [bulk(field), bulk(value)])),
  },

  HLEN: {
    arity: 2,
    run: ([key = ''], { keyspace }) => integer(keyspace.read(key, 'hash')?.fields.size ?? 0),
  },
};

interface SetOptions {
  readonly condition: 'NX' | 'XX' | undefined;
  readonly expiresAt: number | undefined;
  readonly keepTtl: boolean;
  readonly get: boolean;
}

function setOptionsOf(options: readonly string[], now: number): SetOptions {
  let condition: SetOptions['condition'];
  let expiresAt: number | undefined;
  let keepTtl = false;
  let get = false;

  for (let index = 0; index < options.length; index += 1) {
    const option = upper(options[index]);

    if (option === 'NX' || option === 'XX') {
      condition = option;
    } else if (option === 'KEEPTTL') {
      keepTtl = true;
    } else if (option === 'GET') {
      get = true;
    } else if (option === 'PX' || option === 'EX' || option === 'PXAT' || option === 'EXAT') {
      index += 1;
      expiresAt = expiryOf(option, integerOf(options[index]), now);
    } else {
      throw CommandError.syntax();
    }
  }

  return { condition, expiresAt, keepTtl, get };
}

function expiryOf(option: string, value: number, now: number): number {
  if (value <= 0) {
    throw new CommandError("ERR invalid expire time in 'set' command");
  }

  const at: Readonly<Record<string, number>> = {
    PX: now + value,
    EX: now + value * 1_000,
    PXAT: value,
    EXAT: value * 1_000,
  };

  return at[option] ?? now;
}

function increment(value: { text: string }, by: number) {
  const current = value.text === '' ? '0' : value.text;

  if (!/^-?\d+$/.test(current)) {
    throw CommandError.notAnInteger();
  }

  const next = Number(current) + by;

  value.text = String(next);

  return integer(next);
}
