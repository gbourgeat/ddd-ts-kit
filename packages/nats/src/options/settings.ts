import type { NatsConnection } from '@nats-io/transport-node';
import type { NatsDelivery } from './nats-delivery';
import type { NatsFailure } from './nats-failure';
import type { ReconnectOptions } from './reconnect-options';
import type { RetryOptions } from './retry-options';
import type { StreamStorage } from './stream-storage';

export interface Settings {
  readonly open: () => Promise<NatsConnection>;
  readonly stream: string;
  readonly subjectPrefix: string;
  readonly consumer: string | undefined;
  readonly prefetch: number;
  readonly storage: StreamStorage;
  readonly replicas: number;
  readonly duplicateWindowMs: number;
  readonly ackWaitMs: number;
  readonly publishTimeoutMs: number;
  readonly retry: Required<RetryOptions>;
  readonly reconnect: Required<ReconnectOptions>;
  readonly onFailure: (failure: NatsFailure) => void;
  readonly onDelivery: (delivery: NatsDelivery) => void;
}
