import { CliError } from '../../cli-error';

/** The version of an integration event: a positive integer, written as digits only. */
export function parseVersion(input: string): number {
  if (/^[0-9]+$/.test(input) && Number(input) >= 1) {
    return Number(input);
  }

  throw new CliError(
    `"${input}" is not a valid version.`,
    'Pass a positive integer, --version <n> or <type>@v<n> as `ddd-ts-kit list` prints it; bump it only for a breaking change of the payload.',
  );
}
