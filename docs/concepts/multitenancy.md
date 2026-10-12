# Multitenancy

**Summary.** A multi-tenant application serves several customers (tenants) from one deployment,
and no tenant may ever read or change what belongs to another. The kit treats the tenant like
the correlation id: it is resolved once at the boundary, carried by the execution context of
every unit of work (a request, a consumed event, a job run), and read by infrastructure only.
Isolation is then enforced where data lives, by one of several strategies chosen per project,
and proven by a contract that runs against each adapter. Use cases never filter by tenant by
hand: forgetting a condition is a leak, so the condition is not theirs to write.

## What a tenant is, and what it is not

A tenant is the customer whose data it is: a clinic, a company, a school. It is not a role
(what someone may do), nor an attribute of an element that a permission compares (the
department of a document). The test: if two tenants were two separate installations, would this
datum be in one of them only? Then it is tenant data.

Some data belongs to no tenant: the catalogue of the platform, the tenants themselves, the
plans. It lives in tables without a tenant column, and the work that reads it names no tenant.

## The tenant in the execution scope

| Origin | Where the tenant comes from |
|---|---|
| HTTP request | the resolver of the edge (subdomain, header, path segment or token claim), checked against the memberships of the actor; the actor's own tenant by default |
| Consumed integration event | the `tenantId` of the envelope, stamped by the publisher from the work that published it |
| Scheduled job | none for a `global` job; each tenant of the `TenantDirectory` in turn for a `per-tenant` one |
| Platform staff | none of their own: they reach tenants through an explicit, audited elevation |

`tenantScopeOf(scope)` answers the one tenant a write names and refuses work that names none
(`NoCurrentTenantError`): a statement cannot run unscoped by omission. `tenantReachOf(scope)` is
the read side: the tenant of the work, or the tenants of an elevation.

## Isolation: four strategies

The tenant reaches the storage through the execution scope; the strategy decides what stops a
statement from crossing to another tenant.

| Strategy | What isolates | Choose it when | It costs |
|---|---|---|---|
| Shared tables | a `tenant_id` column, and a condition the kit adds to every statement | many small tenants, one schema to migrate, reports across tenants | one forgotten condition is a leak: the helpers and a rule of the checker are what prevent it |
| Shared tables under row-level security | the same, and a PostgreSQL policy that refuses another tenant's row even to a statement without its condition | the shared-table case, with a second line of defence | a non-superuser role, every statement inside a transaction |
| Schema per tenant | one copy of the tables of a context per tenant (`<schema>__<tenant>`) | tenants that want their data apart, export or delete a tenant at once, a few hundred tenants | migrations run once per tenant; thousands of schemas strain the catalogue |
| Database per tenant | one database per tenant, one bounded pool each | strict separation (contracts, regions), large tenants, per-tenant backup and restore | connections (`maxTenants * pool.max` per instance), one migration run per tenant |

What each adapter ships, proven by `tenantIsolationContract` (`@ddd-ts-kit/testing/contracts`)
on PostgreSQL:

| Strategy | Knex | Drizzle | Prisma | TypeORM |
|---|---|---|---|---|
| Shared tables | `tenantTable`, `ownTenantTable`, `whereTenant`; read models with `tenant` | `tenantCondition`, `ownTenantCondition`; read models with `tenant` | by hand: `tenantScopeOf` and `tenantReachOf` in every statement, no helper, no contract run | by hand, as Prisma |
| Row-level security | `enableTenantIsolation`, `tenantSession` | `tenantPolicy`, `forceRowLevelSecurity`, `tenantSession` | not shipped | not shipped |
| Schema per tenant | `tenantSchemaTable`, `migrateTenantSchema`, `tenantSearchPath` | not shipped: a drizzle table is bound to its schema where it is declared | not shipped | not shipped |
| Database per tenant | `TenantDatabases`, `createTenantRoutedUnitOfWork`, `migrateEveryTenant` | not shipped | not shipped | not shipped |

The outbox keeps the tenant of each event on Knex (`tenant: true`) and Drizzle
(`tenantOutboxTable`); the Prisma and TypeORM outboxes do not store it yet, so their consumers
run in no tenant.

Three rules hold whatever the strategy:

- **Reads may widen, writes never.** An elevation widens what a read reaches; an update or a
  delete always names the one tenant of the work (`ownTenantTable`, `ownTenantCondition`), so a
  staff session reading across tenants cannot write across them.
- **No tenant, no data.** Work that names no tenant is refused before any SQL
  (`NoCurrentTenantError`) on shared tables and schemas, and reaches no database at all on
  database per tenant. Under row-level security, a statement without the tenant settings sees
  nothing.
- **Keys are unique across tenants.** Identifiers are generated (UUIDs), so that a key never
  names two rows; the isolation contract checks that another tenant saving under an existing id
  changes nothing.

## Propagation: every hop keeps the tenant

- **Integration events.** `scopedPublisher` stamps the tenant of the work on every event published
  without one; the outbox keeps it (`tenant_id`, see the persistence packages); the brokers
  carry it in the envelope and in a header (`x-tenant-id`, `tenant-id` for Redis Streams);
  `executionContextOfEvent` opens the consumer's scope in that tenant. A consumer therefore
  reads and writes the tenant of the fact it handles, and nothing else.
- **Scheduled jobs.** A job states `tenancy: 'global'` (the default) or `'per-tenant'`. A
  per-tenant job runs once per tenant, one after the other, each run in that tenant's scope; one
  tenant failing does not stop the others.
- **Caches, rate limits and locks.** A key of a shared store is confined to the tenant:
  `tenantCacheKey(scope, ...)`, `tenantKey(scope, ...)`. A key built without it is shared by
  every tenant, which is right for platform data only.
- **Logs, traces, error reports and the audit trail.** `logFieldsOf` writes `tenantId` on every
  line; the audit trail keeps one hash chain per tenant (`tenant:<id>`), so that a tenant's
  history can be handed over and verified alone.

## Platform staff: elevation, never implicit

Support and operations sometimes need to read across tenants. The kit refuses to infer it from a
role: a role that silently widened every query would turn one stolen session into a breach of
every tenant. Instead:

1. A use case or a guard decides the permission to elevate, like any permission.
2. The platform calls `acrossTenants({ scope, trail, clock, ids }, { reason, tenants }, work)`:
   a stable reason code and the tenants reached (`all` or a list) are required.
3. The elevation is written to the audit trail (action `tenancy:elevate`) **before** the work
   runs; a trail that cannot record it refuses it.
4. Inside, reads see the tenants named; writes still name one tenant.

## Limits and when not to use it

- **One tenant per unit of work.** A request that must write to two tenants is two units of
  work, on purpose: one transaction never spans tenants.
- **The tenant is infrastructure's.** A business rule that depends on the tenant (a plan, a
  setting) receives it as data in the command, like the actor; it does not read the scope.
- **A single-customer product does not need any of this.** The strategies cost a column, a
  policy, a schema or a database per tenant, and the discipline of proving isolation.

## Sources

- Microsoft, "Tenancy models for SaaS applications" (Azure SQL Database documentation): shared
  tables, schema and database per tenant, and their trade-offs.
- PostgreSQL documentation, "Row Security Policies" (section 5.9 of the manual).
- AWS SaaS Lens, "Tenant isolation" (Well-Architected Framework).

## See also

- [Actor and execution scope](actor-and-execution-scope.md)
- [Authentication and authorization](authentication-and-authorization.md)
- [Audit trail](audit-trail.md)
- [Scheduled jobs](scheduled-jobs.md)
- [Persistence](../tools/persistence.md)
