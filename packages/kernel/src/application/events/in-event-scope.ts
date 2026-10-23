import type { ExecutionScope } from '../ports/execution-scope';
import type { EventExecutionOptions } from './event-execution-options';
import { executionContextOfEvent } from './execution-context-of-event';
import type { IntegrationEventCallback } from './integration-event-callback';

/** Wraps a handler so that every event it receives is handled inside `scope.run`. */
export function inEventScope(
  scope: ExecutionScope,
  options: EventExecutionOptions,
  handler: IntegrationEventCallback,
): IntegrationEventCallback {
  return (event, delivery) => scope.run(executionContextOfEvent(event, options), () => handler(event, delivery));
}
