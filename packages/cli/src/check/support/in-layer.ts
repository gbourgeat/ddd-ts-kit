import type { ContextLocation } from '../model/context-location';
import type { Layer } from '../model/layer';
import type { SourceFile } from '../model/source-file';
import { inContext } from './in-context';

/** The place of a source of the production code of a context, when it is in the given layer. */
export function inLayer(file: SourceFile, layer: Layer): ContextLocation | undefined {
  return inContext(file.location) && file.location.layer === layer && !file.isTest ? file.location : undefined;
}
