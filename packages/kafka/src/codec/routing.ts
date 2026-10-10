import type { IntegrationEvent } from '@ddd-ts-kit/kernel';

/** Where an event goes and under which key. */
export interface Routing {
  readonly topicOf: (type: string) => string;
  readonly keyOf: (event: IntegrationEvent) => string | undefined;
}
