/**
 * A scope names something the read port maps to no field. Thrown instead of reading without
 * the restriction: a list silently wider than the actor's rights is the worse failure.
 */
export class UnmappedReadScopeError extends Error {
  constructor(what: string) {
    super(`The access scope restricts by ${what}, which the read port maps to no field of its read model.`);
    this.name = 'UnmappedReadScopeError';
  }
}
