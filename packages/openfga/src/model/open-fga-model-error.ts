/** A schema OpenFGA cannot hold as it is: a relation name it refuses, or two names that become one. */
export class OpenFgaModelError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenFgaModelError';
  }
}
