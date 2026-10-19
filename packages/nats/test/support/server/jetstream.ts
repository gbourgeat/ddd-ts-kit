import {
  accountInfo,
  apiError,
  consumerConfigOf,
  consumerNotFound,
  streamConfigOf,
  streamInfo,
  streamNotFound,
  success,
} from './api-replies.js';
import { decodeHeaders, encodeHeaders, statusHeaders } from './headers.js';
import { type Json, bodyOf, numberIn, recordIn, sameJson, stringIn } from './json.js';
import type { Outbox } from './outbox.js';
import { PullConsumer } from './pull-consumer.js';
import { type Appended, Stream } from './stream.js';

/**
 * The JetStream of the server: the API under `$JS.API`, the acknowledgements under `$JS.ACK`,
 * and the publications a stream captures. What the bus and its specs call, answered as
 * nats-server 2.15 answers it; anything else gets an error naming it.
 */
export class JetStream {
  private readonly streams = new Map<string, Stream<PullConsumer>>();

  constructor(private readonly outbox: Outbox) {}

  /** A request to the API, answered on its reply subject (a pull request answers with messages). */
  request(subject: string, data: Buffer, reply: string): void {
    const tokens = subject.split('.').slice(2);
    const body = bodyOf(data);
    const [area = '', operation = ''] = tokens;

    if (area === 'DIRECT' && operation === 'GET') {
      this.directGet(tokens[2] ?? '', body, reply);
    } else if (area === 'CONSUMER' && operation === 'MSG' && tokens[2] === 'NEXT') {
      this.pull(tokens[3] ?? '', tokens[4] ?? '', body, reply);
    } else {
      this.respond(reply, this.answer(tokens, body));
    }
  }

  acknowledge(subject: string, data: Buffer): void {
    const [, , stream = '', consumer = '', , seq = ''] = subject.split('.');

    this.streams.get(stream)?.consumers.get(consumer)?.acknowledge(Number(seq), data.toString('utf8').trim());
  }

  /** Stores a publication in the stream that captures its subject, if one does. */
  store(
    subject: string,
    headers: Buffer | undefined,
    data: Buffer,
  ): (Appended & { readonly stream: string }) | undefined {
    const stream = [...this.streams.values()].find((candidate) => candidate.captures(subject));

    if (stream === undefined) {
      return undefined;
    }

    const appended = stream.append(subject, headers, data);

    for (const consumer of stream.consumers.values()) {
      consumer.dispatch();
    }

    return { ...appended, stream: stream.name };
  }

  stop(): void {
    for (const stream of this.streams.values()) {
      for (const consumer of stream.consumers.values()) {
        consumer.stop(false);
      }
    }
  }

  private answer(tokens: readonly string[], body: Json): Json {
    const [area = '', operation = '', ...names] = tokens;
    const route = `${area} ${operation}`;

    switch (route) {
      case 'INFO ':
        return accountInfo(this.streams.size, this.consumerCount());
      case 'STREAM CREATE':
        return this.createStream(names[0] ?? '', body);
      case 'STREAM INFO':
        return this.withStream(names[0], 'stream_info', (stream) => streamInfo('stream_info', stream));
      case 'STREAM DELETE':
        return this.withStream(names[0], 'stream_delete', (stream) => this.deleteStream(stream));
      case 'STREAM MSG':
        return this.message(names[0] ?? '', names[1] ?? '', body);
      case 'CONSUMER CREATE':
        return this.createConsumer(names[0] ?? '', names[1] ?? '', body);
      case 'CONSUMER DURABLE':
        return this.createConsumer(names[1] ?? '', names[2] ?? '', body);
      case 'CONSUMER INFO':
        return this.withConsumer(names[0], names[1], 'consumer_info', (consumer) => consumer.info());
      case 'CONSUMER DELETE':
        return this.withConsumer(names[0], names[1], 'consumer_delete', (consumer, stream) => {
          consumer.stop(true);
          stream.consumers.delete(consumer.name);

          return success('consumer_delete');
        });
      default:
        return apiError('unknown', 400, 10_003, `$JS.API.${tokens.join('.')} is not served by the in-memory server`);
    }
  }

  private createStream(name: string, requested: Json): Json {
    const existing = this.streams.get(name);

    if (existing === undefined) {
      const stream = new Stream<PullConsumer>(name, requested, streamConfigOf(requested));

      this.streams.set(name, stream);

      return streamInfo('stream_create', stream);
    }

    if (!sameJson(existing.requested, requested)) {
      return apiError('stream_create', 400, 10_058, 'stream name already in use with a different configuration');
    }

    return streamInfo('stream_create', existing);
  }

  private deleteStream(stream: Stream<PullConsumer>): Json {
    for (const consumer of stream.consumers.values()) {
      consumer.stop(true);
    }

    this.streams.delete(stream.name);

    return success('stream_delete');
  }

