# Audit trail

An audit trail answers "who did what, on what, when, with what outcome, on whose behalf",
and can prove it was not rewritten. It is recorded around the use cases, never by them.
`stack.audit: on` (the default with an ORM) wires it in `src/platform/audit/`. API: README of
`@ddd-ts-kit/audit`.

## Sources

| What | Recorded by |
|---|---|
| every authorization decision, denials always | the decision hook of the authorization |
| every command, with its outcome and error code | a bus middleware before the unit of work: success inside the transaction, failure after the rollback |
| every integration event crossing a boundary | one idempotent consumer named `audit`; `generate integration-event` registers each new event in `audited-events.ts` |
| bulk reads and exports | the infrastructure that performs them, as the exception |

Actor, session, impersonation, tenant, correlation and origin come from the execution
scope. A handler or an aggregate calling the audit trail is a defect: the middleware
already does.

## What an entry may contain

Identifiers and codes by default, no payload. A field appears only when declared for that
command, and personal data only masked (keyed hash: equality can be checked, the value
cannot be read). Never free text, tokens, request bodies or error messages. An append-only
chain and the right to erasure coexist only because personal data stays out of it.

## Integrity

Entries are hash-chained per tenant; the store refuses update and delete, at the database
level too (append-only triggers). Chain verification finds the first altered, missing or
reordered entry. A store able to rewrite a whole chain is caught only by an external anchor:
publish the periodic checkpoint hash where the application cannot write.

## Reading it

Reading the trail is itself a protected, paginated use case (`GET /audit/entries`,
permission `audit:trail.read`), bounded by the tenant of the actor. It is a capability of
the platform, not a bounded context. Support staff acting as a user appear as such.

## Review checklist

- Denied decisions are recorded, and tested.
- A failed command leaves an entry; a rolled-back success leaves none.
- No personal data in clear.
- The application's database role cannot update or delete entries.
- Chain verification runs on a schedule (a job) and alerts.
