import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { DependenciesFromSignature } from '../dependencies/dependencies-from-signature.js';
import { DeclarationError } from '../registry/declaration-error.js';
import { record } from '../registry/record.js';

/**
 * Declares a class of the edge, for the decorators of a transport package to build on:
 * `@Controller` of `@ddd-ts-kit/http` calls `Edge('controller')` on the class it decorates.
 * Not written in a project: a project writes the decorator of the transport.
 */
export function Edge<Instance = unknown, const D extends DeclaredDependencies = DependenciesFromSignature>(
  part: string,
  dependencies?: D,
): ClassDeclarator<Instance, D> {
  if (!/^[a-z][a-z-]*$/.test(part)) {
    throw new DeclarationError(`An edge part is named in lower-case words, and "${part}" is not.`);
  }

  return (target) => {
    record(target, { role: 'edge', part, implementation: target, dependencies });
  };
}
