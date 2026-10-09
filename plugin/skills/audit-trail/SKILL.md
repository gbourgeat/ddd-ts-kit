---
name: audit-trail
description: >-
  Sets up or reviews the audit trail of a ddd-ts-kit project. Tamper-evident, append-only
  entries recorded from outside the use cases (authorization decisions, executed commands,
  integration events), what may and may not be stored, how to verify the chain and how to
  expose it. Use when the user asks for an audit log, traceability, who did what, compliance
  evidence, when a handler is about to write an audit record itself, or when deciding what
  data an audit entry may contain.
---

# Audit trail

An audit trail answers "who did what, on what, when, with what outcome, on whose behalf",
and can prove it was not rewritten. It is recorded around the use cases, never by them.

API and wiring: README of `@ddd-ts-kit/audit`. `ddd-ts-kit init --audit on` (the default with an
ORM) wires the three sources and a protected, paginated `GET /audit/entries` in
`src/platform/audit/`; `generate integration-event` registers each new event with it.

## Sources

| What | How it is recorded | Written by |
|---|---|---|
| every authorization decision, denials always | the decision hook of the authorization middleware | platform |
| every command, with outcome and error code | a bus middleware placed before the unit of work: success inside the transaction, failure after the rollback | platform |
| every integration event crossing a boundary | one universal, idempotent consumer | platform |
| bulk reads and exports | an explicit record by the infrastructure that performs them | the adapter, as the exception |

Actor, session, impersonation, tenant, correlation and origin come from the execution scope.
A handler or an aggregate calling the audit trail is a defect: the middleware already does.

## What an entry may contain

Identifiers and codes by default, no payload. A field appears only if declared for that
command (`auditedFields(RescheduleAppointment, ['startsAt'])`), and personal data only masked
(keyed hash: equality can be checked, the value cannot be read). Never free text, tokens,
full request bodies or error messages. An append-only chain and the right to erasure coexist
only because personal data stays out of it.

## Integrity

Entries are hash-chained per tenant; the store refuses update and delete, at the database
level too. `verifyChain` finds the first altered, missing or reordered entry. A store that
could rewrite a whole chain is caught only by an external anchor: publish the periodic
checkpoint hash somewhere the application cannot write.

## Reading it

Reading the audit trail is itself a protected, audited use case with its own permission, and
paginated. Support staff acting as a user appear as such: the impersonator is on the entry.

## Review checklist

- Denied decisions are recorded, and tested.
- A failed command leaves an entry; a rolled-back success leaves none.
- No personal data in clear in `changes`.
- The application's database role cannot update or delete entries.
- Chain verification runs on a schedule and alerts.
