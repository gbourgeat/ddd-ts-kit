export class DuplicateRouteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateRouteError';
  }
}
