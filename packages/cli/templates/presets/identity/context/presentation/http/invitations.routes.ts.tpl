import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';
import { KitCodes } from '@ddd-ts-kit/kernel';

/** The answers of a person to an invitation sent to them, by its token. */
@RouteGroup({ prefix: '/invitations', tags: ['{{context.kebab}}'], guards: [Authenticated], errors: [KitCodes.Forbidden] })
export class InvitationsRoutes {}
