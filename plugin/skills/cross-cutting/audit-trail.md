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
| every erasure of a data subject (crypto-shredding), with whether a key was destroyed | `auditedSubjectKeys`, the key store wrapped where it is bound (`src/platform/event-sourcing/create-event-sourcing.ts`, written by `init --event-sourcing on`), whoever calls `erase` |
| every export of what a context keeps of a data subject, with the number of records and never the values | `auditedPersonalDataExport`, the export port wrapped where the platform runs it (`src/platform/privacy/run-export.ts`, written by `init --privacy on` with the trail on) |
| bulk reads | the infrastructure that performs them, as the exception |

Actor, session, impersonation, tenant, correlation and origin come from the execution
scope. A handler or an aggregate calling the audit trail is a defect: the middleware
already does.

## What an entry may contain

Identifiers and codes by default, no payload. A field appears only when declared for that
command, and personal data only masked (keyed hash: equality can be checked, the value
cannot be read), under the key of the person it belongs to: `masker: subjectMasker(keys)` over
the `SubjectKeyStore`, and `masked('patientEmail', { subject: 'patientId' })` to say whose each
value is, so that erasing the person makes its masks meaningless. Never free text, tokens,
request bodies or error messages. An append-only chain and the right to erasure coexist only
because personal data stays out of it.

An erasure is proven by its own entry (`data-access`, `personal-data:erase`, the subject as
an opaque `data-subject` id): its date plus the retention of the key backups is the day the
erasure is complete. The key is destroyed first and the entry written after; when the entry
fails, the erasure fails and is run again, which records that no key was left. A script that
erases opens an execution context (operator as actor, origin `cli`), or `erase` is refused
before any key is touched: `npm run privacy:erase -- <subject-id> --operator <who-asks>` does.

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
- The `SubjectKeyStore` every caller resolves is the one wrapped by `auditedSubjectKeys`, and an export of a data subject goes through `auditedPersonalDataExport`.
- The application's database role cannot update or delete entries.
- Chain verification runs on a schedule (a job) and alerts.
