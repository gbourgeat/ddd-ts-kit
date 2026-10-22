import type { IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerRuntime } from '../consumer/consumer-runtime';
import type { Declarer } from './declarer';
import type { Resolve } from './resolve';

export interface EventConsumption {
  readonly type: string;
  readonly version: number;
  readonly consumer: string;
  readonly handler: Token<unknown>;
  readonly module: string;
  readonly declaredBy?: Declarer;
  /** Name of the projection the consumption belongs to, when it is not a handler of integration events. */
  readonly projection?: string;
  readonly subscribe: (resolve: Resolve, runtime: ConsumerRuntime) => IntegrationEventCallback;
}
