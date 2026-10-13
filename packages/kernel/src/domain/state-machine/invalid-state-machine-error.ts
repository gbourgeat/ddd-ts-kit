/** A state machine whose declaration contradicts itself: raised where it is defined, when the file loads. */
export class InvalidStateMachineError extends Error {
  readonly code = 'INVALID_STATE_MACHINE';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidStateMachineError';
  }
}
