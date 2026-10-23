import { definePermissions } from '@ddd-ts-kit/auth';
import { defineSchema, via } from '@ddd-ts-kit/auth/rebac';

export const docsPermissions = definePermissions('docs', {
  'document.edit': { description: 'Change a document' },
  'document.view': { description: 'Read a document' },
  'document.sign': { description: 'Sign a document' },
});

const edit = docsPermissions['document.edit'].id;

/** Every shape of derived relation, and the relations the tuple store contract writes (a document filed under a group). */
export const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user', 'group#member'] } },
  folder: {
    relations: { owner: ['user'], parent: ['folder'] },
    derived: { edit: { anyOf: ['owner', via('parent', 'edit')] } },
  },
  document: {
    relations: {
      owner: ['user'],
      editor: ['user', 'group#member'],
      viewer: ['user', 'group#member'],
      banned: ['user'],
      approver: ['user'],
      parent: ['group', 'folder'],
      folder: ['folder'],
    },
    derived: {
      [edit]: { anyOf: ['owner', 'editor', via('folder', 'edit')], butNot: ['banned'] },
      [docsPermissions['document.view'].id]: { anyOf: [edit, 'viewer'] },
      [docsPermissions['document.sign'].id]: { allOf: ['approver', edit] },
    },
  },
});
