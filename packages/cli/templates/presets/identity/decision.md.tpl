# ADR-{{adr.number}}: {{context.kebab}} is the control plane of the tenants

- Status: accepted
- Date: {{adr.date}}

## Context

The project keeps the data of each organisation apart (`"stack.tenancy"`): every statement of a
repository is confined to the tenant of the work, and `tenancy/scoped-statement` reports one that
is not. The organisations of `{{context.kebab}}` are those tenants, and this context decides who
belongs to which: a person signs in once and lists their organisations, an invitation is answered
by a person who belongs to none yet, a membership is written for an organisation that is not the
one the request runs in.

## Decision

The tables of `{{context.kebab}}` (accounts, organisations, members, invitations, delegations)
belong to no tenant: they hold no tenant column, and `ddd-ts-kit.config.json` declares the context
the control plane of the tenants (`contexts.{{context.kebab}}.tenancy` set to `control-plane`),
with the entry of `deviations` that names this record. The generators then confine none of its
repositories, and `tenancy/scoped-statement` does not judge its adapters. What one organisation
may read of another is decided per use case instead: every use case of an organisation authorizes
the actor on the rights of their membership in it (the policies of `application/authorization/`),
and every read names that organisation.

## Consequences

- Easier: a person, their memberships and their invitations are one model, whatever the tenant
  of the request; the provider is told of every change, so that tokens name the organisations.
- Harder: isolation between the organisations of this context rests on its policies and on the
  organisation each statement names, not on the storage, and no rule of the kit reads its
  statements for a tenant. A new statement names its organisation.
- The integration events of an organisation carry it as their tenant, so that the consumers of the
  other contexts run in it.

## Alternatives considered

- **A tenant column on these tables.** Refused: the membership of a person in an organisation is
  written by work that does not run in that organisation (opening it, accepting an invitation),
  and an elevation widens reads only, never writes.
