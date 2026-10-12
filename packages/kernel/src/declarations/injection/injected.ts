import type { Dependencies } from '../dependencies/dependencies.js';
import type { DependencyList } from '../dependencies/dependency-list.js';
import type { DependencyTokens } from '../dependencies/dependency-tokens.js';
import { DeclarationError } from '../registry/declaration-error.js';
import { describeToken } from '../token/describe-token.js';
import { injectedRegistry } from './injected-registry.js';

/**
 * Says what the constructor of a class receives, one token per parameter, in order:
 * `injected(PlaceOrderHandler, [OrderRepository, Clock])`. Written by `ddd-ts-kit docs` in the
 * generated file of each context, from the constructor signatures it reads, and checked by the
 * compiler against the constructor like a list of a decorator. Never written by hand.
 */
export function injected<Args extends readonly unknown[], const List extends Dependencies = DependencyTokens<Args>>(
  target: new (...args: Args) => unknown,
  ...[dependencies = []]: DependencyList<Args, List>
): void {
  const registry = injectedRegistry();
  const known = registry.get(target);

  if (known !== undefined && !sameList(known, dependencies)) {
    throw new DeclarationError(
      `${target.name} is given two dependency lists, [${named(known)}] and [${named(dependencies)}]: two generated files disagree. Run \`ddd-ts-kit docs\` and load one file per context.`,
    );
  }

  registry.set(target, Object.freeze([...dependencies]));
}

function sameList(left: Dependencies, right: Dependencies): boolean {
  return left.length === right.length && left.every((token, index) => token === right[index]);
}

function named(list: Dependencies): string {
  return list.map((token) => describeToken(token)).join(', ');
}
