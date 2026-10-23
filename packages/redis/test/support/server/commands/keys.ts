import { CommandError, array, bulk, bulks, integer, integerOf, status } from '../reply';
import { type Commands, upper } from './command';

/** DEL, EXISTS, TYPE, PEXPIRE, EXPIRE, PTTL, TTL and SCAN, on one database. */
export const KEY_COMMANDS: Commands = {
  DEL: {
    arity: -2,
    run: (keys, { keyspace, changed }) => {
      const deleted = keys.filter((key) => keyspace.get(key) !== undefined && keyspace.delete(key));

      for (const key of deleted) {
        changed(key);
      }

      return integer(deleted.length);
    },
  },

  EXISTS: {
    arity: -2,
    run: (keys, { keyspace }) => integer(keys.filter((key) => keyspace.get(key) !== undefined).length),
  },

  TYPE: {
    arity: 2,
    run: ([key = ''], { keyspace }) => status(keyspace.get(key)?.type ?? 'none'),
  },

  PEXPIRE: {
    arity: 3,
    run: ([key = '', ms], { keyspace, now }) => integer(keyspace.expire(key, now() + integerOf(ms)) ? 1 : 0),
  },

  EXPIRE: {
    arity: 3,
    run: ([key = '', seconds], { keyspace, now }) =>
      integer(keyspace.expire(key, now() + integerOf(seconds) * 1_000) ? 1 : 0),
  },

  PTTL: {
    arity: 2,
    run: ([key = ''], { keyspace }) => integer(keyspace.ttl(key)),
  },

  TTL: {
    arity: 2,
    run: ([key = ''], { keyspace }) => {
      const ms = keyspace.ttl(key);

      return integer(ms < 0 ? ms : Math.round(ms / 1_000));
    },
  },

  /** The whole keyspace in one call, cursor 0 back: Redis may answer any number of keys per call. */
  SCAN: {
    arity: -2,
    run: ([cursor, ...options], { keyspace }) => {
      integerOf(cursor);
      let pattern = '*';
      let type: string | undefined;

      for (let index = 0; index < options.length; index += 2) {
        const option = upper(options[index]);
        const value = options[index + 1];

        if (value === undefined) {
          throw CommandError.syntax();
        }

        if (option === 'MATCH') {
          pattern = value;
        } else if (option === 'TYPE') {
          type = value;
        } else if (option === 'COUNT') {
          integerOf(value);
        } else {
          throw CommandError.syntax();
        }
      }

      const matcher = globOf(pattern);

      const keys = keyspace
        .keys()
        .filter((key) => matcher.test(key) && (type === undefined || keyspace.get(key)?.type === type));

      return array([bulk('0'), bulks(keys)]);
    },
  },
};

/** A glob of Redis (`*`, `?`, `[...]`, `\\`) as a regular expression. */
function globOf(pattern: string): RegExp {
  let source = '';

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index] ?? '';

    if (char === '*') {
      source += '.*';
    } else if (char === '?') {
      source += '.';
    } else if (char === '[') {
      const end = pattern.indexOf(']', index + 1);

      source += end === -1 ? '\\[' : `[${pattern.slice(index + 1, end)}]`;
      index = end === -1 ? index : end;
    } else if (char === '\\') {
      index += 1;
      source += escapeChar(pattern[index] ?? '\\');
    } else {
      source += escapeChar(char);
    }
  }

  return new RegExp(`^${source}$`, 's');
}

function escapeChar(char: string): string {
  return char.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}
