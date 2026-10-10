import type { ContextLocation } from '../model/context-location.js';
import type { Layer } from '../model/layer.js';
import type { SourceFile } from '../model/source-file.js';
import { inContext } from './in-context.js';

/** The place of a source of the production code of a context, when it is in the given layer. */
export function inLayer(file: SourceFile, layer: Layer): ContextLocation | undefined {
  return inContext(file.location) && file.location.layer === layer && !file.isTest ? file.location : undefined;
}
