import type { LintedFile } from '../../project/linted-file.js';

/** A production or test source of the project itself, as opposed to a script or a config file next to it. */
export function inSourceRoot(file: LintedFile): boolean {
  return file.path.startsWith(`${file.config.sourceRoot}/`);
}
