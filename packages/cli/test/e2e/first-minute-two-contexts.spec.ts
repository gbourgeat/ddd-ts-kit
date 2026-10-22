import { describe, it } from 'vitest';
import { initAloneIsGreen } from './init-alone';
import { label, RUNNABLE, SLOW } from './stacks';

/**
 * Slow, opt-in (DDD_TS_KIT_E2E=1): a project is green from its first minute, with the contexts asked of `init` and nothing generated,
 * on every stack the workspace can run and not only the proven ones. The other suites generate
 * every kind before they look: this is the state a team meets first.
 */
describe.runIf(SLOW)('what init alone leaves is green, whatever the stack: two contexts asked of init', () => {
  it.each(RUNNABLE.map((stack) => [label(stack), stack] as const))(
    '%s',
    (_label, stack) => {
      initAloneIsGreen(stack, ['--context', 'billing:core', '--context', 'shipping:supporting']);
    },
    240_000,
  );
});
