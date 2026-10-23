import type { ContextLocation } from '../../project/location';
import type { Layer } from '../../project/layer';
import type { LintedFile } from '../../project/linted-file';

export function inLayer(file: LintedFile, layer: Layer): ContextLocation | undefined {
  return file.location.area === 'context' && file.location.layer === layer && !file.isTest ? file.location : undefined;
}
