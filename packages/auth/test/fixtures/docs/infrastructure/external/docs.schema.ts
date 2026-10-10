import { defineSchema, union } from '../../../../../src/rebac.js';

export const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user'] } },
  workspace: { relations: { member: ['user'] }, permissions: { create_document: 'member' } },
  document: {
    relations: { owner: ['user'], viewer: ['group#member'] },
    permissions: { share: 'owner', view: union('owner', 'viewer') },
  },
});
