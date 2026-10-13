import { definePermissions } from '@ddd-ts-kit/auth';

/**
 * What a use case of {{context.kebab}} requires. The platform grants them to every signed-in person;
 * inside an organisation, the policies of this context then decide from the rights of the actor's
 * role and of the delegations lent to them.
 */
export const {{context.camel}}Permissions = definePermissions('{{context.kebab}}', {
  // ddd-ts-kit:permissions
  'account.provision': { description: 'Provision or refresh the account of the person who signs in' },
  'account.deactivate': { description: 'Deactivate the account of the person who asks' },
  'organisation.open': { description: 'Open an organisation and become its first owner' },
  'member.invite': { description: 'Invite a person to an organisation, in a role' },
  'invitation.accept': { description: 'Accept an invitation addressed to oneself' },
  'invitation.decline': { description: 'Decline an invitation addressed to oneself' },
  'invitation.revoke': { description: 'Take back an invitation of an organisation' },
  'member.change-role': { description: 'Change the role of a member of an organisation' },
  'member.remove': { description: 'Remove a member from an organisation' },
  'member.search': { description: 'Search the members of an organisation' },
  'delegation.grant': { description: 'Lend some of the rights of a role to another member, for a period' },
  'delegation.revoke': { description: 'Revoke a delegation of an organisation' },
  // /ddd-ts-kit:permissions
});
