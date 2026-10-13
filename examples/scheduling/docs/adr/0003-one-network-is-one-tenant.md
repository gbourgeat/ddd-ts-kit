# ADR-0003: One network of practices is one tenant

- Status: accepted
- Date: 2026-10-13

## Context

The owner asked for the tenant strategy of this application to be made explicit and enforced, and
for every rule of the kit to be applied to the example and tested there. The kit offers
multitenancy strategies (`"stack.tenancy"`: shared tables with a tenant column, row-level
security, a schema or a database per tenant), in which every statement of a repository is
confined to the tenant of the work, and a caller outside a tenant is refused at the edge.

The data of this application is grouped by practice: calendars, appointments and desks belong
to one practice. A practice is not a storage boundary, though: a patient books in several
practices with one account and lists their appointments across them, and a practitioner may work
in two practices. What a user may reach in a practice is a relationship of the authorization
model (manager, practitioner, assistant of a practice; holder or delegate of a desk; patient of
an appointment), decided per element and listed by `listAccessible` (ADR-0001).

The customer of the application is a network of practices. Sold to several networks, the data
of one network must never be read or changed by another, whoever asks.

## Decision

One network of practices is one tenant, on shared tables (`"stack.tenancy": "shared-table"`):

- every table of the contexts has a `tenant_id` column, the network, and the migration
  `20261013120000_keep-the-network-of-every-row` adds it to a database created before
  (`addTenantColumn`), giving the rows already there to the network named by
  `NETWORK_OF_EXISTING_ROWS`;
- every repository and read model reaches its table through `tenantTable` and `ownTenantTable`
  or the `tenant` option of its store, and `tenancy/scoped-statement` judges the adapters of
  the contexts with no finding;
- the outbox keeps the network of each event, so that its consumers run in it; the scheduled
  jobs run once per network (`tenancy: 'per-tenant'`, the networks listed by `NETWORKS`); the
  audit trail keeps one chain per network, and its read side is confined to the network of the
  work (`TenantAuditReader`);
- the `tenant_id` claim of the token names the network of the user; a request may name it in
  `x-tenant-id`, and a caller that names a network it does not belong to is refused with 403
  before anything runs;
- the administrator of a network (`network-admin`) opens its practices; platform staff
  (`platform-admin`) belong to no network and read the audit trail of every network only
  through an elevation (`acrossTenants`, reason `AUDIT_TRAIL_SEARCH`), which the trail records
  before the read runs.

Practices stay what they were: relationships of the authorization model inside a network. The
boundary between practices is decided per element, as before; the boundary between networks is
the storage.

## Consequences

- Easier: a patient and a practitioner still work across the practices of their network with
  one session. No statement can reach another network: forgetting a condition is reported by
  the checker, and the isolation of each repository is proven by `tenantIsolationContract`.
- Harder: a column and a condition on every table; every unit of work names a network, so a
  job, a consumer or a tool that names none is refused (`NoCurrentTenantError`); a user who
  works for two networks needs two accounts, or a token listing both (`tenants`).
- The relation tuples of the authorization model (`authorization.relation_tuples`) are not
  confined to a network: the elements they name have identifiers unique across networks, and
  every element a use case reads is confined by its repository. Confining them too is the next
  step if an authorization engine shared by several applications is introduced.

## Alternatives considered

- **No tenancy.** The application serves one customer, and the boundary between practices is the
  authorization model alone. Refused: what the owner asked for is an enforced tenancy, applied
  and tested on the example like every rule of the kit, and a second network would leave the
  isolation to the specs of the handlers.
- **Each practice a tenant on shared tables.** Every statement confined to one practice.
  Refused: a patient's list of appointments spans practices, and a practitioner of two practices
  would need two sessions; the relationship model already decides per element what a tenant
  boundary would decide per row.
- **Row-level security, or a schema or a database per network.** Stronger lines of defence,
  wired by hand today (`init` generates shared tables only). Shared tables are enough for a few
  networks of similar size, and a later move to row-level security keeps the same column.
