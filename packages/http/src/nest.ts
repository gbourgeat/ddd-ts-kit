import type { DynamicModule, InjectionToken, ModuleMetadata, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IRouter } from 'express';
import type { FastifyInstance } from 'fastify';
import { mountExpress } from './express.js';
import { mountFastify } from './fastify.js';
import { assertUniqueRoutes, type ExecuteOptions, type Route } from './index.js';

/** Routes whose handlers close over injected dependencies. */
export interface RoutesFactory {
  readonly inject: readonly InjectionToken[];
  // A method, so that a factory naming the types it expects (`(orders: OrderService) => ...`)
  // is accepted: the tokens are only resolved at runtime.
  useFactory(...dependencies: unknown[]): readonly Route[];
}

export interface RoutesModuleOptions extends ExecuteOptions {
  /** Modules exporting the tokens listed in `inject`. */
  readonly imports?: ModuleMetadata['imports'];
}

export const ROUTES_MOUNTER = Symbol('ddd-ts-kit.http.routes-mounter');

/**
 * A Nest module that mounts framework-free routes on the underlying HTTP server, Express or
 * Fastify. The routes bypass Nest's own pipeline (pipes, guards, interceptors, filters, global
 * prefix): validation and error mapping are those of `executeRoute`, as with the other adapters.
 */
export function createRoutesModule(
  routes: readonly Route[] | RoutesFactory,
  options: RoutesModuleOptions = {},
): DynamicModule {
  // One class per call: Nest identifies a module by its class, and two route sets must not merge.
  class RoutesModule {}

  const { imports, ...executeOptions } = options;
  const factory: RoutesFactory = isFactory(routes) ? routes : { inject: [], useFactory: () => routes };

  return {
    module: RoutesModule,
    imports: imports ?? [],
    providers: [
      {
        provide: ROUTES_MOUNTER,
        inject: [HttpAdapterHost, ...factory.inject],
        useFactory: (host: HttpAdapterHost, ...dependencies: unknown[]): OnModuleInit => ({
          // Module init runs after Nest installed its body parsers and before it installs its
          // not-found handler, which is the window where a route can still be added.
          onModuleInit() {
            const resolved = factory.useFactory(...dependencies);
            assertUniqueRoutes(resolved);
            const adapter = host.httpAdapter;
            const type: string = adapter.getType();
            if (type === 'express') {
              const instance: IRouter = adapter.getInstance();
              mountExpress(instance, resolved, executeOptions);
            } else if (type === 'fastify') {
              const instance: FastifyInstance = adapter.getInstance();
              mountFastify(instance, resolved, executeOptions);
            } else {
              throw new Error(`Unsupported Nest HTTP platform "${type}".`);
            }
          },
        }),
      },
    ],
  };
}

function isFactory(routes: readonly Route[] | RoutesFactory): routes is RoutesFactory {
  return !Array.isArray(routes);
}
