import { Module, type DynamicModule } from '@nestjs/common';
import type { Route } from '@ddd-ts-kit/http';
import { createRoutesModule } from '@ddd-ts-kit/http/nest';
import type { HttpBoundary } from '{{alias.platform}}/auth/http-boundary{{alias.ext}}';

@Module({})
class AppModule {}

/** The Nest application: the framework-free routes mounted on its HTTP server by the `RoutesMounter` of their module. */
export function createAppModule(routes: readonly Route[], boundary: HttpBoundary): DynamicModule {
  return { module: AppModule, imports: [createRoutesModule(routes, boundary)] };
}
