/** A projection asks for a mask and no masker was given: a wiring mistake. */
export class MissingMaskerError extends Error {
  constructor(field: string) {
    super(`The audited field "${field}" is declared masked and no masker was given`);
    this.name = 'MissingMaskerError';
  }
}
