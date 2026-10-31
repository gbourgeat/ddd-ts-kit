import { tokenIdentity, type Token } from '@ddd-ts-kit/kernel/declarations';
import { Container as InversifyContainer } from 'inversify';
import type { Container } from '../../application/container';

/**
 * A new InversifyJS container. A second binding of a token would be ambiguous, so it replaces
 * the first. `get` is synchronous and refuses what is thenable: a promise bound to a port is
 * reported at its first resolution, where tsyringe and Awilix hand it over.
 */
export function inversifyContainer(): Container<InversifyContainer> {
  const native = new InversifyContainer();

  const binding = (target: Token<unknown>) => {
    const identity = tokenIdentity(target);

    return native.isBound(identity) ? native.rebind(identity) : native.bind(identity);
  };

  return {
    native,
    isBound: (target) => native.isBound(tokenIdentity(target)),
    bindValue(target, value) {
      binding(target).toConstantValue(value);
    },
    bindFactory(target, create, lifetime) {
      const bound = binding(target).toDynamicValue(create);

      if (lifetime === 'singleton') {
        bound.inSingletonScope();
      } else {
        bound.inTransientScope();
      }
    },
    resolve: (target) => native.get(tokenIdentity(target)),
  };
}
