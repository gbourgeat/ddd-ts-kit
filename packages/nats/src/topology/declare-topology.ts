import { AckPolicy, DeliverPolicy, RetentionPolicy, StorageType, type JetStreamManager } from '@nats-io/jetstream';
import { failureCode } from '../errors/failure-code';
import type { ConsumerDescription } from './consumer-description';
import type { NatsTopology } from './nats-topology';
import type { StreamDescription } from './stream-description';

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
