import { CommandError, NIL, type Reply, array, bulk, integer, integerOf, map } from '../reply';
import { type Group, type Stream, type StreamEntry, StreamId } from '../stream';
import { type Commands, type Context, type Wait, upper } from './command';
import { entriesReply, entryReply, groupOf, noGroup } from './stream-replies';

/**
 * XREADGROUP, XACK, XPENDING and XCLAIM: the delivery of entries to the consumers of a group.
 * A read of new entries (`>`) that finds none waits with `BLOCK` until an entry is added to one of
 * its streams, or until its timeout; a read of history (an id) answers the pending entries of the
 * consumer at once. An entry gone from the stream while pending is answered without its fields by a
 * history read and dropped by XCLAIM, as Redis 7 does.
 */
export const GROUP_COMMANDS: Commands = {
  XREADGROUP: {
    arity: -7,
    run: (args, context) => {
      const read = readOptionsOf(args);
      const answer = (): Reply | undefined => readGroup(read, context);
      const first = answer();

      if (first !== undefined || read.blockMs === undefined || !context.mayBlock) {
        return first ?? array(null);
      }

      const wait: Wait = { kind: 'wait', keys: read.keys, timeoutMs: read.blockMs, retry: answer };

      return wait;
    },
  },

  XACK: {
    arity: -4,
    run: ([key = '', name = '', ...ids], { keyspace }) => {
      const group = keyspace.read(key, 'stream')?.stream.groups.get(name);

      return integer(ids.filter((id) => group?.pending.delete(StreamId.parse(id).toString()) === true).length);
    },
  },

  XPENDING: {
    arity: -3,
    run: ([key = '', name = '', ...rest], { keyspace, now }) => {
      const { group } = groupOf(keyspace, key, name, noGroup(key, name));

      if (rest.length === 0) {
        return summaryOf(group);
      }

      const idle = upper(rest[0]) === 'IDLE' ? integerOf(rest[1]) : 0;
      const [start = '', end = '', count, consumer] = upper(rest[0]) === 'IDLE' ? rest.slice(2) : rest;
      const within = rangeOf(start, end);

      const entries = group
        .pendingInOrder()
        .filter((entry) => within(entry.id) && now() - entry.deliveredAt >= idle)
        .filter((entry) => consumer === undefined || entry.consumer === consumer)
        .slice(0, integerOf(count));

      return array(
        entries.map((entry) =>
          array([
            bulk(entry.id.toString()),
            bulk(entry.consumer),
            integer(now() - entry.deliveredAt),
            integer(entry.deliveries),
          ]),
        ),
      );
    },
  },

  XCLAIM: {
    arity: -6,
    run: ([key = '', name = '', consumer = '', minIdle, ...rest], { keyspace, now }) => {
      const { stream, group } = groupOf(keyspace, key, name, noGroup(key, name));
      const { ids, justId, force, deliveredAt, retryCount } = claimOptionsOf(rest, now());
      const minIdleMs = integerOf(minIdle);
      const claimed: StreamEntry[] = [];

      group.consumer(consumer, now());

      for (const id of ids) {
        const entry = stream.entry(id);

        const pending =
          group.pending.get(id.toString()) ??
          (force && entry !== undefined ? pendingOf(group, id, consumer, now()) : undefined);

        if (pending === undefined || now() - pending.deliveredAt < minIdleMs) {
          continue;
        }

        if (entry === undefined) {
          group.pending.delete(id.toString());
          continue;
        }

        pending.consumer = consumer;
        pending.deliveredAt = deliveredAt;
        pending.deliveries = retryCount ?? (justId ? pending.deliveries : pending.deliveries + 1);
        claimed.push(entry);
      }

      return justId ? array(claimed.map((entry) => bulk(entry.id.toString()))) : entriesReply(claimed);
    },
  },
};

interface ReadOptions {
  readonly group: string;
  readonly consumer: string;
  readonly count: number;
  readonly blockMs: number | undefined;
  readonly noAck: boolean;
  readonly keys: readonly string[];
  readonly ids: readonly string[];
}

function readOptionsOf(args: readonly string[]): ReadOptions {
  if (upper(args[0]) !== 'GROUP') {
    throw CommandError.syntax();
  }

  let count = Number.POSITIVE_INFINITY;
  let blockMs: number | undefined;
  let noAck = false;
  let index = 3;

  for (; index < args.length && upper(args[index]) !== 'STREAMS'; index += 1) {
    const option = upper(args[index]);

    if (option === 'COUNT') {
      index += 1;
      count = integerOf(args[index]);
    } else if (option === 'BLOCK') {
      index += 1;
      blockMs = integerOf(args[index]);
    } else if (option === 'NOACK') {
      noAck = true;
    } else {
      throw CommandError.syntax();
    }
  }

  const streams = args.slice(index + 1);

  if (streams.length === 0 || streams.length % 2 !== 0) {
    throw new CommandError(
      "ERR Unbalanced 'xreadgroup' list of streams: for each stream key an ID or '>' must be specified.",
    );
  }

  return {
    group: args[1] ?? '',
    consumer: args[2] ?? '',
    count: count === 0 ? Number.POSITIVE_INFINITY : count,
    blockMs,
    noAck,
    keys: streams.slice(0, streams.length / 2),
    ids: streams.slice(streams.length / 2),
  };
}

