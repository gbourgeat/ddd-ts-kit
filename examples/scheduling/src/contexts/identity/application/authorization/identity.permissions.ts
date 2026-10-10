import { definePermissions } from '@ddd-ts-kit/auth';

export const identityPermissions = definePermissions('identity', {
  // ddd-ts-kit:permissions
  'delegation.expire': { description: 'Expire delegations' },
  'person.register': { description: 'Register person' },
  'practice.open': { description: 'Open practice' },
  'member.add': { description: 'Add member' },
  'member.remove': { description: 'Remove member' },
  'delegation.grant': { description: 'Grant delegation' },
  'delegation.revoke': { description: 'Revoke delegation' },
  // /ddd-ts-kit:permissions
});
