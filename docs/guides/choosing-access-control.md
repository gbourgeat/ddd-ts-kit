# Choosing access control, with worked presets

**Summary.** Five questions decide the authorization model of a project: whether rights depend on
the element, whether users share elements with each other, whether rights follow properties,
whether third parties act with a limited credential, and whether several customers share the
deployment. The answers pick roles (RBAC), attribute policies (ABAC), relationships (ReBAC, after
Zanzibar), or a combination, and where the relationships are evaluated. Each model then has a
worked preset below: the permissions as a typed vocabulary, the grants or rules, one policy on an
element, and a search narrowed by what the actor may read. The reasons behind the models are in
[Authentication and authorization](../concepts/authentication-and-authorization.md); the API is
the README of [`@ddd-ts-kit/auth`](../../packages/auth/README.md).

## The five questions

Ask them in order; the first "yes" that changes the answer wins, and the later ones add to it.

| # | Question | Yes | No |
|---|---|---|---|
| 1 | Does a right depend on **which element**, not only on the action? ("may edit *this* calendar") | go on to 2 | **RBAC**: roles grant actions |
| 2 | Do users **share** elements with each other, **delegate**, or inherit rights along a **hierarchy** (folders, teams, practice to desk to calendar)? Must a list show "everything I can reach" across many elements? | **ReBAC** (Zanzibar) | go on to 3 |
| 3 | Do rights follow **properties** (department, amount, status, time of day), or need **explicit refusals** that win over grants? | **ABAC**, over roles | **RBAC plus policies**: a handful of "only the one who..." rules |
| 4 | Do **third parties** act with a credential limited to some operations (a mobile client, a partner integration)? | add **scopes**: `HasScope` on the routes | nothing to add |
| 5 | Do **several customers** share the deployment? | add a **tenancy strategy** ([Multitenancy](../concepts/multitenancy.md)) and keep roles per tenant | nothing to add |

Then where the relationships live, for ReBAC: the **PostgreSQL tuple store** of the project (in
the transaction of the command, nothing else to run) until listing or checks outgrow it, then
**OpenFGA**, the full Zanzibar model as a service, behind the same port
([Authorization engines](../tools/authorization-engines.md) compares them).

| Typical product | Answer |
|---|---|
| Back office of one company, job functions | RBAC |
| Booking tool where "only the patient who booked may cancel" | RBAC plus one policy |
| Expense approval by amount and department, with a four-eyes rule | ABAC over roles |
| Documents, folders, sharing, teams, delegation | ReBAC |
| SaaS for many companies, each with its admins and members | RBAC with the tenant check, shared tables; ReBAC inside a tenant if users share |
| Public API for partners | any of the above, plus scopes |

## What every preset shares

Permissions are declared once per context, in its words, and are typed: a requirement can only
name a permission that exists.

```ts
// contexts/billing/application/authorization/billing.permissions.ts
import { definePermissions } from '@ddd-ts-kit/auth';

export const billingPermissions = definePermissions('billing', {
  'invoice.read': 'See invoices and their lines',
  'invoice.issue': 'Make an invoice final and send it',
  'invoice.void': 'Cancel an issued invoice',
});

// application/commands/void-invoice/void-invoice.command.ts
@Requires(billingPermissions['invoice.void'], { resource: (command) => ({ type: 'invoice', id: command.invoiceId }) })
export class VoidInvoice extends AuthorizedCommand { /* actor, invoiceId */ }
```

A search never loads then filters: the handler asks the scope of the actor and the read port turns
it into the query (`scoped(criteria, scope, { ids: 'id', filter: { tenantId: 'tenantId' } })`).

```ts
async execute(query: SearchInvoices): Promise<Page<InvoiceLine>> {
  const scope = await this.access.scope(query.actor, billingPermissions['invoice.read'], 'invoice');

  return this.invoices.search(scoped(query.criteria, scope, { ids: 'id', filter: { tenantId: 'tenantId' } }));
}
```

## Preset 1: roles, and policies for the few element rules

The roles are a typed vocabulary: a role that does not exist cannot be granted, and the token is
checked against it at the edge.

```ts
// platform/auth/roles.ts
import type { Grant } from '@ddd-ts-kit/auth';

export const ROLES = ['admin', 'accountant', 'clerk', 'system'] as const;
export type Role = (typeof ROLES)[number];

export const roles: Readonly<Record<Role, readonly Grant[]>> = {
  admin: ['*'],
  accountant: ['billing:*'],
  clerk: [billingPermissions['invoice.read'], billingPermissions['invoice.issue']],
  system: [billingPermissions['invoice.issue']], // the jobs and consumers that send the command
};

new RoleBasedAuthorizer({ roles, inherits: { accountant: ['clerk'] }, tenantOf: tenantOfContext, systemRole: 'system' });
```

One rule needs the loaded element: a policy, pure and unit-tested, asked by the handler.

```ts
// application/authorization/only-issuer-voids.policy.ts
@Policy(billingPermissions['invoice.void'], { name: 'billing.only-issuer-voids' })
export class OnlyIssuerVoidsPolicy {
  appliesTo(subject: unknown): boolean {
    return subject instanceof Invoice;
  }

  allows(actor: Actor, invoice: Invoice): boolean {
    return invoice.issuedBy === actor.id;
  }
}

// in the handler, once the invoice is loaded
await this.access.authorize(command.actor, billingPermissions['invoice.void'], invoice);
```

