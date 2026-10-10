import type { AnyIntegrationEventDefinition } from '../definition/any-integration-event-definition.js';
import { EventRegistry } from './event-registry.js';

export function createEventRegistry(definitions: readonly AnyIntegrationEventDefinition[] = []): EventRegistry {
  return new EventRegistry().register(...definitions);
}
