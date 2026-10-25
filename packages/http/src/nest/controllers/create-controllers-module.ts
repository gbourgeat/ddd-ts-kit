import type { DynamicModule, Type } from '@nestjs/common';
import { ModuleRef, ModulesContainer } from '@nestjs/core';
import { createRoutesModule } from '../create-routes-module';
import { assertNotRoutedByNest } from './assert-not-routed-by-nest';
import type { ControllersModuleOptions } from './controllers-module-options';
import { nestControllerRoutes } from './nest-controller-routes';

/**
 * A Nest module whose controllers the kit serves: Nest's container builds them, with what they
 * inject, and the kit mounts each method carrying `@KitRoute` as a route of its own pipeline on the
 * HTTP server underneath Nest, Express or Fastify. A controller listed here is never listed in the
 * `controllers` of a Nest module too: the start is refused.
 */
export function createControllersModule(
  controllers: readonly Type<unknown>[],
  options: ControllersModuleOptions = {},
): DynamicModule {
  const { providers = [], schemaOfClass, security, ...routesOptions } = options;

  const module = createRoutesModule(
    {
      inject: [ModuleRef, ModulesContainer],
      useFactory: (references: ModuleRef, modules: ModulesContainer) => {
        assertNotRoutedByNest(modules);

        const built = <T>(target: abstract new (...args: never) => T): T => references.get(target, { strict: false });

        return nestControllerRoutes(controllers, {
          instanceOf: built,
          resolve: built,
          ...(schemaOfClass === undefined ? {} : { schemaOfClass }),
          ...(security === undefined ? {} : { security }),
        });
      },
    },
    routesOptions,
  );

  return { ...module, providers: [...(module.providers ?? []), ...controllers, ...providers] };
}
