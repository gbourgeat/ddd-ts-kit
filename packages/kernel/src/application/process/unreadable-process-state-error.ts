/** A stored state the process does not recognise: written by another version of it, or by hand. */
export class UnreadableProcessStateError extends Error {
  readonly code = 'UNREADABLE_PROCESS_STATE';

  constructor(process: string, id: string) {
    super(`The stored state of process "${process}" ${id} is not one this version of the process reads.`);
    this.name = 'UnreadableProcessStateError';
  }
}
