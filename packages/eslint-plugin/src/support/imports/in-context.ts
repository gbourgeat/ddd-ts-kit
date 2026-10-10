import type { ContextLocation } from '../../project/location.js';
import type { LintedFile } from '../../project/linted-file.js';

export function inContext(file: LintedFile): ContextLocation | undefined {
  return file.location.area === 'context' ? file.location : undefined;
}
