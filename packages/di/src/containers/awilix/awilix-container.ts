import { tokenIdentity } from '@ddd-ts-kit/kernel/declarations';
import { asFunction, asValue, createContainer, InjectionMode, type AwilixContainer } from 'awilix';
import type { Container } from '../../application/container';

/** A new Awilix container. Each binding is a function of its own, so no parameter name is ever read. */
export function awilixContainer(): Container<AwilixContainer> {
  const native = createContainer({ injectionMode: InjectionMode.PROXY });

  return {
    native,
    isBound: (target) => native.hasRegistration(tokenIdentity(target)),
    bindValue(target, value) {
      native.register(tokenIdentity(target), asValue(value));
    },
    bindFactory(target, create, lifetime) {
      const made = asFunction(create);

      native.register(tokenIdentity(target), lifetime === 'singleton' ? made.singleton() : made.transient());
    },
    resolve: (target) => native.resolve(tokenIdentity(target)),
  };
}
