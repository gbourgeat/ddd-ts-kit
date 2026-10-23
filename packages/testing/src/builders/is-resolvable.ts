import { RESOLVE, type Resolvable } from './resolvable';

export function isResolvable(value: unknown): value is Resolvable<unknown> {
  return typeof value === 'object' && value !== null && RESOLVE in value;
}
