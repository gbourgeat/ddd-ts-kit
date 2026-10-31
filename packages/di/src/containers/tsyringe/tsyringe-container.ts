import { tokenIdentity } from '@ddd-ts-kit/kernel/declarations';
import { container as rootContainer, instanceCachingFactory, type DependencyContainer } from 'tsyringe';
import type { Container } from '../../application/container';

/** A child container of tsyringe. Registrations pile up there: the most recent one is resolved. */
export function tsyringeContainer(): Container<DependencyContainer> {
  const native = rootContainer.createChildContainer();

  return {
    native,
    isBound: (target) => native.isRegistered(tokenIdentity(target)),
    bindValue(target, value) {
      // A factory, since tsyringe refuses a `useValue` of null or undefined.
      native.register(tokenIdentity(target), { useFactory: () => value });
    },
    bindFactory(target, create, lifetime) {
      // tsyringe refuses Lifecycle.Singleton on factory providers; its caching factory
      // is the supported way to get one instance per container.
      native.register(tokenIdentity(target), {
        useFactory: lifetime === 'singleton' ? instanceCachingFactory(create) : create,
      });
    },
    resolve: (target) => native.resolve(tokenIdentity(target)),
  };
}
