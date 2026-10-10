import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { registerPersonRoute } from '#src/contexts/identity/presentation/http/register-person.route.js';
import { openPracticeRoute } from '#src/contexts/identity/presentation/http/open-practice.route.js';
import { addMemberRoute } from '#src/contexts/identity/presentation/http/add-member.route.js';
import { removeMemberRoute } from '#src/contexts/identity/presentation/http/remove-member.route.js';
import { grantDelegationRoute } from '#src/contexts/identity/presentation/http/grant-delegation.route.js';
import { revokeDelegationRoute } from '#src/contexts/identity/presentation/http/revoke-delegation.route.js';
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
