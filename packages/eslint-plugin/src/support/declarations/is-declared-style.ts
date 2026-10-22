import type { LintedFile } from '../../project/linted-file';

export function isDeclaredStyle(file: LintedFile): boolean {
  return file.config.stack.style === 'declared';
}
