import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/calendars', tags: ['scheduling'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class CalendarsRoutes {}
