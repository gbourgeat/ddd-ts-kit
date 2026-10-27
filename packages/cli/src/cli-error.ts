/** A mistake of the caller: reported with what to do instead, exit code 2 unless the command says another. */
export class CliError extends Error {
  constructor(
    message: string,
    readonly fix: string,
    readonly exitCode: number = 2,
  ) {
    super(message);
    this.name = 'CliError';
  }
}
