import { statusHeaders } from './headers';
import { type Json, millisecondsOf, numberIn, stringIn } from './json';
import type { Outbox } from './outbox';
import type { Stream } from './stream';

type Timer = ReturnType<typeof setTimeout>;

/** A pull request waiting for messages: its inbox, what it still takes, its expiry and heartbeat. */
interface Pull {
  readonly inbox: string;
  remaining: number;
  readonly expiry: Timer | undefined;
  readonly heartbeat: ReturnType<typeof setInterval> | undefined;
}

/** A message given out and not acknowledged yet, waiting for its acknowledgement or its redelivery. */
interface Unacked {
  deliveries: number;
  timer: Timer | undefined;
}

const DEFAULT_ACK_WAIT_MS = 30_000;

/**
 * A durable pull consumer with explicit acknowledgement and `deliver_policy: all`. A message is
 * given to the oldest pull request with room, redelivered after `ack_wait` or a delayed `-NAK`,
 * given up after `max_deliver` deliveries, forgotten on `+ACK` and `+TERM`.
 */
export class PullConsumer {
  readonly created = new Date();

  private readonly pulls: Pull[] = [];

  private readonly unacked = new Map<number, Unacked>();

  private readonly redeliveries: number[] = [];

  /** The next stream sequence never given to this consumer. */
  private cursor = 1;

  private consumerSeq = 0;

  private lastStreamSeq = 0;

  constructor(
    private readonly stream: Stream,
    readonly name: string,
    public requested: Json,
    public config: Json,
    private readonly outbox: Outbox,
  ) {}

  /** `$JS.API.CONSUMER.MSG.NEXT`: a request for `batch` messages, answered on its inbox. */
  pull(inbox: string, request: Json): void {
    const expiresMs = millisecondsOf(numberIn(request, 'expires'), 0);
    const heartbeatMs = millisecondsOf(numberIn(request, 'idle_heartbeat'), 0);

    const pull: Pull = {
      inbox,
      remaining: numberIn(request, 'batch') ?? 1,
      expiry: expiresMs > 0 ? unref(setTimeout(() => this.expire(pull), expiresMs)) : undefined,
      heartbeat:
        heartbeatMs > 0 ? unref(setInterval(() => this.status(inbox, 100, 'Idle Heartbeat'), heartbeatMs)) : undefined,
    };

    this.pulls.push(pull);
    this.dispatch();
  }

  /** `$JS.ACK.<stream>.<consumer>.<deliveries>.<stream seq>...`: what the client says of one delivery. */
  acknowledge(seq: number, verb: string): void {
    const entry = this.unacked.get(seq);

    if (entry === undefined) {
      return;
    }

    clearTimeout(entry.timer);

    if (verb.startsWith('+WPI')) {
      entry.timer = this.ackWait(seq);
    } else if (verb.startsWith('-NAK')) {
      const delayMs = millisecondsOf(numberIn(delayOf(verb), 'delay'), 0);

      entry.timer = unref(setTimeout(() => this.redeliver(seq), delayMs));
    } else {
      this.unacked.delete(seq);
    }
  }

  /** Gives ready messages to the pull requests that have room, oldest first. */
  dispatch(): void {
    for (let pull = this.nextPull(); pull !== undefined; pull = this.nextPull()) {
      const seq = this.nextMessage();

      if (seq === undefined) {
        return;
      }

      this.deliver(pull, seq);
    }
  }

  /** The consumer or its stream was deleted: the pull requests hear it, the timers stop. */
  stop(deleted: boolean): void {
    for (const pull of this.pulls.splice(0)) {
      if (deleted) {
        this.status(pull.inbox, 409, 'Consumer Deleted');
      }

      finish(pull);
    }

    for (const entry of this.unacked.values()) {
      clearTimeout(entry.timer);
    }

    this.unacked.clear();
  }

  info(): Json {
    const filter = this.filter();

    return {
      type: 'io.nats.jetstream.api.v1.consumer_info_response',
      stream_name: this.stream.name,
      name: this.name,
      created: this.created.toISOString(),
      config: this.config,
      delivered: { consumer_seq: this.consumerSeq, stream_seq: this.lastStreamSeq },
      ack_floor: { consumer_seq: 0, stream_seq: 0 },
      num_ack_pending: this.unacked.size,
      num_redelivered: this.redeliveries.length,
      num_waiting: this.pulls.length,
      num_pending: this.stream.countFrom(this.cursor, filter),
      ts: new Date().toISOString(),
    };
  }

