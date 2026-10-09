/** Shaped like the permissions `definePermissions` of the authorization package makes. */
export const permissions = {
  'invoice.issue': { id: 'billing:invoice.issue', context: 'billing', name: 'invoice.issue', description: 'Issue an invoice' },
  'invoice.void': { id: 'billing:invoice.void', context: 'billing', name: 'invoice.void', description: 'Void an invoice' },
} as const;
