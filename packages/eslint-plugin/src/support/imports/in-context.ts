import type { ContextLocation } from '../../project/location';
import type { LintedFile } from '../../project/linted-file';

export function inContext(file: LintedFile): ContextLocation | undefined {
  return file.location.area === 'context' ? file.location : undefined;
}
