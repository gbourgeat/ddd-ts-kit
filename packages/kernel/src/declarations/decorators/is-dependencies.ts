import type { Dependencies } from '../dependencies/dependencies';

export function isDependencies(value: unknown): value is Dependencies {
  return Array.isArray(value);
}
