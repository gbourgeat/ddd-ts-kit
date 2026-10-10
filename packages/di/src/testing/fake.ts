import type { Token } from '@ddd-ts-kit/kernel/declarations';
import { override, type Override } from '../application/override.js';

/** A type-checked fake for `createTestApplication({ fakes })`: `fake(OrderRepository, new InMemoryOrderRepository())`. */
export function fake<T>(target: Token<T>, value: T): Override {
  return override(target, value);
}
