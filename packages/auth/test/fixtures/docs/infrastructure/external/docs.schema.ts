import { defineSchema } from '../../../../../src/rebac';
import { docsPermissions } from '../../application/authorization/docs.permissions';

/** Who is what to a workspace and a document, and which permission each relation grants there. */
export const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user'] } },
  workspace: {
    relations: { member: ['user'] },
    derived: { [docsPermissions['document.create'].id]: 'member' },
  },
  document: {
    relations: { owner: ['user'], viewer: ['group#member'] },
    derived: {
      [docsPermissions['document.share'].id]: 'owner',
      [docsPermissions['document.view'].id]: { anyOf: ['owner', 'viewer'] },
    },
  },
});
