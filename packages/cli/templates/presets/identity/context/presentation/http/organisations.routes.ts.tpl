import { Authenticated, RouteGroup } from '@ddd-ts-kit/http';
import { KitCodes } from '@ddd-ts-kit/kernel';

/** The organisations, their members, their invitations and their delegations: inside one, the policies of the context decide. */
@RouteGroup({ prefix: '/organisations', tags: ['{{context.kebab}}'], guards: [Authenticated], errors: [KitCodes.Forbidden] })
export class OrganisationsRoutes {}
