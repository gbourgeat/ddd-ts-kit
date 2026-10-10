import type { LintedFile } from '../../project/linted-file.js';

export function isDeclaredStyle(file: LintedFile): boolean {
  return file.config.stack.style === 'declared';
}
