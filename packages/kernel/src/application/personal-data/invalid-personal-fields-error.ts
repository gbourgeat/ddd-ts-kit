/** A declaration of personal fields that cannot be read: refused where it is written, before any row is touched. */
export class InvalidPersonalFieldsError extends Error {
  constructor(what: string) {
    super(`A declaration of personal fields ${what}`);
    this.name = 'InvalidPersonalFieldsError';
  }
}
