import { beforeEach, describe, expect, it } from 'vitest';
import { RoleBasedAuthorizer, tenantOfContext } from '../src';
import { authorizerContract } from '../src/testing';
import { ada, billingPermissions } from './support/billing';

const issue = billingPermissions['invoice.issue'];
const read = billingPermissions['invoice.read'];

const roles = {
  admin: ['*'],
  accountant: [issue, 'billing:invoice.read'],
  'billing-lead': ['billing:*'],
  clerk: [read],
};

authorizerContract(
  { describe, it, expect, beforeEach },
  {
    name: 'RoleBasedAuthorizer with the tenant check',
    create: () => ({
      authorizer: new RoleBasedAuthorizer({ roles, tenantOf: tenantOfContext }),
      granted: {
        actor: ada,
        permission: issue,
        resource: { type: 'invoice', id: 'inv-1' },
        context: { tenantId: 'acme' },
      },
      refused: {
        actor: ada,
        permission: issue,
        resource: { type: 'invoice', id: 'inv-1' },
        context: { tenantId: 'globex' },
      },
    }),
  },
);
