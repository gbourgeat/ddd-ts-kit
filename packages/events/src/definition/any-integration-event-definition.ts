import type { IntegrationEventDefinition } from './integration-event-definition.js';

/** A definition whose payload type is not known statically (registry, generators). */
export type AnyIntegrationEventDefinition = IntegrationEventDefinition<unknown>;
