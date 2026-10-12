import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/practices', tags: ['identity'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class PracticesRoutes {}
