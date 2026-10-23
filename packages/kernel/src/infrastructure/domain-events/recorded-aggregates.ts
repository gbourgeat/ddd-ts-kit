import type { AggregateRoot } from '../../domain/aggregate-root';

type EventSource = Pick<AggregateRoot<string | number>, 'pullEvents'>;

/**
 * The aggregates among the arguments of a call, given as such or in arrays, in the order
 * written. Recognised by what they do, not by their class: a context compiled apart extends
 * its own copy of `AggregateRoot`.
 */
export function recordedAggregates(args: readonly unknown[]): EventSource[] {
  return args.flatMap(listOf).filter(isEventSource);
}

function listOf(argument: unknown): readonly unknown[] {
  return Array.isArray(argument) ? argument : [argument];
}

function isEventSource(value: unknown): value is EventSource {
  return typeof value === 'object' && value !== null && 'pullEvents' in value && typeof value.pullEvents === 'function';
}
