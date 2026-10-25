import { Module, type DynamicModule } from '@nestjs/common';
import type { Route } from '@ddd-ts-kit/http';
{{#if routes.nest}}
import { createRoutesModule, type NestControllers, provideControllers } from '@ddd-ts-kit/http/nest';
{{/if}}
{{#unless routes.nest}}
import { createRoutesModule } from '@ddd-ts-kit/http/nest';
{{/unless}}
import type { HttpBoundary } from '{{alias.platform}}/auth/authentication/http-boundary{{alias.ext}}';

@Module({})
class AppModule {}

{{#if routes.nest}}
/**
 * The Nest application: the routes mounted on its HTTP server by the `RoutesMounter` of their
 * module, and the Nest controllers of the contexts built by its container with what they inject.
 */
export function createAppModule(
  routes: readonly Route[],
  boundary: HttpBoundary,
  controllers: NestControllers,
): DynamicModule {
  return { module: AppModule, imports: [createRoutesModule(routes, boundary), provideControllers(controllers)] };
}
{{/if}}
{{#unless routes.nest}}
/** The Nest application: the framework-free routes mounted on its HTTP server by the `RoutesMounter` of their module. */
export function createAppModule(routes: readonly Route[], boundary: HttpBoundary): DynamicModule {
  return { module: AppModule, imports: [createRoutesModule(routes, boundary)] };
}
{{/unless}}
