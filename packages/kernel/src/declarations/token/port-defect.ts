import { describeToken } from './describe-token';
import { prototypeOf } from './prototype-of';
import type { Token } from './token';

/**
 * Why `implementation` cannot be bound to `port`, or `undefined` when it can. A port is an
 * abstract class with abstract members only, and its adapter implements it without extending
 * it: both are checked here, where the compiler cannot. A class bound to itself is no port.
 */
export function portDefect(port: Token<unknown>, implementation: Token<unknown>): string | undefined {
  if (port === implementation) {
    return undefined;
  }

  const contract = prototypeOf(port);
  const implemented = implementedMembers(contract);

  if (implemented.length > 0) {
    return `${describeToken(port)} implements ${implemented.join(', ')}: a port is an abstract class with abstract members only, so that a fake or a plain object can stand for it.`;
  }

  if (contract !== undefined && Object.prototype.isPrototypeOf.call(contract, prototypeOf(implementation) ?? {})) {
    return `${describeToken(implementation)} extends ${describeToken(port)}: an adapter implements its port, it never extends it.`;
  }

  return undefined;
}

/** The members with a body, the inherited ones included: a port may extend a port. */
function implementedMembers(prototype: object | undefined): string[] {
  if (prototype === undefined || prototype === Object.prototype) {
    return [];
  }

  const own = Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor');
  const inherited: unknown = Object.getPrototypeOf(prototype);

  return [...own, ...implementedMembers(typeof inherited === 'object' && inherited !== null ? inherited : undefined)];
}
