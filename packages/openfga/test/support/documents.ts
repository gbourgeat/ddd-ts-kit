import { definePermissions } from '@ddd-ts-kit/auth';
import { defineSchema, exclusion, from, intersection, union } from '@ddd-ts-kit/auth/rebac';

export const docsPermissions = definePermissions('docs', {
  'document.edit': { description: 'Change a document' },
  'document.view': { description: 'Read a document' },
  'document.sign': { description: 'Sign a document' },
});

/** Every shape of rewrite, and the relations the tuple store contract writes (a document filed under a group). */
export const schema = defineSchema({
  user: {},
  group: { relations: { member: ['user', 'group#member'] } },
  folder: {
    relations: { owner: ['user'], parent: ['folder'] },
    permissions: { edit: union('owner', from('parent', 'edit')) },
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
    permissions: {
      edit: exclusion(union('owner', 'editor', from('folder', 'edit')), 'banned'),
      view: union('edit', 'viewer'),
      sign: intersection('approver', 'edit'),
    },
  },
});

export const mapping = {
  document: {
    [docsPermissions['document.edit'].id]: 'edit',
    [docsPermissions['document.view'].id]: 'view',
    [docsPermissions['document.sign'].id]: 'sign',
  },
};
