import type { ExecutionScope } from '../ports/execution-scope.js';
import type { EventExecutionOptions } from './event-execution-options.js';
import { executionContextOfEvent } from './execution-context-of-event.js';
import type { IntegrationEventCallback } from './integration-event-callback.js';

/** Wraps a handler so that every event it receives is handled inside `scope.run`. */
export function inEventScope(
  scope: ExecutionScope,
  options: EventExecutionOptions,
  handler: IntegrationEventCallback,
): IntegrationEventCallback {
  return (event) => scope.run(executionContextOfEvent(event, options), () => handler(event));
}
