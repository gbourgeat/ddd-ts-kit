import { authzFieldsBySchema } from '../../src/rules/authz-fields-by-schema';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const QUERY_HANDLER = `${BILLING}/application/queries/invoices-issued/invoices-issued.handler.ts`;
const COMMAND_HANDLER = `${BILLING}/application/commands/void-invoice/void-invoice.handler.ts`;
const SPEC = `${BILLING}/test/unit/invoices-issued.handler.spec.ts`;

ruleTester.run('authz-fields-by-schema', authzFieldsBySchema, {
  valid: [
    at(
      QUERY_HANDLER,
      'class H { async execute(query: Q) { return this.invoices.search(await this.access.scope(query.actor, p, "invoice")); } }',
    ),
    at(QUERY_HANDLER, 'const seen = ids.includes(id);\nconst kind = line.kind === "credit";'),
    at(COMMAND_HANDLER, "const admin = command.actor.roles.includes('admin');"),
    at(SPEC, "expect(actor.roles.includes('accountant')).toBe(true);"),
  ],
  invalid: [
    {
      ...at(QUERY_HANDLER, "const lines = query.actor.roles.includes('accountant') ? all : trimmed;"),
      errors: [{ messageId: 'roles', data: { access: 'query.actor.roles' } }],
    },
    {
      ...at(QUERY_HANDLER, "const shown = actor.roles.some((role) => role === 'admin');"),
      errors: [{ messageId: 'roles' }, { messageId: 'roleTest', data: { access: 'role' } }],
    },
    {
      ...at(
        QUERY_HANDLER,
        "const { roles } = query.actor;\nconst lines = roles.includes('accountant') ? all : trimmed;",
      ),
      errors: [{ messageId: 'roles', data: { access: 'roles' } }],
    },
    {
      ...at(
        QUERY_HANDLER,
        "const role = query.actor.attributes['role'];\nconst lines = role === 'accountant' ? all : trimmed;",
      ),
      errors: [{ messageId: 'roleTest', data: { access: 'role' } }],
    },
    {
      ...at(QUERY_HANDLER, "if (membership.role === 'practitioner') { keep(); }"),
      errors: [{ messageId: 'roleTest', data: { access: 'membership.role' } }],
    },
    {
      ...at(QUERY_HANDLER, "const shown = 'owner' !== member.role;"),
      errors: [{ messageId: 'roleTest' }],
    },
    {
      ...at(QUERY_HANDLER, 'const full = query.actor.attributes.isAdmin;'),
      errors: [{ messageId: 'roles' }],
    },
  ],
});
