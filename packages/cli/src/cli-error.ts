/**
 * A mistake of the caller: reported with what to do instead, exit code 2 unless the command says
 * another. `facts` are what a script reads of it beside the two sentences: they join `message` and
 * `fix` in the error `--json` prints.
 */
export class CliError extends Error {
  constructor(
    message: string,
    readonly fix: string,
    readonly exitCode: number = 2,
    readonly facts: Readonly<Record<string, unknown>> = {},
  ) {
    super(message);
    this.name = 'CliError';
  }
}
