/** An aspect was put where it must not go: a wiring mistake, raised when the instance is wrapped. */
export class AspectNotAllowedError extends Error {
  readonly code = 'ASPECT_NOT_ALLOWED';

  constructor(message: string) {
    super(message);
    this.name = 'AspectNotAllowedError';
  }
}
