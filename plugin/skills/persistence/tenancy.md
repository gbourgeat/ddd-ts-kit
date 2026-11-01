# Tenancy: statements confined to the tenant

Read under `stack.tenancy: shared-table`, under a strategy wired by hand (`row-level-security`,
`schema-per-tenant`, `database-per-tenant`), or before a project becomes multi-tenant. What a
tenant is, the four strategies and the propagation of the tenant are in
`docs/concepts/multitenancy.md` of the kit; what follows is what a repository writes and what
`tenancy/scoped-statement` refuses.

## Every statement on tenant data

- It goes through the helpers of the ORM package: `tenantTable` and `ownTenantTable` (Knex),
  `tenantCondition` and `ownTenantCondition` (Drizzle), `tenantWhere` and `ownTenantWhere` spread
  into the where (Prisma, TypeORM; `findFirst`, never `findUnique` or `save`: the key holds no
  tenant).
- `tenantScopeOf` in every inserted row.
- Never a table straight from the executor, the client or the manager; a read model store is
  built with its `tenant` option (`tenancy/scoped-statement`).
- The condition is a conjunct of the statement: SQL binds `and` before `or`, so an alternative
  beside it is outside it, and `tenancy/scoped-statement` reports it. Alternatives go in a group
  beside the condition:
  - Knex: `.where((either) => either.where(a).orWhere(b))`, never `.orWhere*` or `.or` at the top
    of a statement of `tenantTable`, `ownTenantTable` or `whereTenant`, which throw
    `UngroupedOrError` when the statement is built; `clearWhere()` and `clear('where')` throw
    `ClearedTenantConditionError`. The text of a `whereRaw`, or a `knex.raw` given to a where, is
    kept in parentheses as one conjunct. An `orHaving` applies after the where, and is free.
  - Drizzle: `.where(and(tenantCondition(...), or(a, b)))`; the condition a direct argument of
    `where` or of `and`, never under `or`, `not` or a `sql` template.
  - Prisma: `where: { ...tenantWhere(this.scope), OR: [a, b] }`; the spread at the top of the
    `where` or of its `AND`, never under `OR`, `NOT` or a relation.
  - TypeORM: the spread at the top of the where, in each entry of a where array, and
    `.andWhere(new Brackets((either) => either.where(a).orWhere(b)))` on a query builder, never
    an `orWhere` at its top, and the condition in its last `where` or an `andWhere` after it: a
    `where` resets what comes before it.
- Reads may widen under an audited elevation, writes never.
- A read model in OpenSearch takes the tenancy of the platform (`SearchIndexes`), never its own:
  [search.md](search.md).
- A measure grouped then paged selects from the scoped query with `derivedTable`. A raw
  aggregate is fine in its select as a literal (bind a list as one value, `state = any(?)`,
  rather than interpolating placeholders); raw SQL that names a table, calls an unknown function
  or interpolates is not.

## A context of no tenant

A context whose tables belong to no tenant because it decides who belongs to which (the identity
preset) is declared `"tenancy": "control-plane"` under `contexts.<name>`, with its deviation and
ADR: the rule leaves it alone, no suppression per statement.

## The other strategies, and the move

Row-level security, schema and database per tenant are in the packages, wired by hand; prove the
adapter with `tenantIsolationContract`. A project that becomes multi-tenant migrates with
`addTenantColumn` and `addOutboxTenantColumn(..., { tenantOfUnpublished })`.
