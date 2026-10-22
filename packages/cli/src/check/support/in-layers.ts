import type { ContextLocation } from '../model/context-location';
import type { Layer } from '../model/layer';
import type { SourceFile } from '../model/source-file';
import { inLayer } from './in-layer';

/** The place of a source of the production code of a context, when it is in one of the given layers. */
export function inLayers(file: SourceFile, layers: readonly Layer[]): ContextLocation | undefined {
  return layers.map((layer) => inLayer(file, layer)).find((location) => location !== undefined);
}
