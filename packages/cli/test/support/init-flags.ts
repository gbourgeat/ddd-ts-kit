import type { StackFlags } from './stack-flags';

/** The flags `init` takes for a stack; leaving the outbox out with a database is a deviation, which has to be given its reason. */
export function initFlags(stack: StackFlags): string[] {
  const noOutbox =
    stack.orm !== 'none' && stack.events !== 'outbox'
      ? ['--allow-no-outbox', 'A single process with no consumer that has to survive a crash']
      : [];

  return [...Object.entries(stack).flatMap(([key, value]) => [`--${key}`, String(value)]), ...noOutbox];
}
