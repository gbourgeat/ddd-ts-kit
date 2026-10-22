import type { ContextLocation } from '../model/context-location';

/** The directory of a file of a context, relative to the context, the way the canonical tree names it. */
export function roleDirectory({ layer, inside }: ContextLocation): string {
  return [layer, ...inside.slice(0, -1)].join('/');
}