  private deliver(pull: Pull, seq: number): void {
    const message = this.stream.messages.get(seq);

    if (message === undefined) {
      return;
    }

    const entry = this.unacked.get(seq) ?? { deliveries: 0, timer: undefined };

    entry.deliveries += 1;
    entry.timer = this.ackWait(seq);
    this.unacked.set(seq, entry);
    this.consumerSeq += 1;
    this.lastStreamSeq = Math.max(this.lastStreamSeq, seq);

    const pending = this.stream.countFrom(this.cursor, this.filter());
    const tokens = [entry.deliveries, seq, this.consumerSeq, `${String(message.time.getTime())}000000`, pending];
    const reply = ['$JS.ACK', this.stream.name, this.name, ...tokens.map(String)].join('.');

    this.outbox.deliver(pull.inbox, message.subject, reply, message.headers, message.data);
    pull.remaining -= 1;

    if (pull.remaining <= 0) {
      this.pulls.splice(this.pulls.indexOf(pull), 1);
      finish(pull);
    }
  }

  /** The oldest pull request whose client still listens; the others are dropped. */
  private nextPull(): Pull | undefined {
    while (this.pulls[0] !== undefined && !this.outbox.listens(this.pulls[0].inbox)) {
      const gone = this.pulls.shift();

      if (gone !== undefined) {
        finish(gone);
      }
    }

    return this.pulls[0];
  }

  /** A redelivery first, then the next message never given out. */
  private nextMessage(): number | undefined {
    for (let seq = this.redeliveries.shift(); seq !== undefined; seq = this.redeliveries.shift()) {
      if (this.stream.messages.has(seq) && this.unacked.has(seq)) {
        return seq;
      }

      this.unacked.delete(seq);
    }

    const message = this.stream.next(this.cursor, this.filter());

    if (message !== undefined) {
      this.cursor = message.seq + 1;
    }

    return message?.seq;
  }

  /** After `ack_wait` without an answer, the message goes out again. */
  private ackWait(seq: number): Timer {
    const waitMs = millisecondsOf(numberIn(this.config, 'ack_wait'), DEFAULT_ACK_WAIT_MS);

    return unref(setTimeout(() => this.redeliver(seq), waitMs));
  }

  private redeliver(seq: number): void {
    const entry = this.unacked.get(seq);
    const maxDeliver = numberIn(this.config, 'max_deliver') ?? -1;

    if (entry === undefined) {
      return;
    }

    if (maxDeliver > 0 && entry.deliveries >= maxDeliver) {
      this.unacked.delete(seq);

      return;
    }

    this.redeliveries.push(seq);
    this.dispatch();
  }

  /** The request expired with room left: the server says so, with what it did not deliver. */
  private expire(pull: Pull): void {
    const index = this.pulls.indexOf(pull);

    if (index >= 0) {
      this.pulls.splice(index, 1);

      this.status(pull.inbox, 408, 'Request Timeout', [
        ['Nats-Pending-Messages', String(pull.remaining)],
        ['Nats-Pending-Bytes', '0'],
      ]);

      finish(pull);
    }
  }

  private status(inbox: string, code: number, description: string, fields: (readonly [string, string])[] = []): void {
    this.outbox.deliver(inbox, inbox, undefined, statusHeaders(code, description, fields), Buffer.alloc(0));
  }

  private filter(): string | undefined {
    return stringIn(this.config, 'filter_subject');
  }
}

function finish(pull: Pull): void {
  clearTimeout(pull.expiry);
  clearInterval(pull.heartbeat);
}

/** `-NAK {"delay": <nanoseconds>}`, or a plain `-NAK`. */
function delayOf(verb: string): Json {
  const json = verb.slice('-NAK'.length).trim();

  try {
    const parsed: unknown = json === '' ? {} : JSON.parse(json);

    return typeof parsed === 'object' && parsed !== null ? Object.fromEntries(Object.entries(parsed)) : {};
  } catch {
    return {};
  }
}

function unref<T extends { unref(): unknown }>(timer: T): T {
  timer.unref();

  return timer;
}
