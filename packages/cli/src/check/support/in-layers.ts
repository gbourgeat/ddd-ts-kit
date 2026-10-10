import type { ContextLocation } from '../model/context-location.js';
import type { Layer } from '../model/layer.js';
import type { SourceFile } from '../model/source-file.js';
import { inLayer } from './in-layer.js';

/** The place of a source of the production code of a context, when it is in one of the given layers. */
export function inLayers(file: SourceFile, layers: readonly Layer[]): ContextLocation | undefined {
  return layers.map((layer) => inLayer(file, layer)).find((location) => location !== undefined);
}
