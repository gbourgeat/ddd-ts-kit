import { declarationOf, type DeclaredClass, type Token } from '@ddd-ts-kit/kernel/declarations';
import type { DeclaredSource } from './declared-source';

/**
 * The token each declared class of a source is bound under: its port for a repository, a
 * gateway or an adapter, the class itself for a handler, a policy, a job or a projection. A
 * message is bound under nothing and an undeclared value is left out. What a test resolves to
 * prove that every class of a context can be built:
 * `declaredTokens(billing).forEach((token) => application.resolve(token))`.
 */
export function declaredTokens(source: DeclaredSource): Token<unknown>[] {
  return [...new Set(classesOf(source).flatMap(tokenOf))];
}

function classesOf(source: DeclaredSource): DeclaredClass[] {
  if (typeof source === 'function') {
    return [source];
  }

  if (isList(source)) {
    return source.flatMap((part) => classesOf(part));
  }

  return Object.values(source).filter((value): value is DeclaredClass => declarationOf(value) !== undefined);
}

function isList(source: DeclaredSource): source is readonly DeclaredSource[] {
  return Array.isArray(source);
}

function tokenOf(target: DeclaredClass): Token<unknown>[] {
  const declaration = declarationOf(target);

  if (declaration === undefined || declaration.role === 'message') {
    return [];
  }

  return ['repository', 'gateway', 'adapter'].includes(declaration.role) && 'token' in declaration
    ? [declaration.token]
    : [target];
}
