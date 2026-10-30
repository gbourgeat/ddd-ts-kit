import { CliError } from '../../cli-error';
import { parseVersion } from './parse-version';

/** An event type as the command line writes it: the type, and the version when one is named. */
export type TypeAsWritten = { readonly written: string; readonly version: number | undefined };

/**
 * Reads `<type>[@v<n>]`, the spelling `ddd-ts-kit list` prints, once. `--version`, when the kind takes
 * it, names the same version as the suffix or is refused.
 */
export function eventTypeAsPublished(input: string, flag: string | undefined): TypeAsWritten {
  const at = input.indexOf('@');
  const written = at === -1 ? input : input.slice(0, at);
  const fromSuffix = at === -1 ? undefined : parseVersion(input.slice(at + 1).replace(/^v/, ''));
  const fromFlag = flag === undefined ? undefined : parseVersion(flag);

  if (fromSuffix !== undefined && fromFlag !== undefined && fromSuffix !== fromFlag) {
    throw new CliError(
      `"${input}" names version ${fromSuffix} and --version ${fromFlag} names another.`,
      'Pass the version once: <type>@v<n>, or --version <n>, or both when they agree.',
    );
  }

  return { written, version: fromSuffix ?? fromFlag };
}
