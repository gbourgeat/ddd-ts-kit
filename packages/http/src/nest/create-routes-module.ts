import type { DynamicModule, ModuleMetadata } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { IRouter } from 'express';
import type { FastifyInstance } from 'fastify';
import { mountExpress } from '../express/mount-express';
import { mountFastify } from '../fastify/mount-fastify';
import type { ExecuteOptions } from '../pipeline/execute-options';
import { assertUniqueRoutes } from '../route/assert-unique-routes';
import type { Route } from '../route/route';
import type { RoutesFactory } from './routes-factory';
import { RoutesMounter } from './routes-mounter';

export interface RoutesModuleOptions extends ExecuteOptions {
  /** Modules exporting the tokens listed in `inject`. */
  readonly imports?: ModuleMetadata['imports'];
}

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
        provide: RoutesMounter,
        inject: [HttpAdapterHost, ...factory.inject],
        useFactory: (host: HttpAdapterHost, ...dependencies: unknown[]): RoutesMounter => ({
          // Module init runs after Nest installed its body parsers and before it installs its
          // not-found handler, which is the window where a route can still be added.
          onModuleInit() {
            mountOn(host, factory.useFactory(...dependencies), executeOptions);
          },
        }),
      },
    ],
  };
}

function isFactory(routes: readonly Route[] | RoutesFactory): routes is RoutesFactory {
  return !Array.isArray(routes);
}

function mountOn(host: HttpAdapterHost, routes: readonly Route[], options: ExecuteOptions): void {
  assertUniqueRoutes(routes);

  const adapter = host.httpAdapter;
  const type: string = adapter.getType();

  if (type === 'express') {
    const instance: IRouter = adapter.getInstance();

    mountExpress(instance, routes, options);
  } else if (type === 'fastify') {
    const instance: FastifyInstance = adapter.getInstance();

    mountFastify(instance, routes, options);
  } else {
    throw new Error(`Unsupported Nest HTTP platform "${type}".`);
  }
}
