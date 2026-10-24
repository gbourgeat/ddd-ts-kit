**English** · [Français](personal-data.fr.md)

# Personal data in a generated project

**Summary.** A generated project knows which of its columns hold personal data, and erases a person
from all of them with one command. `init` writes the privacy folder of the platform (`--privacy on`,
the default with an ORM): the lists of the copies and of the exports each context declares, and the
scripts `privacy:erase` and `privacy:export`. `generate repository <context> <Aggregate> --personal
<column>,...` declares what a table keeps of a person, next to its mapper, and writes once per
context the erasure and the export that read every such declaration: two ports, their adapters over
the ones of the ORM package, their fakes, one spec and their lines in the copies and the exports of
the platform. With `--event-sourcing
on`, the key of the person in the event store is destroyed first, so that their stored events read
as erased. These are the mechanisms of privacy by design, built in by default; what a tool cannot
decide, the lawful basis of a processing or the completeness of a declaration, stays the project's
own, and this page says so. The pieces of the kit this page rests on:
[Event sourcing](event-sourcing.md#personal-data-crypto-shredding) for the sealing of stored events,
[Audit trail](audit-trail.md#the-right-to-erasure-and-an-append-only-chain) for the dated proof,
[Multitenancy](multitenancy.md) for what a tenant confines.

![The erasure of a person in a generated project: the script calls runErasure of the platform, which hands eraseDataSubject of the kernel the key of the person, every copy listed in data-subject-copies.ts, one port per context whose adapter erases the tables declared with personalFields, and the projections to rebuild; the report counts the rows reached per context; below, what generate repository --personal writes](../assets/diagrams/personal-data-erasure.svg)

## What a generated project holds

| Written by | What | Where |
|---|---|---|
| `init --privacy on` (`on` with an ORM, `off` without one or when asked) | the lists of the copies and of the exports the contexts declare, `runErasure` and `runExport`, the two scripts | `src/platform/privacy/`, `scripts/privacy-erase.ts`, `scripts/privacy-export.ts` |
| `init --event-sourcing on` (`off` unless asked) | the event store, the keys of the data subjects and the cipher that seals a personal value of a stored event, audited when the trail is on | `src/platform/event-sourcing/`, the `event_store` schema |
| `generate repository <ctx> <Aggregate> --personal <column>,...` | the columns in the storage, their declaration, and once per context the erasure and the export that read it | the context |

A project without personal data takes `--privacy off` and pays nothing; a project whose aggregates
are all rows keeps `--event-sourcing off` and pays no table for it. Both are recorded in the config
(`stack.privacy`, `stack.eventSourcing`) and changed later by `init --force`
([CONFIG.md](../CONFIG.md)).

## Declaring what a table keeps of a person

```bash
npx ddd-ts-kit generate repository billing Customer --personal email,display_name
npx ddd-ts-kit generate repository billing Invoice --personal customer_email --subject customer_id --erasure row
```

The first command declares that the `customers` table keeps the email and the display name of the
person the row is about, named by its `id`: an erasure pseudonymises them, the row stays and each
reads `[erased]`. The second declares that the `invoices` table copies the email of a customer, named
by `customer_id`, and that an erasure deletes those rows. Each command:

- adds the columns to the table and to the row type of the aggregate, as nullable text; the mapper
  writes them empty, with a note, until the aggregate carries them (a value object `Email`, a field
  of the state);
- writes the declaration `infrastructure/persistence/<aggregate>.personal-fields.ts` next to the
  mapper, with `personalFields` of the kernel, spelled as the erasure of the ORM reads it: the SQL
  names on Knex and Prisma, the properties of the definition on Drizzle and TypeORM;
- the first time in a context, writes its erasure: the port
  `application/ports/<context>-personal-data-erasure.port.ts`, an abstract class that extends
  `PersonalDataErasure` of the kernel; the adapter
  `infrastructure/persistence/<orm>-<context>-personal-data-erasure.repository.ts`, which extends
  the erasure of the ORM package (`KnexPersonalDataErasure`, `DrizzlePersonalDataErasure`,
  `PrismaPersonalDataErasure`, `TypeOrmPersonalDataErasure`) with the declarations of the context,
  confined to the tenant of the work when the repository is tenant-scoped; its fake; a spec that
  saves two people through the repository, writes their personal columns and proves the erasure and
  the export on the test database; and its binding, the `@Repository` decorator in the declared
  style, the module file of an explicit context, the factory of a hand-wired platform;
- the first time in a context too, writes its export: the port
  `application/ports/<context>-personal-data-export.port.ts`, which extends `PersonalDataExport` of
  the kernel; the adapter `infrastructure/persistence/<orm>-<context>-personal-data-export.repository.ts`,
  which extends the export of the ORM package (`KnexPersonalDataExport`, `DrizzlePersonalDataExport`,
  `PrismaPersonalDataExport`, `TypeOrmPersonalDataExport`) with the same declarations, confined to
  the tenant the same way; its fake; bound the same way;
- lists the two ports once, in `src/platform/privacy/data-subject-copies.ts` and
  `data-subject-exports.ts`, between the markers; `init --force` lists them again when it rewrites
  the files;
- a later table of the same context joins the `declarations` of both adapters, between markers.

```ts
// infrastructure/persistence/customer.personal-fields.ts, as generated on Knex
const TABLE = { schema: BILLING_SCHEMA, table: 'customers' };

const declaration: PersonalFieldsOptions<CustomerRow> = {
  subject: 'id',
  fields: ['email', 'display_name'],
  erasure: 'pseudonymise',
};

export const CustomerPersonalFields = personalFields(TABLE, declaration);
```

The subject column names the data subject a row is about, an opaque identifier: `id` when the row
is the person, the column that holds the id of the person otherwise. It is never personal data
itself, and the generator refuses a subject listed in `--personal`. The columns are given by their
SQL names, lower case letters, digits and underscores; a column the generated table keeps for itself
(`id`, `version`, `registered_at`, `tenant_id`, the audit columns) is refused, as is a project
without the privacy folder (`init --force --privacy on`) or without an ORM package that ships the
erasure (`--orm none`, `--orm custom`).

The two modes, settled per table:

| `--erasure` | What the rows of the person read afterwards | When |
|---|---|---|
| `pseudonymise` (the default) | the row stays, each personal text column reads `[erased]`, any other personal column reads nothing (it has to accept null) | a row others point to, a fact of the business that names the person by an opaque id |
| `row` | the rows of the person are deleted | a pure copy of the person, a contact, an address book entry |

## The erasure, end to end

`npm run privacy:erase -- <subject-id> [--operator <who-asks>]` runs on the sources with the
variables of `.env`. The script opens the persistence, composes the application, opens an execution
context of origin `cli` with the operator as actor, and runs `eraseDataSubject` of the kernel over:

1. the key of the subject, when the project has an event store: destroyed, so that every stored
   event of the person reads `[erased]` at the next replay, and audited when the trail is on;
2. every copy listed in `data-subject-copies.ts`, one port per context, resolved from the
   application: each adapter erases or pseudonymises the rows of its declared tables, in the tenant
   of the work; with `--tenancy shared-table`, `TENANTS` names the tenants, comma separated, and a
   copy runs once per tenant, since a write of tenant data is never widened;
3. the projections fed by the store, rebuilt once the key is gone: given by hand for now, where the
   runner says `TODO(platform)`.

It prints the report as JSON: whether a key was destroyed, the rows each context reached, the
projections rebuilt. A copy that fails does not stop the others, and the first failure is thrown
once everything ran: running the erasure again completes one that failed half way, reaches nothing
the second time and says so. A subject that is not an opaque identifier (a name, an email) is
refused before anything is touched.

Once every copy is erased, `runErasure` publishes `privacy.data-subject.erased` through the outbox
(`dataSubjectErasedV1` of the kernel, `{ subjectId, erasedAt, requestedBy }`, identifiers only),
once per tenant with shared tables; the relay of the running application delivers it. An erasure
that failed publishes nothing, and running it again does. This is how article 19 reaches beyond the
database the platform holds:

- a context extracted into a service of its own erases its copy on its side: `npx ddd-ts-kit
  generate erasure-handler <context>` writes the idempotent handler of the event over the erasure
  of the context, its spec on the fake and its subscription (the decorator, the module file, or the
  hand-wired platform, in a transaction behind a broker). In the monolith the platform has erased
  that copy already, and the handler reaches nothing: an erasure is idempotent;
- a system outside the project that consumes the events of the project, and copied the person from
  one of them, subscribes to the same type: the event catalog and AsyncAPI list it;
- an integration event that carries personal data says so (`personal: { subject, fields }` on
  `defineIntegrationEvent`): the catalog writes it under the payload, AsyncAPI as
  `x-personal-data`, so that every consumer knows which copy it keeps
  ([`@ddd-ts-kit/events`](../../packages/events/README.md#personal-data-in-a-payload)).

In a handler spec, the fake of the erasure (`Fake<Context>PersonalDataErasure`) counts the rows it
holds of a person and forgets them at the first erasure, like the fake of a repository.

## The export, end to end

![The export of a person in a generated project: the script calls runExport of the platform, which hands exportDataSubject of the kernel every export listed in data-subject-exports.ts, one port per context whose adapter reads the tables declared with personalFields; each export is wrapped by auditedPersonalDataExport when the trail is on; the result is one dated document, printed as JSON](../assets/diagrams/personal-data-export.svg)

`npm run privacy:export -- <subject-id> [--operator <who-asks>] > export.json` answers the right of
access and to portability (GDPR articles 15 and 20) the same way: the script composes the
application, opens an execution context of origin `cli` with the operator as actor, and runs
`exportDataSubject` of the kernel over every export listed in `data-subject-exports.ts`, one port
per context, in every tenant named by `TENANTS` with shared tables, since a read of tenant data is
confined to its tenant as a write is. Each adapter reads the same declarations as the erasure and
answers one record per row about the person, under `<context>.<table>`, with the personal columns
and the keys of the files as plain data, no other column and nothing of anyone else; a row
pseudonymised already reads `[erased]`, a row deleted answers nothing. The result is one document:

```json
{
  "format": "ddd-ts-kit/personal-data-export@1",
  "subject": "cus_42",
  "exportedAt": "2026-10-24T09:30:00.000Z",
  "records": [
    { "source": "billing.customers", "values": { "email": "ada@example.org", "display_name": "Ada" } },
    { "source": "billing.invoices", "values": { "customer_email": "ada@example.org" } },
    { "source": "crm.contacts", "values": { "email": "ada@example.org", "phone": null } }
  ]
}
```

Structured, commonly used and machine-readable, as article 20 asks; dated, so that what it states
is true of that instant; named by the format, so that a reader knows the shape and a later shape is
told apart; naming the person by the opaque id alone. Hand it over to the person, then delete the
file. The exports run in the order listed, so a document reads the same from one run to the next,
and one that fails stops the gathering: a document that silently lacked a context would state less
than the system keeps. A subject that is not an opaque identifier is refused before anything is
read: an export looks a person up by id, never by a name or an email, which would be a search in
personal data.

With `--audit on`, `runExport` wraps every port with `auditedPersonalDataExport` of
`@ddd-ts-kit/audit`: one entry per context, category `data-access`, action `personal-data:export`,
the operator, the subject, the context and the number of records, never the values, written before
the records are handed over, so that no document leaves without its trace. This is the
accountability of article 5(2) for the right of access: who read what of whom, and when
([Audit trail](audit-trail.md#the-right-to-erasure-and-an-append-only-chain)). The trail is
append-only, so every run is a handover and leaves its entry, a trial included: try the script on a
test subject, never on a real person.

In a handler spec, the fake of the export (`Fake<Context>PersonalDataExport`) hands over the records
a test gave it and remembers who was asked.

## What stays out of reach

- **Backups and the retention of the broker.** An erasure reaches the database, never a backup nor a
  message already published: the bound of an erasure is a date, which the retention policy decides.
  The announcement reaches the consumers that are running and subscribed; a message already in a
  dead letter queue or on a topic stays there until its retention ends.
  The keys of the event store make the events of a backup unreadable once destroyed, which is why
  they live apart, with a shorter retention ([Event sourcing](event-sourcing.md#personal-data-crypto-shredding)).
- **Logs and exports already handed over.** Nothing of the kit rewrites them; the log adapters mask
  credentials, not names ([Observability](observability.md#what-each-signal-may-carry)).
- **A column no declaration names.** A rule reads the name of a column, not what a text field may
  contain: a `notes` column may hold a diagnosis. The declarations are the inventory a project
  maintains; the `privacy/*` rules that report an undeclared column of the usual vocabulary come
  with a later part of [the proposal](../proposals/privacy-by-design.md).
- **A read model.** A projection keeps its rows in a read model store, not in a table of its own:
  it declares nothing yet. The rebuild of a projection fed by the event store removes the clear copy
  it kept, once given to `rebuilds`.
- **The columns the aggregate does not write yet.** The mapper writes the declared columns empty
  until the aggregate carries them; the erasure of an empty column reaches the row all the same.

## What the tool does not decide

The kit provides the technical measures of privacy by design (GDPR article 25): declaration,
erasure, export, a dated proof, and a register and retention to come. The lawful basis of each
processing, the information of the data subjects, the processors and the impact assessment are the
project's own; whether a pseudonymised row is an erasure in the eyes of the law is for the
controller to decide, as the audit trail page says of what stays in the chain. The document of an
export carries the data; the information that goes with an answer to a request of access (the
purposes, the recipients, the retention, the rights of the person, article 15(1)) is the letter the
project writes around it. By construction means built in by default, never a legal guarantee.

## See also

- [Event sourcing, per aggregate](event-sourcing.md): the sealing of stored events and the keys
- [Audit trail](audit-trail.md): the dated proof of an erasure and of an export, the masks keyed by data subject
- [Multitenancy](multitenancy.md): what a tenant confines, and why an erasure runs once per tenant
- [File storage](file-storage.md): the files of a person, declared as `files` of a declaration
- [Privacy by design, beyond event sourcing](../proposals/privacy-by-design.md): the parts built and
  the parts to come, the wording to use
- The CLI reference: [`init`](../../packages/cli/README.md) (`--privacy`, `--event-sourcing`) and
  [`generate repository`](../../packages/cli/README.md) (`--personal`, `--subject`, `--erasure`)
