import type { Config } from '../../config';
import { PINNED_BELOW_A_FIX } from './pinned-below-a-fix';

/**
 * Versions the project forces under a dependency of its stack that pins one below a fix. Each one
 * is removed once that dependency asks for the fixed version itself, which `ddd-ts-kit doctor` says.
 */
export function overridesFor(config: Config): Record<string, string> {
  return Object.fromEntries(
    PINNED_BELOW_A_FIX.filter((pin) => pin.applies(config)).map((pin) => [pin.name, pin.range]),
  );
}
