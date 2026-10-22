import type { DependencyKind } from '../../application/dependency-kind';
import type { ClassDeclarator } from '../dependencies/class-declarator';
import type { DeclaredDependencies } from '../dependencies/declared-dependencies';
import type { PortDeclaration } from '../model/port-declaration';
import { DeclarationError } from '../registry/declaration-error';
import { record } from '../registry/record';
import { portDefect } from '../token/port-defect';
import type { Token } from '../token/token';
import { isDependencies } from './is-dependencies';
import type { PortOptions } from './port-options';
import type { Settings } from './settings';

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
