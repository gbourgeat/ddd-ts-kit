import { definePermissions } from '../../../../../src';

export const docsPermissions = definePermissions('docs', {
  'document.create': { description: 'Create a document in a workspace' },
  'document.view': { description: 'Read a document' },
  'document.share': { description: 'Share a document with a group' },
});
