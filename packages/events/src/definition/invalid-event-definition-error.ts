export class InvalidEventDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidEventDefinitionError';
  }
}
