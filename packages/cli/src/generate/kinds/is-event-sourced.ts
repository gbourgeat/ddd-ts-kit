import type { Name } from '../../naming';
import type { Scope } from '../scope';

const EVENT_SOURCED = /\bextends\s+EventSourcedAggregate\b/;

/**
 * Whether the aggregate keeps its state as the stream of its events: its class extends
 * `EventSourcedAggregate`. The source is the signal the generators already read; the codec file
 * can be missing in a project that is being written, the class cannot.
 */
export function isEventSourced(scope: Scope, aggregate: Name): boolean {
  const source = scope.ws.read(`${scope.dir}/domain/aggregates/${aggregate.kebab}.aggregate.ts`);

  return source !== undefined && EVENT_SOURCED.test(source);
}
