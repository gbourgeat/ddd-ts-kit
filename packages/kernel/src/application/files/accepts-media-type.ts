import { mediaTypeOf } from './media-type-of.js';

/** Whether a declared media type is in the accepted list, which may hold `type/*`. */
export function acceptsMediaType(accepted: readonly string[], declared: string): boolean {
  const essence = mediaTypeOf(declared);
  const [type] = essence.split('/');

  return accepted.some((entry) => {
    const allowed = mediaTypeOf(entry);

    return allowed === essence || allowed === `${type ?? ''}/*`;
  });
}
