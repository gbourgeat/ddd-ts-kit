import { CliError } from '../cli-error';
import { CONFIG_FILE } from '../config';
import type { AliasRoot } from './alias-root';

/** The alias of a directory of the project, without a final slash: what a template puts before the rest of a path. */
export function directoryAlias(roots: readonly AliasRoot[], directory: string): string {
  const root = roots.find((candidate) => `${directory}/`.startsWith(`${candidate.directory}/`));

  if (root === undefined) {
    throw new CliError(
      `${directory} is under no directory an import alias names.`,
      `Keep it under the source root in ${CONFIG_FILE}: a file is imported by an alias, never by a relative path.`,
    );
  }

  return `${root.prefix}${directory.slice(root.directory.length + 1)}`.replace(/\/$/, '');
}
