import { Repository, type DependencyKind } from '@ddd-ts-kit/kernel';
import type { Token } from '@ddd-ts-kit/kernel/declarations';

/**
 * The kind a port has by what it is, before any `.as(kind)`: a port extending the kernel
 * `Repository` is a repository, so its save dispatches domain events even when the module
 * forgot to say so.
 */
export function naturalKind(port: Token<unknown>): DependencyKind | undefined {
  const prototype: unknown = Reflect.get(port, 'prototype');

  return prototype instanceof Repository ? 'repository' : undefined;
}
