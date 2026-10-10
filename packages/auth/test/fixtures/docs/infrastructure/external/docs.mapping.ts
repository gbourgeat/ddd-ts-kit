import type { PermissionMapping } from '../../../../../src/rebac.js';
import { docsPermissions } from '../../application/authorization/docs.permissions.js';

export const mapping: PermissionMapping = {
  workspace: { [docsPermissions['document.create'].id]: 'create_document' },
  document: {
    [docsPermissions['document.view'].id]: 'view',
    [docsPermissions['document.share'].id]: 'share',
  },
};
