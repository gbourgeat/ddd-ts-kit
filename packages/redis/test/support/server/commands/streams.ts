import { CommandError, NIL, OK, array, bulk, integer, integerOf, map } from '../reply';
import { Group, StreamId } from '../stream';
import { type Commands, upper } from './command';
import { entriesReply, entryReply, groupOf } from './stream-replies';

/** XADD with its trimming, XLEN, XRANGE, XDEL, XGROUP and XINFO: the stream and its groups as data. */
export const STREAM_COMMANDS: Commands = {
  XADD: {
    arity: -5,
    run: ([key = '', ...rest], { keyspace, now, changed }) => {
      const { noStream, trim, id, fields } = xaddOptionsOf(rest);

      if (noStream && keyspace.read(key, 'stream') === undefined) {
        return NIL;
      }

      const { stream } = keyspace.write(key, 'stream');
      const added = stream.add(id, fields, now());

      if (trim?.strategy === 'MAXLEN') {
        stream.trimToLength(integerOf(trim.threshold));
      } else if (trim?.strategy === 'MINID') {
        stream.trimBelow(StreamId.parse(trim.threshold));
      }

      changed(key);

      return bulk(added.toString());
    },
  },

  XLEN: {
    arity: 2,
    run: ([key = ''], { keyspace }) => integer(keyspace.read(key, 'stream')?.stream.entries.length ?? 0),
  },

  XRANGE: {
    arity: -4,
    run: ([key = '', start = '', end = '', option, count], { keyspace }) => {
      if (option !== undefined && upper(option) !== 'COUNT') {
        throw CommandError.syntax();
      }

      const stream = keyspace.read(key, 'stream')?.stream;

      return entriesReply(stream?.range(start, end, option === undefined ? undefined : integerOf(count)) ?? []);
    },
  },

  XDEL: {
    arity: -3,
    run: ([key = '', ...ids], { keyspace }) =>
      integer(keyspace.read(key, 'stream')?.stream.delete(ids.map((id) => StreamId.parse(id))) ?? 0),
  },

  XGROUP: {
    arity: -2,
    run: ([subcommand, key = '', name = '', ...rest], context) => {
      const { keyspace, now, changed } = context;
      const missing = `NOGROUP No such consumer group '${name}' for key name '${key}'`;

      switch (upper(subcommand)) {
        case 'CREATE': {
          const [start = '', ...options] = rest;
          const makeStream = options.some((option) => upper(option) === 'MKSTREAM');
          const existing = keyspace.read(key, 'stream')?.stream;

          if (existing === undefined && !makeStream) {
            throw new CommandError(
              'ERR The XGROUP subcommand requires the key to exist. Note that for CREATE you may want to use the MKSTREAM option to create an empty stream automatically.',
            );
          }

          const { stream } = keyspace.write(key, 'stream');

          if (stream.groups.has(name)) {
            throw new CommandError('BUSYGROUP Consumer Group name already exists');
          }

          const fromEnd = start === '$';

          stream.groups.set(
            name,
            new Group(fromEnd ? stream.lastId : StreamId.parse(start), fromEnd ? stream.entriesAdded : null),
          );

          return OK;
        }
        case 'DESTROY': {
          const deleted = keyspace.read(key, 'stream')?.stream.groups.delete(name) === true;

          changed(key);

          return integer(deleted ? 1 : 0);
        }
        case 'CREATECONSUMER': {
          const { group } = groupOf(keyspace, key, name, missing);
          const created = !group.consumers.has(rest[0] ?? '');

          group.consumer(rest[0] ?? '', now());

          return integer(created ? 1 : 0);
        }
        case 'DELCONSUMER': {
          const { group } = groupOf(keyspace, key, name, missing);
          const consumer = rest[0] ?? '';
          const pending = [...group.pending.values()].filter((entry) => entry.consumer === consumer);

          for (const entry of pending) {
            group.pending.delete(entry.id.toString());
          }

          group.consumers.delete(consumer);

          return integer(pending.length);
        }
        case 'SETID': {
          const { stream, group } = groupOf(keyspace, key, name, missing);

          group.lastDelivered = rest[0] === '$' ? stream.lastId : StreamId.parse(rest[0] ?? '');

          return OK;
        }
        default:
          throw new CommandError(`ERR unknown subcommand '${subcommand ?? ''}'.`);
      }
    },
  },

  XINFO: {
    arity: -3,
    run: ([subcommand, key = '', name = ''], { keyspace, now }) => {
      const stream = keyspace.read(key, 'stream')?.stream;

      if (stream === undefined) {
        throw new CommandError('ERR no such key');
      }

      switch (upper(subcommand)) {
        case 'STREAM': {
          const [first, last] = [stream.entries[0], stream.entries.at(-1)];

          return map([
            ['length', integer(stream.entries.length)],
            ['radix-tree-keys', integer(1)],
            ['radix-tree-nodes', integer(2)],
            ['last-generated-id', bulk(stream.lastId.toString())],
            ['max-deleted-entry-id', bulk(stream.maxDeletedId.toString())],
            ['entries-added', integer(stream.entriesAdded)],
            ['recorded-first-entry-id', bulk((first?.id ?? StreamId.ZERO).toString())],
            ['groups', integer(stream.groups.size)],
            ['first-entry', first === undefined ? NIL : entryReply(first)],
            ['last-entry', last === undefined ? NIL : entryReply(last)],
          ]);
        }
        case 'GROUPS':
          return array(
            [...stream.groups].map(([groupName, group]) =>
              map([
                ['name', bulk(groupName)],
                ['consumers', integer(group.consumers.size)],
                ['pending', integer(group.pending.size)],
                ['last-delivered-id', bulk(group.lastDelivered.toString())],
                ['entries-read', group.entriesRead === null ? NIL : integer(group.entriesRead)],
                ['lag', group.entriesRead === null ? NIL : integer(stream.entriesAdded - group.entriesRead)],
              ]),
            ),
          );
        case 'CONSUMERS': {
          const group = stream.groups.get(name);

          if (group === undefined) {
            throw new CommandError(`NOGROUP No such consumer group '${name}' for key name '${key}'`);
          }

          return array(
            [...group.consumers].map(([consumer, { seenAt }]) =>
              map([
                ['name', bulk(consumer)],
                ['pending', integer([...group.pending.values()].filter((entry) => entry.consumer === consumer).length)],
                ['idle', integer(now() - seenAt)],
              ]),
            ),
          );
        }
        default:
          throw new CommandError(`ERR unknown subcommand '${subcommand ?? ''}'.`);
      }
    },
  },
};

interface XaddOptions {
  readonly noStream: boolean;
  readonly trim: { readonly strategy: 'MAXLEN' | 'MINID'; readonly threshold: string } | undefined;
  readonly id: string;
  readonly fields: readonly string[];
}

function xaddOptionsOf(rest: readonly string[]): XaddOptions {
  let noStream = false;
  let trim: XaddOptions['trim'];
  let index = 0;

  for (;;) {
    const option = upper(rest[index]);

    if (option === 'NOMKSTREAM') {
      noStream = true;
      index += 1;
    } else if (option === 'MAXLEN' || option === 'MINID') {
      index += rest[index + 1] === '~' || rest[index + 1] === '=' ? 2 : 1;
      trim = { strategy: option, threshold: rest[index] ?? '' };
      index += 1;
    } else if (option === 'LIMIT') {
      integerOf(rest[index + 1]);
      index += 2;
    } else {
      break;
    }
  }

  const fields = rest.slice(index + 1);

  if (fields.length === 0 || fields.length % 2 !== 0) {
    throw CommandError.arity('XADD');
  }

  return { noStream, trim, id: rest[index] ?? '', fields };
}
