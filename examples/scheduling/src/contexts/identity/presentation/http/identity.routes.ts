import type { Route } from '@ddd-ts-kit/http';
import type { CommandBus, QueryBus } from '@ddd-ts-kit/kernel';
// ddd-ts-kit:imports
import { registerPersonRoute } from '@/contexts/identity/presentation/http/register-person.route';
import { openPracticeRoute } from '@/contexts/identity/presentation/http/open-practice.route';
import { addMemberRoute } from '@/contexts/identity/presentation/http/add-member.route';
import { removeMemberRoute } from '@/contexts/identity/presentation/http/remove-member.route';
import { grantDelegationRoute } from '@/contexts/identity/presentation/http/grant-delegation.route';
import { revokeDelegationRoute } from '@/contexts/identity/presentation/http/revoke-delegation.route';
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
