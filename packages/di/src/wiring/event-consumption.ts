import type { IntegrationEventCallback } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';
import type { ConsumerRuntime } from '../consumer/consumer-runtime.js';
import type { Declarer } from './declarer.js';
import type { Resolve } from './resolve.js';

export interface EventConsumption {
  readonly type: string;
  readonly version: number;
  readonly consumer: string;
  readonly handler: Token<unknown>;
  readonly module: string;
  readonly declaredBy?: Declarer;
  readonly subscribe: (resolve: Resolve, runtime: ConsumerRuntime) => IntegrationEventCallback;
}
