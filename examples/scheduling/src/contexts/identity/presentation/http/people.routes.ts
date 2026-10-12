import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/people', tags: ['identity'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class PeopleRoutes {}