/** The entries read, by stream, or undefined when a read of new entries found none anywhere. */
function readGroup(read: ReadOptions, context: Context): Reply | undefined {
  const { keyspace, now } = context;
  const answers: (readonly [string, Reply])[] = [];

  for (const [index, key] of read.keys.entries()) {
    const { stream, group } = groupOf(
      keyspace,
      key,
      read.group,
      `NOGROUP No such key '${key}' or consumer group '${read.group}' in XREADGROUP with GROUP option`,
    );

    group.consumer(read.consumer, now());

    const id = read.ids[index] ?? '>';
    const reply = id === '>' ? deliver(stream, group, read, now()) : history(stream, group, read, StreamId.parse(id));

    if (reply !== undefined) {
      answers.push([key, reply]);
    }
  }

  if (answers.length === 0) {
    return undefined;
  }

  return context.connection.protocol === 3
    ? map(answers)
    : array(answers.map(([key, reply]) => array([bulk(key), reply])));
}

function deliver(stream: Stream, group: Group, read: ReadOptions, now: number): Reply | undefined {
  const entries = stream.entries.filter((entry) => entry.id.compare(group.lastDelivered) > 0).slice(0, read.count);

  for (const entry of entries) {
    group.lastDelivered = entry.id;
    group.entriesRead = group.entriesRead === null ? null : group.entriesRead + 1;

    if (!read.noAck) {
      pendingOf(group, entry.id, read.consumer, now);
    }
  }

  return entries.length === 0 ? undefined : entriesReply(entries);
}

function history(stream: Stream, group: Group, read: ReadOptions, after: StreamId): Reply {
  const pending = group
    .pendingInOrder()
    .filter((entry) => entry.consumer === read.consumer && entry.id.compare(after) > 0)
    .slice(0, read.count);

  return array(
    pending.map((entry) => {
      const stored = stream.entry(entry.id);

      return stored === undefined ? array([bulk(entry.id.toString()), NIL]) : entryReply(stored);
    }),
  );
}

function pendingOf(group: Group, id: StreamId, consumer: string, now: number) {
  const pending = { id, consumer, deliveredAt: now, deliveries: 1 };

  group.pending.set(id.toString(), pending);

  return pending;
}

function summaryOf(group: Group): Reply {
  const pending = group.pendingInOrder();
  const [first, last] = [pending[0], pending.at(-1)];

  if (first === undefined || last === undefined) {
    return array([integer(0), NIL, NIL, array(null)]);
  }

  const byConsumer = new Map<string, number>();

  for (const entry of pending) {
    byConsumer.set(entry.consumer, (byConsumer.get(entry.consumer) ?? 0) + 1);
  }

  return array([
    integer(pending.length),
    bulk(first.id.toString()),
    bulk(last.id.toString()),
    array([...byConsumer].map(([consumer, count]) => array([bulk(consumer), bulk(String(count))]))),
  ]);
}

function rangeOf(start: string, end: string): (id: StreamId) => boolean {
  const from = start === '-' ? StreamId.ZERO : StreamId.parse(start.replace(/^\(/, ''));
  const to = end === '+' ? undefined : StreamId.parse(end.replace(/^\(/, ''), Number.MAX_SAFE_INTEGER);

  return (id) =>
    (start.startsWith('(') ? id.compare(from) > 0 : id.compare(from) >= 0) &&
    (to === undefined || (end.startsWith('(') ? id.compare(to) < 0 : id.compare(to) <= 0));
}

interface ClaimOptions {
  readonly ids: readonly StreamId[];
  readonly justId: boolean;
  readonly force: boolean;
  readonly deliveredAt: number;
  readonly retryCount: number | undefined;
}

function claimOptionsOf(rest: readonly string[], now: number): ClaimOptions {
  const ids: StreamId[] = [];
  let justId = false;
  let force = false;
  let deliveredAt = now;
  let retryCount: number | undefined;

  for (let index = 0; index < rest.length; index += 1) {
    const option = upper(rest[index]);

    if (option === 'JUSTID') {
      justId = true;
    } else if (option === 'FORCE') {
      force = true;
    } else if (option === 'IDLE' || option === 'TIME' || option === 'RETRYCOUNT' || option === 'LASTID') {
      index += 1;
      const value = rest[index];

      deliveredAt = option === 'IDLE' ? now - integerOf(value) : option === 'TIME' ? integerOf(value) : deliveredAt;
      retryCount = option === 'RETRYCOUNT' ? integerOf(value) : retryCount;
    } else {
      ids.push(StreamId.parse(rest[index] ?? ''));
    }
  }

  return { ids, justId, force, deliveredAt, retryCount };
}
