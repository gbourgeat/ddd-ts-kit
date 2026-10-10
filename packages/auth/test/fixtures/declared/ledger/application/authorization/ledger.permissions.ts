import { definePermissions } from '../../../../../../src/index.js';

export const ledgerPermissions = definePermissions('ledger', {
  'entry.post': { description: 'Post an entry to the ledger' },
  'entry.reverse': { description: 'Reverse a posted entry' },
});
