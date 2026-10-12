import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

@RouteGroup({ prefix: '/notifications', tags: ['notification'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class NotificationsRoutes {}
