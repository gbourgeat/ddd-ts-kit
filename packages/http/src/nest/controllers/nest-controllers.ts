import type { Provider, Type } from '@nestjs/common';
import type { ModuleRef } from '@nestjs/core';
import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import type { Route } from '../../route/route';
import type { NestControllersOptions } from './nest-controllers-options';
import { nestControllerRoutes } from './nest-controller-routes';

/** The Nest controllers of an application, their routes built now and their instances built by Nest at its start. */
export interface NestControllers {
  readonly controllers: readonly Type<unknown>[];
  readonly providers: readonly Provider[];
  /** For the server, the contract and the procedures, as every route of the application. */
  readonly routes: readonly Route[];
  /** Hands the routes the instances Nest's container built: `provideControllers` calls it at the start. */
  bind(references: ModuleRef): void;
}

/**
 * The routes of Nest controllers, built before Nest starts, for an application that composes its
 * routes itself: they join its other routes, and `provideControllers` lets Nest build each
 * controller with what it injects. A guard a route names is a value here (`Authenticated`,
 * `HasRole(...)`): one given as a class is built by `createControllersModule`.
 */
export function nestControllers(
  controllers: readonly Type<unknown>[],
  options: NestControllersOptions = {},
): NestControllers {
  const { providers = [], schemaOfClass, security } = options;
  let references: ModuleRef | undefined;

  const routes = nestControllerRoutes(controllers, {
    instanceOf: (controller) => {
      if (references === undefined) {
        throw new DeclarationError(
          `${controller.name} is called before Nest started: give the controllers to provideControllers in the Nest application.`,
        );
      }

      return references.get(controller, { strict: false });
    },
    ...(schemaOfClass === undefined ? {} : { schemaOfClass }),
    ...(security === undefined ? {} : { security }),
  });

  return {
    controllers,
    providers,
    routes,
    bind: (built) => {
      references = built;
    },
  };
}
