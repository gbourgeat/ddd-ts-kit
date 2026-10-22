import type { StateMachineDeclaration } from './state-machine-declaration';
import { StateMachine } from './state-machine';

/**
 * Declares the lifecycle of an aggregate, in `domain/state-machines/<aggregate>.state-machine.ts`:
 *
 *     export const appointmentLifecycle = defineStateMachine({
 *       states: Object.values(AppointmentStatus),
 *       initial: [AppointmentStatus.Requested, AppointmentStatus.Booked],
 *       transitions: {
 *         confirm: { from: [AppointmentStatus.Requested], to: AppointmentStatus.Booked },
 *         cancel: { from: [AppointmentStatus.Requested, AppointmentStatus.Booked], to: AppointmentStatus.Cancelled },
 *       },
 *       refused: ({ from }) => AppointmentError.ended(from),
 *     });
 *
 * Without `refused`, a forbidden transition throws `TransitionError.forbidden(from, transition)`.
 *
 * Throws `InvalidStateMachineError` when the file loads for a declaration that names an unknown
 * state. A guard receives the context the aggregate passes to `next`.
 */
export function defineStateMachine<const State extends string, const Name extends string, Context = void>(
  declaration: StateMachineDeclaration<State, Name, Context>,
): StateMachine<State, Name, Context> {
  return new StateMachine(declaration);
}
