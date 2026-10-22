import type { AnyIntegrationEventDefinition } from '../definition/any-integration-event-definition';
import { EventRegistry } from './event-registry';

export function createEventRegistry(definitions: readonly AnyIntegrationEventDefinition[] = []): EventRegistry {
  return new EventRegistry().register(...definitions);
}
