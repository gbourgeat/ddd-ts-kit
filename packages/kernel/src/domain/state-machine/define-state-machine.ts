import type { StateMachineDeclaration } from './state-machine-declaration.js';
import { StateMachine } from './state-machine.js';

/**
 * Declares the lifecycle of an aggregate, in `domain/state-machines/<aggregate>.state-machine.ts`:
 *
 *     export const appointmentLifecycle = defineStateMachine({
 *       states: Object.values(AppointmentStatus),
 *       initial: [AppointmentStatus.requested, AppointmentStatus.booked],
 *       transitions: {
 *         confirm: { from: [AppointmentStatus.requested], to: AppointmentStatus.booked },
 *         cancel: { from: [AppointmentStatus.requested, AppointmentStatus.booked], to: AppointmentStatus.cancelled },
 *       },
 *       refused: ({ from }) => AppointmentError.ended(from),
 *     });
 *
 * Throws `InvalidStateMachineError` when the file loads for a declaration that names an unknown
 * state. A guard receives the context the aggregate passes to `next`.
 */
export function defineStateMachine<const State extends string, const Name extends string, Context = void>(
  declaration: StateMachineDeclaration<State, Name, Context>,
): StateMachine<State, Name, Context> {
  return new StateMachine(declaration);
}
