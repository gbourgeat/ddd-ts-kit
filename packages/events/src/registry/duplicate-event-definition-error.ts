export class DuplicateEventDefinitionError extends Error {
  constructor(type: string, version: number) {
    super(`Integration event ${type} v${version} is already registered`);
    this.name = 'DuplicateEventDefinitionError';
  }
}
