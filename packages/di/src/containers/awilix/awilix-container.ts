<<<<<<< HEAD
import { tokenIdentity, type Token } from '@ddd-ts-kit/kernel/declarations';
import { asFunction, asValue, createContainer, InjectionMode, type AwilixContainer, type Resolver } from 'awilix';
=======
import { tokenIdentity } from '@ddd-ts-kit/kernel/declarations';
import { asFunction, asValue, createContainer, InjectionMode, type AwilixContainer } from 'awilix';
>>>>>>> origin/main
import type { Container } from '../../application/container';

/** A new Awilix container. Each binding is a function of its own, so no parameter name is ever read. */
export function awilixContainer(): Container<AwilixContainer> {
  const native = createContainer({ injectionMode: InjectionMode.PROXY });

<<<<<<< HEAD
  /** `register` keeps a singleton already built under the name: it goes with its binding. */
  const bind = (target: Token<unknown>, resolver: Resolver<unknown>): void => {
    const identity = tokenIdentity(target);

    native.cache.delete(identity);
    native.register(identity, resolver);
  };

=======
>>>>>>> origin/main
  return {
    native,
    isBound: (target) => native.hasRegistration(tokenIdentity(target)),
    bindValue(target, value) {
<<<<<<< HEAD
      bind(target, asValue(value));
=======
      native.register(tokenIdentity(target), asValue(value));
>>>>>>> origin/main
    },
    bindFactory(target, create, lifetime) {
      const made = asFunction(create);

<<<<<<< HEAD
      bind(target, lifetime === 'singleton' ? made.singleton() : made.transient());
=======
      native.register(tokenIdentity(target), lifetime === 'singleton' ? made.singleton() : made.transient());
>>>>>>> origin/main
    },
    resolve: (target) => native.resolve(tokenIdentity(target)),
  };
}
