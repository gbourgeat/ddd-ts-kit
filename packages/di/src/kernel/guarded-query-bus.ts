import { InMemoryQueryBus } from '@ddd-ts-kit/kernel';
import { useCaseGuardMiddleware } from '../authorization/use-case-guard-middleware.js';
import type { Resolve } from '../wiring/resolve.js';

export function guardedQueryBus(resolve: Resolve): InMemoryQueryBus {
  return new InMemoryQueryBus().use(useCaseGuardMiddleware(resolve));
}
