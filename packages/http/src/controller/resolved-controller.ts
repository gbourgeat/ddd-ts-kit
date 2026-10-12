import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { ControllerClass } from './controller-class.js';
import type { ErasedController } from './erased-controller.js';
import type { ControllerRoutesOptions } from './controller-routes-options.js';
import type { ControllerSpec } from './controller-spec.js';
import { declaredRoute, type DeclaredRoute } from './declared-route.js';
import type { GuardReference } from './guard-reference.js';
import type { Guard } from './guard.js';
import { presentationRegistry } from './presentation-registry.js';

/** A controller ready to answer: its instance, its declaration and the guards before it, built. */
export interface ResolvedController {
  readonly controller: ErasedController;
  readonly spec: ControllerSpec;
  readonly declared: DeclaredRoute;
  readonly guards: readonly Guard[];
}

type Resolve = NonNullable<ControllerRoutesOptions['resolve']>;

/** Reads the declaration of a controller given as its class or as an instance, and builds what must be built. */
export function resolvedController(
  entry: ControllerClass | ErasedController,
  resolve: Resolve | undefined,
): ResolvedController {
  const target = isClass(entry) ? entry : classOf(entry);
  const spec = presentationRegistry().controllers.get(target);

  if (spec === undefined) {
    throw new DeclarationError(`${target.name} is mounted as a controller and carries no @Controller.`);
  }

  const declared = declaredRoute(target.name, spec);

  return {
    controller: isClass(entry) ? controllerOf(built(entry, resolve), target.name) : entry,
    spec,
    declared,
    guards: declared.guards.map((guard) => guardOf(guard, resolve)),
  };
}

function classOf(instance: ErasedController): ControllerClass {
  const constructor: unknown = instance.constructor;

  if (!isClass(constructor)) {
    throw new DeclarationError('A controller is mounted that is the instance of no class.');
  }

  return constructor;
}

function isClass(value: unknown): value is ControllerClass {
  return typeof value === 'function';
}

function controllerOf(instance: unknown, className: string): ErasedController {
  if (typeof instance === 'object' && instance !== null && 'handle' in instance && isHandler(instance)) {
    return instance;
  }

  throw new DeclarationError(`What was built for ${className} has no handle method: it is no controller.`);
}

function isHandler(instance: { handle: unknown }): instance is ErasedController {
  return typeof instance.handle === 'function';
}

function guardOf(reference: GuardReference, resolve: Resolve | undefined): Guard {
  return typeof reference === 'function' ? built(reference, resolve) : reference;
}

function built<T>(target: abstract new (...args: never) => T, resolve: Resolve | undefined): T {
  if (resolve === undefined) {
    throw new DeclarationError(
      `${target.name} is given as a class and nothing builds it: pass \`resolve\` of the application to controllerRoutes, or give an instance.`,
    );
  }

  return resolve(target);
}
