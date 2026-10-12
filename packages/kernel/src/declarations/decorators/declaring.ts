import type { DependencyKind } from '../../application/dependency-kind.js';
import type { ClassDeclarator } from '../dependencies/class-declarator.js';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies.js';
import type { PortDeclaration } from '../model/port-declaration.js';
import { DeclarationError } from '../registry/declaration-error.js';
import { record } from '../registry/record.js';
import { portDefect } from '../token/port-defect.js';
import type { Token } from '../token/token.js';
import { isDependencies } from './is-dependencies.js';
import type { PortOptions } from './port-options.js';
import type { Settings } from './settings.js';

interface Port<T> {
  readonly role: PortDeclaration['role'];
  readonly kind: DependencyKind;
  readonly token: Token<T>;
}

export function declaring<T, D extends DeclaredDependencies>(
  port: Port<T>,
  [first, second]: Settings<PortOptions, D>,
): ClassDeclarator<T, D> {
  const options: PortOptions = isOptions(first) ? first : {};
  const dependencies: DeclaredDependencies = isDependencies(first) ? first : second;

  return (target) => {
    assertImplements(port.token, target);

    record(target, {
      ...port,
      lifetime: options.transient === true ? 'transient' : 'singleton',
      replaces: options.replaces === true,
      aspects: options.aspects ?? [],
      implementation: target,
      dependencies,
    });
  };
}

function isOptions(value: unknown): value is PortOptions {
  return typeof value === 'object' && value !== null && !isDependencies(value);
}

function assertImplements(port: Token<unknown>, adapter: Token<unknown>): void {
  const defect = portDefect(port, adapter);

  if (defect !== undefined) {
    throw new DeclarationError(defect);
  }
}
