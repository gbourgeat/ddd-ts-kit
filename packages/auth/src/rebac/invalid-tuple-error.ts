/** A tuple that cannot be read or that the schema does not allow. */
export class InvalidTupleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTupleError';
  }
}
