const refused = new WeakSet<object>();

/**
 * The errors a guard threw to refuse a request, told apart from the refusals of a handler so
 * that the pipeline can report them as refusals at the edge (`onGuardRefusal`).
 */
export const guardRefusals = {
  mark(error: unknown): void {
    if (typeof error === 'object' && error !== null) {
      refused.add(error);
    }
  },
  has(error: unknown): boolean {
    return typeof error === 'object' && error !== null && refused.has(error);
  },
};
