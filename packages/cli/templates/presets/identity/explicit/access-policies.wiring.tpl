@@imports
import { ChangeMemberRolesPolicy } from '{{alias.context}}/application/authorization/change-member-roles.policy{{alias.ext}}';
import { GrantDelegationsPolicy } from '{{alias.context}}/application/authorization/grant-delegations.policy{{alias.ext}}';
import { InviteMembersPolicy } from '{{alias.context}}/application/authorization/invite-members.policy{{alias.ext}}';
import { ReadMembersPolicy } from '{{alias.context}}/application/authorization/read-members.policy{{alias.ext}}';
import { RemoveMembersPolicy } from '{{alias.context}}/application/authorization/remove-members.policy{{alias.ext}}';
import { RevokeDelegationsPolicy } from '{{alias.context}}/application/authorization/revoke-delegations.policy{{alias.ext}}';
import { RevokeInvitationsPolicy } from '{{alias.context}}/application/authorization/revoke-invitations.policy{{alias.ext}}';
@@policies
new ChangeMemberRolesPolicy(),
new GrantDelegationsPolicy(),
new InviteMembersPolicy(),
new ReadMembersPolicy(),
new RemoveMembersPolicy(),
new RevokeDelegationsPolicy(),
new RevokeInvitationsPolicy(),
