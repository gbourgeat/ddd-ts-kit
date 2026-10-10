const marked = new WeakSet<object>();

/**
 * Shaped like the class decorators of a framework: it notes the class and answers nothing, and
 * knows nothing of a decorator context.
 */
export function Marked() {
  return (target: abstract new (...args: never) => unknown): void => {
    marked.add(target);
  };
}

export function isMarked(target: object): boolean {
  return marked.has(target);
}
