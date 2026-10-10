import { AuthorizedCommand, type Actor } from '@ddd-ts-kit/kernel';
import { Requires } from '@ddd-ts-kit/kernel/declarations';
import { identityPermissions } from '@/contexts/identity/application/authorization/identity.permissions.js';

@Requires(identityPermissions['practice.open'], { resource: () => ({ type: 'context', id: 'identity' }) })
export class OpenPracticeCommand extends AuthorizedCommand<string> {
  constructor(
    actor: Actor,
    readonly opening: { readonly name: string; readonly timeZone: string; readonly managerId: string },
  ) {
    super(actor);
  }
}
