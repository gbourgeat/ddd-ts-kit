/** A mistake of the caller: reported with what to do instead, exit code 2. */
export class CliError extends Error {
  readonly exitCode = 2;

  constructor(
    message: string,
    readonly fix: string,
  ) {
    super(message);
    this.name = 'CliError';
  }
}
