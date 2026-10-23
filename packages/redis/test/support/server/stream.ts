import { CommandError } from './reply';

/** `<milliseconds>-<sequence>`, the identifier of a stream entry, ordered by both. */
export class StreamId {
  static readonly ZERO = new StreamId(0, 0);

  private constructor(
    readonly ms: number,
    readonly seq: number,
  ) {}

  static of(ms: number, seq: number): StreamId {
    return new StreamId(ms, seq);
  }

  /** `1700000000000-3`, or `1700000000000` with the sequence given (0 for a start, the last for an end). */
  static parse(text: string, missingSeq = 0): StreamId {
    const match = /^(\d+)(?:-(\d+))?$/.exec(text);

    if (match === null) {
      throw new CommandError('ERR Invalid stream ID specified as stream command argument');
    }

    return new StreamId(Number(match[1]), match[2] === undefined ? missingSeq : Number(match[2]));
  }

  compare(other: StreamId): number {
    return this.ms === other.ms ? this.seq - other.seq : this.ms - other.ms;
  }

  toString(): string {
    return `${String(this.ms)}-${String(this.seq)}`;
  }
}

export interface StreamEntry {
  readonly id: StreamId;
  readonly fields: readonly string[];
}

export interface PendingEntry {
  readonly id: StreamId;
  consumer: string;
  deliveredAt: number;
  deliveries: number;
}

export interface Consumer {
  seenAt: number;
}

export class Group {
  readonly consumers = new Map<string, Consumer>();

  /** Delivered and not acknowledged, by entry id. */
  readonly pending = new Map<string, PendingEntry>();

  constructor(
    public lastDelivered: StreamId,
    public entriesRead: number | null,
  ) {}

  consumer(name: string, now: number): Consumer {
    const consumer = this.consumers.get(name) ?? { seenAt: now };

    consumer.seenAt = now;
    this.consumers.set(name, consumer);

    return consumer;
  }

  /** The pending entries in the order of their ids. */
  pendingInOrder(): PendingEntry[] {
    return [...this.pending.values()].sort((left, right) => left.id.compare(right.id));
  }
}

/**
 * A stream: its entries in the order of their ids, the last id it generated, and its consumer
 * groups with their pending entries. An entry deleted or trimmed is gone from the stream but
 * stays pending in a group until it is acknowledged, as in Redis.
 */
export class Stream {
  entries: StreamEntry[] = [];

  lastId = StreamId.ZERO;

  maxDeletedId = StreamId.ZERO;

  entriesAdded = 0;

  readonly groups = new Map<string, Group>();

  /** Appends with `*` (the clock, or the next sequence of the last id) or with an explicit id above the last. */
  add(requested: string, fields: readonly string[], now: number): StreamId {
    const id = requested === '*' ? this.nextId(now) : StreamId.parse(requested);

    if (id.compare(this.lastId) <= 0) {
      throw new CommandError('ERR The ID specified in XADD is equal or smaller than the target stream top item');
    }

    this.entries.push({ id, fields });
    this.lastId = id;
    this.entriesAdded += 1;

    return id;
  }

  /** Entries from `start` to `end`, both included unless written `(id`, `-` and `+` for the ends. */
  range(start: string, end: string, count = Number.POSITIVE_INFINITY): StreamEntry[] {
    const from = boundOf(start, 'start');
    const to = boundOf(end, 'end');

    return this.entries
      .filter(({ id }) => {
        const above = from.exclusive ? id.compare(from.id) > 0 : id.compare(from.id) >= 0;
        const below = to.exclusive ? id.compare(to.id) < 0 : id.compare(to.id) <= 0;

        return above && below;
      })
      .slice(0, count);
  }

  entry(id: StreamId): StreamEntry | undefined {
    return this.entries.find((entry) => entry.id.compare(id) === 0);
  }

  delete(ids: readonly StreamId[]): number {
    const before = this.entries.length;

    for (const id of ids) {
      if (this.entry(id) !== undefined && id.compare(this.maxDeletedId) > 0) {
        this.maxDeletedId = id;
      }
    }

    this.entries = this.entries.filter((entry) => !ids.some((id) => id.compare(entry.id) === 0));

    return before - this.entries.length;
  }

  /** Keeps the last `length` entries: an exact trim, which `~` allows too. */
  trimToLength(length: number): number {
    return this.trim(this.entries.slice(0, Math.max(0, this.entries.length - length)));
  }

  /** Drops the entries below `id`. */
  trimBelow(id: StreamId): number {
    return this.trim(this.entries.filter((entry) => entry.id.compare(id) < 0));
  }

  private trim(dropped: readonly StreamEntry[]): number {
    return this.delete(dropped.map((entry) => entry.id));
  }

  private nextId(now: number): StreamId {
    return now > this.lastId.ms ? StreamId.of(now, 0) : StreamId.of(this.lastId.ms, this.lastId.seq + 1);
  }
}

function boundOf(text: string, side: 'start' | 'end'): { readonly id: StreamId; readonly exclusive: boolean } {
  if (text === '-') {
    return { id: StreamId.ZERO, exclusive: false };
  }

  if (text === '+') {
    return { id: StreamId.of(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER), exclusive: false };
  }

  const exclusive = text.startsWith('(');
  const id = StreamId.parse(exclusive ? text.slice(1) : text, side === 'start' ? 0 : Number.MAX_SAFE_INTEGER);

  return { id, exclusive };
}