  /** `STREAM.MSG.GET` and `STREAM.MSG.DELETE`, by sequence. */
  private message(operation: string, name: string, body: Json): Json {
    const kind = operation === 'GET' ? 'stream_msg_get' : 'stream_msg_delete';

    return this.withStream(name, kind, (stream) => {
      const seq = numberIn(body, 'seq') ?? 0;
      const message = stream.messages.get(seq);

      if (message === undefined) {
        return apiError(kind, 404, 10_037, 'no message found');
      }

      if (operation !== 'GET') {
        stream.messages.delete(seq);

        return success(kind);
      }

      const hdrs = message.headers === undefined ? {} : { hdrs: message.headers.toString('base64') };
      const stored = { subject: message.subject, seq, ...hdrs, data: message.data.toString('base64') };

      return {
        type: `io.nats.jetstream.api.v1.${kind}_response`,
        message: { ...stored, time: message.time.toISOString() },
      };
    });
  }

  private createConsumer(streamName: string, name: string, body: Json): Json {
    const kind = 'consumer_create';
    const stream = this.streams.get(streamName);
    const requested = recordIn(body, 'config');
    const action = stringIn(body, 'action') ?? '';

    if (stream === undefined) {
      return streamNotFound(kind);
    }

    const existing = stream.consumers.get(name);
    const maxConsumers = numberIn(stream.config, 'max_consumers') ?? -1;

    if (existing === undefined) {
      if (action === 'update') {
        return apiError(kind, 404, 10_149, 'consumer does not exist');
      }

      if (maxConsumers > 0 && stream.consumers.size >= maxConsumers) {
        return apiError(kind, 400, 10_026, 'maximum consumers limit reached');
      }

      const consumer = new PullConsumer(stream, name, requested, consumerConfigOf(name, requested), this.outbox);

      stream.consumers.set(name, consumer);

      return { ...consumer.info(), type: 'io.nats.jetstream.api.v1.consumer_create_response' };
    }

    if (action === 'create' && !sameJson(existing.requested, requested)) {
      return apiError(kind, 400, 10_148, 'consumer already exists');
    }

    existing.requested = requested;
    existing.config = consumerConfigOf(name, requested);

    return { ...existing.info(), type: 'io.nats.jetstream.api.v1.consumer_create_response' };
  }

  private pull(streamName: string, name: string, body: Json, inbox: string): void {
    const consumer = this.streams.get(streamName)?.consumers.get(name);

    if (consumer === undefined) {
      this.outbox.deliver(inbox, inbox, undefined, statusHeaders(404, 'No Messages'), Buffer.alloc(0));
    } else {
      consumer.pull(inbox, body);
    }
  }

  /** `DIRECT.GET`: the message itself, its place in the stream added as headers, or a 404 status. */
  private directGet(name: string, body: Json, reply: string): void {
    const stream = this.streams.get(name);
    const seq = numberIn(body, 'seq') ?? 0;
    const bySubject = stringIn(body, 'next_by_subj');
    const message = bySubject === undefined ? stream?.messages.get(seq) : stream?.next(seq, bySubject);

    if (stream === undefined || message === undefined) {
      this.outbox.deliver(reply, reply, undefined, statusHeaders(404, 'Message Not Found'), Buffer.alloc(0));

      return;
    }

    const { fields } = decodeHeaders(message.headers);

    const headers = encodeHeaders({
      code: 0,
      description: '',
      fields: [
        ...fields,
        ['Nats-Stream', stream.name],
        ['Nats-Subject', message.subject],
        ['Nats-Sequence', String(message.seq)],
        ['Nats-Time-Stamp', message.time.toISOString()],
      ],
    });

    this.outbox.deliver(reply, reply, undefined, headers, message.data);
  }

  private withStream(name: string | undefined, kind: string, answer: (stream: Stream<PullConsumer>) => Json): Json {
    const stream = this.streams.get(name ?? '');

    return stream === undefined ? streamNotFound(kind) : answer(stream);
  }

  private withConsumer(
    streamName: string | undefined,
    name: string | undefined,
    kind: string,
    answer: (consumer: PullConsumer, stream: Stream<PullConsumer>) => Json,
  ): Json {
    const stream = this.streams.get(streamName ?? '');
    const consumer = stream?.consumers.get(name ?? '');

    if (stream === undefined) {
      return streamNotFound(kind);
    }

    return consumer === undefined ? consumerNotFound(kind) : answer(consumer, stream);
  }

  private respond(reply: string, body: Json): void {
    this.outbox.deliver(reply, reply, undefined, undefined, Buffer.from(JSON.stringify(body)));
  }

  private consumerCount(): number {
    return [...this.streams.values()].reduce((total, stream) => total + stream.consumers.size, 0);
  }
}
