/** A criteria declaration that cannot stand: thrown when the file that declares it loads. */
export class CriteriaDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CriteriaDefinitionError';
  }
}
