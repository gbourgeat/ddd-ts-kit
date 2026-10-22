import type { IntegrationEventDefinition } from './integration-event-definition';

export type PayloadOf<D> = D extends IntegrationEventDefinition<infer P> ? P : never;
