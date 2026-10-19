import { headerOf } from './headers.js';
import { type Json, millisecondsOf, numberIn } from './json.js';
import type { PullConsumer } from './pull-consumer.js';
import { subjectMatches } from './subjects.js';

export interface StoredMessage {
  readonly seq: number;
  readonly subject: string;
  readonly headers: Buffer | undefined;
  readonly data: Buffer;
  readonly time: Date;
}

/** What `append` answers: the sequence the message holds, and whether it was dropped as a duplicate. */
export interface Appended {
  readonly seq: number;
  readonly duplicate: boolean;
}

const DEFAULT_DUPLICATE_WINDOW_MS = 120_000;

/** A stream with the limits retention: every message kept until it is deleted, one by one or with the stream. */
export class Stream {
  readonly messages = new Map<number, StoredMessage>();

  readonly consumers = new Map<string, PullConsumer>();

  readonly created = new Date();

  private lastSeq = 0;

  /** Message ids seen inside the duplicate window, with the sequence they were stored at. */
  private readonly seen = new Map<string, { readonly seq: number; readonly at: number }>();

  constructor(
    readonly name: string,
    /** The configuration as the client sent it, to tell an identical declaration from another. */
    readonly requested: Json,
    readonly config: Json,
  ) {}

  get lastSequence(): number {
    return this.lastSeq;
  }

  captures(subject: string): boolean {
    const subjects = this.config['subjects'];

    return (
      Array.isArray(subjects) &&
      subjects.some((pattern) => typeof pattern === 'string' && subjectMatches(pattern, subject))
    );
  }

  /** Stores a message, unless its `Nats-Msg-Id` was stored inside the duplicate window. */
  append(subject: string, headers: Buffer | undefined, data: Buffer): Appended {
    const id = headerOf(headers, 'Nats-Msg-Id');
    const now = Date.now();
    const window = millisecondsOf(numberIn(this.config, 'duplicate_window'), DEFAULT_DUPLICATE_WINDOW_MS);
    const previous = id === undefined ? undefined : this.seen.get(id);

    if (previous !== undefined && now - previous.at < window) {
      return { seq: previous.seq, duplicate: true };
    }

    this.lastSeq += 1;
    this.messages.set(this.lastSeq, { seq: this.lastSeq, subject, headers, data, time: new Date(now) });

    if (id !== undefined) {
      this.seen.set(id, { seq: this.lastSeq, at: now });
    }

    return { seq: this.lastSeq, duplicate: false };
  }

  /** The first message at or after `seq` whose subject falls under `filter`. */
  next(seq: number, filter: string | undefined): StoredMessage | undefined {
    for (let candidate = Math.max(seq, 1); candidate <= this.lastSeq; candidate += 1) {
      const message = this.messages.get(candidate);

      if (message !== undefined && (filter === undefined || subjectMatches(filter, message.subject))) {
        return message;
      }
    }

    return undefined;
  }

  /** Messages at or after `seq` under `filter`: what a consumer has not been given yet. */
  countFrom(seq: number, filter: string | undefined): number {
    let count = 0;

    for (const message of this.messages.values()) {
      if (message.seq >= seq && (filter === undefined || subjectMatches(filter, message.subject))) {
        count += 1;
      }
    }

    return count;
  }

  state(): Json {
    const stored = [...this.messages.values()];
    const first = stored[0];
    const last = stored.at(-1);

    return {
      messages: stored.length,
      bytes: stored.reduce((total, message) => total + message.data.length + message.subject.length, 0),
      first_seq: first?.seq ?? (this.lastSeq === 0 ? 0 : this.lastSeq + 1),
      first_ts: first?.time.toISOString() ?? NO_TIME,
      last_seq: this.lastSeq,
      last_ts: last?.time.toISOString() ?? NO_TIME,
      consumer_count: this.consumers.size,
    };
  }
}

/** How the server writes a time it has none for. */
export const NO_TIME = '0001-01-01T00:00:00Z';
