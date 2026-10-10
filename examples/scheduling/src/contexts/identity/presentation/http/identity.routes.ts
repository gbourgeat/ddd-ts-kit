import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { registerPersonRoute } from './register-person.route.js';
import { openPracticeRoute } from './open-practice.route.js';
import { addMemberRoute } from './add-member.route.js';
import { removeMemberRoute } from './remove-member.route.js';
import { grantDelegationRoute } from './grant-delegation.route.js';
import { revokeDelegationRoute } from './revoke-delegation.route.js';
// /ddd-ts-kit:imports

export function identityRoutes(commands: CommandBus, queries: QueryBus): readonly Route[] {
  return [
    // ddd-ts-kit:routes
    registerPersonRoute(commands),
    openPracticeRoute(commands),
    addMemberRoute(commands),
    removeMemberRoute(commands),
    grantDelegationRoute(commands),
    revokeDelegationRoute(commands),
    // /ddd-ts-kit:routes
  ];
}
