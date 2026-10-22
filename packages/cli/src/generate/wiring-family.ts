import type { Config } from '../config';
import { isDeclared } from './is-declared';

export type WiringFamily = 'declared' | 'tsyringe' | 'manual';

/**
 * How the contexts of the project are wired: by their declarations, by a module file of
 * `@ddd-ts-kit/di`, or by hand on the platform (a Nest application hosts the same hand-wired
 * contexts as the manual stack).
 */
export function wiringFamily(config: Config): WiringFamily {
  if (isDeclared(config)) {
    return 'declared';
  }

  return config.stack.di === 'tsyringe' ? 'tsyringe' : 'manual';
}
