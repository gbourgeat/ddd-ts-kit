import {
  FixedClock,
  FixedExecutionScope,
  SequentialIdGenerator,
  executionContext,
  type Actor,
  type ExecutionContext,
} from '@ddd-ts-kit/kernel';

export const NOW = new Date('2026-03-01T10:00:00.000Z');

export const ada: Actor = { id: 'ada', type: 'user', tenantId: 'acme', roles: ['practitioner'], attributes: {} };
export const support: Actor = { id: 'support-7', type: 'user', roles: ['support'], attributes: {} };

export function requestOf(actor: Actor, more: Partial<ExecutionContext> = {}): ExecutionContext {
  return executionContext({ correlationId: 'correlation-1', causationId: 'request-1', actor, origin: 'http', ...more });
}

/** What every source is given: a scope opened on a request of ada, a fixed clock, readable ids. */
export function aSource(context: ExecutionContext = requestOf(ada)) {
  return {
    scope: new FixedExecutionScope(context),
    clock: new FixedClock(NOW),
    ids: new SequentialIdGenerator('audit'),
  };
}