Lists: a role that grants the permission reads `all`, narrowed to the tenant by the tenant check
(`{ kind: 'filter', filter: { tenantId } }`).

## Preset 2: attribute policies over roles

The rules read attributes of the actor (from its token), of the resource (through a
`ResourceAttributes` port, a projection the policies query) and of the moment. A matching `forbid`
wins over every `permit`.

```ts
// platform/auth/attribute-policies.ts
const sameDepartment: Condition = ({ actor, attributes }) => actor.attributes['department'] === attributes['department'];
const large: Condition = ({ attributes }) => Number(attributes['amount']) > 10_000;
const approvedTwice: Condition = ({ attributes }) => attributes['approvals'] === 2;

export const attributePolicies: readonly AttributePolicy[] = [
  permit('administrators-do-everything', ['*'], ({ actor }) => actor.roles.includes('admin')),
  permit('read-own-department', [billingPermissions['invoice.read']], sameDepartment),
  permit('managers-void', [billingPermissions['invoice.void']], ({ actor }) => actor.attributes['manager'] === true),
  forbid('no-large-void-without-four-eyes', [billingPermissions['invoice.void']], allOf(large, not(approvedTwice))),
];
```

Lists: a predicate is not a query, so `Access.scope` throws `ListingNotSupportedError` under pure
ABAC. Give the read port the same condition as a filter (the department of the actor), or list
through roles and decide each element with the policies.

## Preset 3: relationships (Zanzibar)

The schema says who is what to which element, and derives the permissions by rewriting: the
owner, a member of a group it is shared with, whoever may edit the parent folder.

```ts
// platform/auth/relationship-schema.ts
export const relationshipSchema = defineSchema({
  user: {},
  system: {},
  team: { relations: { member: ['user', 'team#member'] } },
  folder: {
    relations: { owner: ['user'], viewer: ['user', 'team#member'], parent: ['folder'] },
    permissions: { edit: union('owner', from('parent', 'edit')), view: union('edit', 'viewer', from('parent', 'view')) },
  },
  document: {
    relations: { owner: ['user'], editor: ['user', 'team#member'], delegate: ['user'], parent: ['folder'] },
    permissions: {
      edit: union('owner', 'editor', 'delegate', from('parent', 'edit')),
      view: union('edit', from('parent', 'view')),
    },
  },
});

// platform/auth/permission-mapping.ts: which permission of the schema each use case permission stands for
export const mapping = {
  document: { [docsPermissions['document.edit'].id]: 'edit', [docsPermissions['document.view'].id]: 'view' },
  folder: { [docsPermissions['folder.view'].id]: 'view' },
};
```

Tuples are written through a port in the words of the application, in the transaction of the
command when the store is the PostgreSQL one:

```ts
export abstract class DocumentGrants {
  abstract ownerAssigned(documentId: string, ownerId: string): Promise<void>;
  abstract delegatedTo(documentId: string, delegateId: string): Promise<void>;
}
```

Lists come by construction: `listAccessible` answers the ids the actor reaches, which the read
port turns into `id in (...)`. Delegation is one more relation (`delegate`), and so is a hierarchy
(`parent`); nothing in the use cases changes when one is added.

## The combined model of the example

`examples/scheduling` layers two models behind the one port
(`RolesAndRelationshipsAuthorizer`): a short list of role grants decides first (the platform
administrator, the self-service of a patient), then the relationships decide the rest, a practice
with its managers and practitioners, a desk held or delegated, a calendar of a desk, an
appointment of a calendar and of its patient. A right over one element is always a relationship,
never a role; a list is `all` only for an unconditional grant, otherwise the ids the relationships
reach. The practice is not a tenant there: patients book in several practices, so the boundary
between practices is a relationship decided per element, not a storage boundary
([ADR 0003 of the example](../../examples/scheduling/docs/adr/0003-a-practice-is-not-a-tenant.md)).

## Scopes and guards at the edge

A scope limits the client that presents a credential, not the actor: a partner integration with
`invoices:read` cannot issue an invoice whatever its user may do. Declare the vocabulary once,
and guard the routes:

```ts
declare module '@ddd-ts-kit/kernel' {
  interface SessionScopes {
    readonly 'invoices:read': true;
    readonly 'invoices:write': true;
  }
}

@RouteGroup({ prefix: '/invoices', guards: [HasScope('invoices:read')], errors: ['FORBIDDEN'] })
export class InvoicesRoutes {}
```

The JWT and Keycloak authenticators fill `Session.scopes` from the `scope` (or `scp`) claim. Every
refusal of a guard (`HasRole`, `HasScope`, `TenantMember`, a tenant the caller does not belong
to) is reported through `onGuardRefusal` of the HTTP pipeline, which `auditGuardRefusals` of
`@ddd-ts-kit/audit` writes to the audit trail as a denied decision, next to the refusals of the
use cases.

## Limits and when not to use it

- **The presets are starting points.** The roles, rules and schema of a real organisation come
  from its people; the presets show the shape, not the content.
- **A model too rich for the problem costs every day.** Tuples to keep in sync, attribute
  projections to maintain: start with roles and policies, and move one context to relationships
  when sharing appears.
- **Scopes are not permissions.** A scope never grants what the actor may not do; it only takes
  away.

## See also

- [Authentication and authorization](../concepts/authentication-and-authorization.md)
- [Authorization engines](../tools/authorization-engines.md)
- [Multitenancy](../concepts/multitenancy.md)
- [Audit trail](../concepts/audit-trail.md)
- The skill `ddd-ts-kit:access-control`
