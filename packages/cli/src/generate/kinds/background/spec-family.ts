import type { Scope } from '../../scope';

/**
 * How the spec of a background job runs it: through the test application of `@ddd-ts-kit/di` on
 * tsyringe, through a queue and a worker built on the test buses where the platform is wired by
 * hand (the explicit module of a Nest or manual project).
 */
export function specFamily(scope: Scope): 'tsyringe' | 'buses' {
  return scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses';
}
