import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/practices', tags: ['scheduling'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class PracticesRoutes {}
