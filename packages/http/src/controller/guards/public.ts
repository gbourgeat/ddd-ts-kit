import type { Guard } from '../guard.js';

/**
 * Lets everybody through, the anonymous caller included. Said, never implied: a controller
 * with no group and no guard is refused, and this guard stands alone, never next to another.
 */
export const Public: Guard = {
  documents: { public: true },
  check() {
    return undefined;
  },
};
