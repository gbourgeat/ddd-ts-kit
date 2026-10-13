import type { ProcessDecision } from '@ddd-ts-kit/kernel';
import { ProcessOutcome } from './process-outcome.js';

/** A step of a process, from the state it starts in. */
export interface ProcessScenario<State> {
  when(step: (current: State | undefined) => ProcessDecision<State> | undefined): ProcessOutcome<State>;
}

/**
 * Starts the spec of a step of a process manager from a state, or from none for an instance
 * that does not exist yet: the step is a function of the state and of what happened, so it is
 * tested without a store, a queue or a bus.
 *
 *     givenProcess<ReminderState>(undefined)
 *       .when((current) => reminders.booked(event, current))
 *       .thenState({ appointmentId: 'a-1', stage: 'waiting' })
 *       .thenTimeouts([{ name: 'reminder-due', at: dueAt }]);
 */
export function givenProcess<State>(current: State | undefined): ProcessScenario<State> {
  return {
    when: (step) => new ProcessOutcome(step(current)),
  };
}
