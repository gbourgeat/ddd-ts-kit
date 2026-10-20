import { injected } from '@ddd-ts-kit/kernel/declarations';
import { RegisterPersonController } from '@/contexts/identity/presentation/http/people/register-person/register-person.controller';
import { AddMemberController } from '@/contexts/identity/presentation/http/practices/add-member/add-member.controller';
import { GrantDelegationController } from '@/contexts/identity/presentation/http/practices/grant-delegation/grant-delegation.controller';
import { OpenPracticeController } from '@/contexts/identity/presentation/http/practices/open-practice/open-practice.controller';
import { RemoveMemberController } from '@/contexts/identity/presentation/http/practices/remove-member/remove-member.controller';
import { RevokeDelegationController } from '@/contexts/identity/presentation/http/practices/revoke-delegation/revoke-delegation.controller';
import { CommandBus } from '@ddd-ts-kit/kernel';

export * from '@/contexts/identity/presentation/http/people/register-person/register-person.controller';
export * from '@/contexts/identity/presentation/http/practices/add-member/add-member.controller';
export * from '@/contexts/identity/presentation/http/practices/grant-delegation/grant-delegation.controller';
export * from '@/contexts/identity/presentation/http/practices/open-practice/open-practice.controller';
export * from '@/contexts/identity/presentation/http/practices/remove-member/remove-member.controller';
export * from '@/contexts/identity/presentation/http/practices/revoke-delegation/revoke-delegation.controller';

injected(RegisterPersonController, [CommandBus]);
injected(AddMemberController, [CommandBus]);
injected(GrantDelegationController, [CommandBus]);
injected(OpenPracticeController, [CommandBus]);
injected(RemoveMemberController, [CommandBus]);
injected(RevokeDelegationController, [CommandBus]);
