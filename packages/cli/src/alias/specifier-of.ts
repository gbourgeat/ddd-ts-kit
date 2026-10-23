import { CliError } from '../cli-error';
import { CONFIG_FILE, type Config } from '../config';
import { aliasRoots } from './alias-roots';
import { specifierSuffix } from './specifier-suffix';
import { toAlias } from './to-alias';

/**
 * How a generated import names a file of the project, given from the project root with or
 * without its extension: by its alias, ending as "importExtension" says.
 */
export function specifierOf(config: Config, file: string): string {
  const specifier = toAlias(aliasRoots(config), file, specifierSuffix(config.importExtension));

  if (specifier === undefined) {
    throw new CliError(
      `${file} is under no directory an import alias names.`,
      `Keep it under the source root in ${CONFIG_FILE}: a file is imported by an alias, never by a relative path.`,
    );
  }

  return specifier;
}
