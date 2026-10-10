import type { ContextLocation } from '../../project/location.js';
import type { Layer } from '../../project/layer.js';
import type { LintedFile } from '../../project/linted-file.js';

export function inLayer(file: LintedFile, layer: Layer): ContextLocation | undefined {
  return file.location.area === 'context' && file.location.layer === layer && !file.isTest ? file.location : undefined;
}
