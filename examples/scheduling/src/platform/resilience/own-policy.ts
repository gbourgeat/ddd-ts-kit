import { compose, type Aspect } from '@ddd-ts-kit/aspects';
import { adaptersWithOwnPolicy } from '@/platform/resilience/adapters-with-own-policy';

/**
 * The policy one adapter states for itself, in place of the default one:
 * `.with(ownPolicy(retry({ attempts: 5 }), timeout(500)))`. Without argument it says that the
 * class already carries its policy as decorators of `@ddd-ts-kit/aspects/decorators`; either
 * way the same aspect never runs twice.
 */
export function ownPolicy(...policy: readonly Aspect[]): Aspect {
  const stated = compose(...policy);

  return (instance, info) => {
    const governed = stated(instance, info);

    adaptersWithOwnPolicy.add(governed);

    return governed;
  };
}
