import type { DomainEvent } from '@ddd-ts-kit/kernel';

/** What a scenario needs from an aggregate: the events it recorded. */
export interface EventSource {
  pullEvents(): DomainEvent[];
}
