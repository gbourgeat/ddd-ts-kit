import { compareText } from './internal/json-schema.js';
import type { AnyIntegrationEventDefinition } from './definition.js';

export class DuplicateEventDefinitionError extends Error {
  constructor(type: string, version: number) {
    super(`Integration event ${type} v${version} is already registered`);
    this.name = 'DuplicateEventDefinitionError';
  }
}

/** Every event a system publishes. Feeds validation, the AsyncAPI document and the catalog. */
export class EventRegistry {
  readonly #definitions = new Map<string, AnyIntegrationEventDefinition>();

  register(...definitions: readonly AnyIntegrationEventDefinition[]): this {
    for (const definition of definitions) {
      const key = keyOf(definition.type, definition.version);
      if (this.#definitions.has(key)) {
        throw new DuplicateEventDefinitionError(definition.type, definition.version);
      }
      this.#definitions.set(key, definition);
    }
    return this;
  }

  get(type: string, version: number): AnyIntegrationEventDefinition | undefined {
    return this.#definitions.get(keyOf(type, version));
  }

  /** Sorted by type then version, whatever the registration order. */
  all(): AnyIntegrationEventDefinition[] {
    return [...this.#definitions.values()].sort(
      (a, b) => compareText(a.type, b.type) || a.version - b.version,
    );
  }

  versionsOf(type: string): number[] {
    return this.all()
      .filter((definition) => definition.type === type)
      .map((definition) => definition.version);
  }
}

export function createEventRegistry(
  definitions: readonly AnyIntegrationEventDefinition[] = [],
): EventRegistry {
  return new EventRegistry().register(...definitions);
}

// A type never contains "@", so the key cannot collide.
function keyOf(type: string, version: number): string {
  return `${type}@${version}`;
}
