import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';

/** The account of the person who calls: every route is about the caller, named by their token. */
@RouteGroup({ prefix: '/accounts', tags: ['{{context.kebab}}'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class AccountsRoutes {}
