import {
  AckPolicy,
  DeliverPolicy,
  RetentionPolicy,
  StorageType,
  type JetStreamManager,
} from '@nats-io/jetstream';
import { failureCode } from './errors.js';
import type { StreamStorage } from './options.js';

export interface StreamDescription {
  readonly name: string;
  /** `events` keeps what is published, `dead` keeps what a consumer gave up on. */
  readonly role: 'events' | 'dead';
  readonly subjects: readonly string[];
  readonly storage: StreamStorage;
  readonly replicas: number;
  readonly duplicateWindowMs: number;
}

export interface ConsumerDescription {
  readonly stream: string;
  /** The durable name. */
  readonly name: string;
  readonly filterSubject: string;
  readonly ackWaitMs: number;
  readonly maxDeliver: number;
}

/** Everything the bus creates on the server, as data: for documentation and reviews. */
export interface NatsTopology {
  readonly streams: readonly StreamDescription[];
  readonly consumers: readonly ConsumerDescription[];
}

export interface ConsumerBinding {
  readonly consumer: string;
  readonly type: string;
}

export interface TopologySettings {
  readonly stream: string;
  readonly subjectPrefix: string;
  readonly storage: StreamStorage;
  readonly replicas: number;
  readonly duplicateWindowMs: number;
  readonly ackWaitMs: number;
  readonly maxAttempts: number;
}

/** The names a binding has on the server. */
export interface BindingNames {
  /** The durable consumer: instances that share it share its messages. */
  readonly durable: string;
  /** The subject the events of the type are published to. */
  readonly subject: string;
  /** The subject, in the dead-letter stream, of what this consumer gave up on. */
  readonly deadSubject: string;
}

export function deadStreamOf(stream: string): string {
  return `${stream}-dead`;
}

/** A durable name holds neither dot nor wildcard: every other character becomes `_`. */
export function bindingNamesOf({ consumer, type }: ConsumerBinding, subjectPrefix: string): BindingNames {
  const durable = `${token(consumer)}_${token(type)}`;
  return {
    durable,
    subject: `${subjectPrefix}.${type}`,
    deadSubject: `dead.${subjectPrefix}.${token(consumer)}.${type}`,
  };
}

export function topologyOf(settings: TopologySettings, bindings: readonly ConsumerBinding[]): NatsTopology {
  const { stream, subjectPrefix, storage, replicas, duplicateWindowMs } = settings;
  const shared = { storage, replicas, duplicateWindowMs };
  return {
    streams: [
      { name: stream, role: 'events', subjects: [`${subjectPrefix}.>`], ...shared },
      { name: deadStreamOf(stream), role: 'dead', subjects: [`dead.${subjectPrefix}.>`], ...shared },
    ],
    consumers: bindings.map((binding) => consumerOf(settings, binding)),
  };
}

/**
 * Idempotent. A stream that exists is never altered, whatever its limits; a durable consumer
 * that exists takes the acknowledgement wait and the delivery limit of this bus.
 */
export async function declareTopology(manager: JetStreamManager, topology: NatsTopology): Promise<void> {
  for (const stream of topology.streams) {
    await declareStream(manager, stream);
  }
  for (const consumer of topology.consumers) {
    await declareConsumer(manager, consumer);
  }
}

const STREAM_EXISTS_WITH_ANOTHER_CONFIGURATION = 'JETSTREAM_10058';
const CONSUMER_EXISTS_WITH_ANOTHER_CONFIGURATION = 'JETSTREAM_10148';
const NANOSECONDS_PER_MILLISECOND = 1_000_000;

function token(name: string): string {
  return name.replaceAll(/[^A-Za-z0-9_-]/g, '_');
}

/**
 * The bus parks a message at its `maxAttempts`-th failed delivery. The limit of the server
 * is twice that: a delivery lost without a verdict (a crash, an expired acknowledgement
 * wait) counts too, and must leave room for the message to be parked.
 */
function consumerOf(settings: TopologySettings, binding: ConsumerBinding): ConsumerDescription {
  const names = bindingNamesOf(binding, settings.subjectPrefix);
  return {
    stream: settings.stream,
    name: names.durable,
    filterSubject: names.subject,
    ackWaitMs: settings.ackWaitMs,
    maxDeliver: settings.maxAttempts * 2,
  };
}

async function declareStream(manager: JetStreamManager, stream: StreamDescription): Promise<void> {
  try {
    await manager.streams.add({
      name: stream.name,
      subjects: [...stream.subjects],
      retention: RetentionPolicy.Limits,
      storage: stream.storage === 'file' ? StorageType.File : StorageType.Memory,
      num_replicas: stream.replicas,
      duplicate_window: stream.duplicateWindowMs * NANOSECONDS_PER_MILLISECOND,
      // Lets `replayDead` read the dead letters of one subject without a consumer.
      allow_direct: true,
    });
  } catch (error) {
    if (failureCode(error) !== STREAM_EXISTS_WITH_ANOTHER_CONFIGURATION) {
      throw error;
    }
  }
}

async function declareConsumer(manager: JetStreamManager, consumer: ConsumerDescription): Promise<void> {
  const limits = {
    ack_wait: consumer.ackWaitMs * NANOSECONDS_PER_MILLISECOND,
    max_deliver: consumer.maxDeliver,
  };
  try {
    await manager.consumers.add(consumer.stream, {
      durable_name: consumer.name,
      filter_subject: consumer.filterSubject,
      ack_policy: AckPolicy.Explicit,
      deliver_policy: DeliverPolicy.All,
      ...limits,
    });
  } catch (error) {
    if (failureCode(error) !== CONSUMER_EXISTS_WITH_ANOTHER_CONFIGURATION) {
      throw error;
    }
    await manager.consumers.update(consumer.stream, consumer.name, limits);
  }
}
