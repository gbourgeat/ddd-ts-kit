/** A declaration that cannot stand: written twice on one class, or on a class of another role. */
export class DeclarationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeclarationError';
  }
}
