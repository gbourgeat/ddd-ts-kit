# ADR-0003: A practice is not a tenant

- Status: accepted
- Date: 2026-10-13

## Context

The kit offers multitenancy strategies (`"stack.tenancy"`: shared tables with a tenant column,
row-level security, a schema or a database per tenant), in which every statement of a repository
is confined to the tenant of the work, and a caller outside a tenant is refused at the edge. The
data of this application is grouped by practice: calendars, appointments and desks belong to one
practice, and the tokens of the realm carry a `tenant_id` claim.

A tenant is a storage boundary: no read and no write may cross it, whoever asks. A practice is
not one here. A patient books in several practices with one account and lists their
appointments across them; a practitioner may work in two practices; the platform administrator
opens practices. What a user may reach in a practice is a relationship of the authorization model
(manager, practitioner, assistant of a practice; holder or delegate of a desk; patient of an
appointment), decided per element and listed by `listAccessible`, which every search of the
application is narrowed by.

## Decision

The application serves one customer, the network of practices, and its configuration says
nothing of tenancy (`"stack.tenancy"` absent, read as `none`). The boundary between practices is
enforced by the authorization model, per element: no use case reaches an element without a
relationship to it or a role that grants it (ADR-0001), and no search returns an element outside
the scope of the actor. The `tenant_id` claim keeps its role in the audit trail (one chain per
tenant of the actor) and in the log fields.

## Consequences

- Easier: a patient and a practitioner work across practices with one session, and no request
  has to name a practice to reach its own appointments.
- Harder: isolation between practices rests on the authorization model and on the scoped
  searches, not on the storage. A repository statement without a scope would cross practices;
  the specs of the handlers and the scoped read ports are what hold it.
- To revisit: if the application is sold to several independent networks, each network becomes
  a tenant (`init --tenancy shared-table`, the repositories through `tenantTable`), and practices
  stay relationships inside it.

## Alternatives considered

- **Each practice a tenant on shared tables.** Every statement confined to one practice, a
  mismatch refused at the edge. Refused: a patient's list of appointments spans practices, and a
  practitioner of two practices would need two sessions; the relationship model already decides
  per element what a tenant boundary would decide per row.
- **One network as a tenant now.** Possible, and harmless with one network, but it would add a
  column and a condition to every table for a boundary nobody crosses yet.
