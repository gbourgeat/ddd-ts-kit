**English** · [Français](privacy-by-design.fr.md)

# Proposal: privacy by design, beyond event sourcing

**Summary.** The kit erases a person by crypto-shredding: a personal value of a stored event
is sealed with the key of its data subject, and destroying the key erases it everywhere the
event was copied, backups included, with a dated entry in the audit trail. That holds for the
aggregates kept as events, and nowhere else. A project `init` writes by default keeps its
aggregates as rows (Drizzle, Knex, Prisma or TypeORM), its read models as tables, and copies of
a person in the contexts that consumed its events: nothing of the kit erases, exports, retains
or inventories any of it, and no rule says so. This page verifies what the kit does today,
article by article of the GDPR, designs the missing pieces in the shape of the kit (one
declaration, ports with an adapter per ORM, generators, rule ids, nothing mandatory for a
project without personal data), cuts the work into pull requests in merge order, and says what
a tool can never guarantee, so that "by construction" is read as "built in by default" and never
as a legal guarantee.

## Status (2026-10-24)

Parts 0, 0b, 1, 2, 3, 4 and 5 are built. The parts, in merge order; each is a pull request of its own
with its tests, its documentation in both languages, its skills and its file of `changes/`.

| Part | Verdict |
|---|---|
| 0. This proposal | **written** |
| 0b. The example erases a person end to end, by hand | **built** (#267): the person of identity, the contact of notification, the notes, the cancellation reasons, the documents and the copied name in scheduling, network by network; the README of the example says what stays out of reach |
| 1. `personalFields` and the `PersonalDataErasure` and `PersonalDataExport` ports of the kernel | **built** (#268): the declaration, the two ports, `eraseDataSubject` and `inEachTenant` in the kernel, `InMemoryPersonalData`, the two contract suites of the testing package; with part 5, `exportDataSubject` and the `PersonalDataExportDocument` it answers, `recordsInEachTenant` |
| 2. `subjectMasker` of the audit trail, one key per data subject | **built** (#270): `subjectMasker(keys)` over the `SubjectKeyStore`, `masked(field, { subject })`, the refusal at wiring time of a masked field without a subject and, before any key, of a subject that is not an opaque id |
| 3. The erasure adapter on the four ORMs, read models included | **built** (#271): `KnexPersonalDataErasure`, `DrizzlePersonalDataErasure`, `PrismaPersonalDataErasure`, `TypeOrmPersonalDataErasure`, each under the contract suite, the tenant confined, the files deleted first; a read model is a table like any other. With part 5, the export adapter beside each: `KnexPersonalDataExport`, `DrizzlePersonalDataExport`, `PrismaPersonalDataExport`, `TypeOrmPersonalDataExport`, under `personalDataExportContract`, and `auditedPersonalDataExport` in the audit package |
| 4. `init` writes `src/platform/privacy/` and wires event sourcing | **built** (#274, then the two choices): `--privacy on`, the default with an ORM, writes `src/platform/privacy/` (the lists of copies and exports, `run-erasure.ts` and `run-export.ts`) and the scripts `privacy:erase` and `privacy:export`; `--event-sourcing on`, off unless asked, wires `Persistence.eventSourcing` on the four ORMs and in memory, and `src/platform/event-sourcing/` (the audited keys, the cipher, the module or `platform.eventSourcing`); a project without personal data pays nothing, one whose aggregates are rows pays no table; no HTTP command yet |
| 5. `generate repository` and `generate projection` declare the personal fields | **built** for the repositories: `generate repository <ctx> <Aggregate> --personal <column>,... [--subject <column>] [--erasure pseudonymise\|row]` adds the columns to the storage, writes the declaration next to the mapper on the four ORMs and, once per context, the erasure and the export that read it (two ports, adapters over `<Orm>PersonalDataErasure` and `<Orm>PersonalDataExport`, fakes, one spec on the test database, listed in the copies and the exports of the platform; `privacy:export` answers one dated document through `exportDataSubject`, each export audited when the trail is on). A projection keeps its rows in a read model store, not in a table of its own: the declaration of a read model waits for the register (part 9), which will read what the store keeps |
| 6. The erasure event, its generated handler, `personal` on an integration event | **built**: `dataSubjectErasedV1` (`privacy.data-subject.erased`, `{ subjectId, erasedAt }`, no operator: the audit trail keeps who asked) in the kernel, shaped as a definition of `@ddd-ts-kit/events` since the application layer of every context handles it; published through the outbox at the end of `privacy:erase`, once per tenant; `generate erasure-handler <context>` writes the idempotent handler over the erasure of the context in the three families; `personal: { subject, fields }` on `defineIntegrationEvent`, checked against the payload, written by the catalog and as `x-personal-data` in AsyncAPI. The generator of an integration event writes one id field: personal fields of a payload are written, and declared, by hand |
| 7. Retention on the declaration, the generated purge job | **built**: `retention: { after, days \| months \| years }` on `personalFields`, checked; `PersonalDataRetention` and `purgeExpiredPersonalData` in the kernel, `purgeExpired(now)` on the erasure adapters of the four ORMs under `personalDataRetentionContract`, in every tenant when the work names none; `auditedPersonalDataRetention`; `generate repository --retention <column>:<n><d\|m\|y>` (a column of yours that dates the end of the relation joins the storage as a nullable timestamp; `registered_at` is refused, since a purge counted from the registration would erase active customers); the job `privacy.purge-expired` every night and `npm run privacy:purge`. Not built: `retainedRows` for a table without personal data, which storage limitation does not reach; the purge of the outbox and of staged files already exist |
| 8. `archiveBefore` on the audit trail | **built** (#287 keeps the trail in the database on Prisma and TypeORM too, then the archive): `archiveBefore(date, { files, clock })` and `archivesOf(chain)` on the four SQL stores and in memory, each range verified from the anchor of the archive before it, written to the file storage, recorded with its last hash and the digest of its file, then deleted, which the guard allows for covered entries only; `verifyArchive` checks a file again, `verifyChain` starts from an anchor; `init` registers `audit.archive` on the first day of every month, twelve months kept online, when the trail is in a database and the files in a storage |
| 9. The generated register of personal data | **built**: `ddd-ts-kit docs` reads every `personalFields` call of `infrastructure/persistence/*.personal-fields.ts` (generated or written by hand, several per file) and the `personal` option of the integration events; each `CONTEXT.md` gains a Personal data section (added to one that has none once its context declares some), and with `--privacy on` `docs/privacy/register.md` lists the tables across the contexts, columns named as the database names them on the four ORMs, and the events that carry personal data with the contexts downstream; the purposes, the lawful basis, the recipients outside the system and what the code does not purge are sections the controller writes, kept by `docs`; `docs --check` fails on drift |
| 10. The `privacy/*` rules, as warnings first | **built**, and kept as warnings for good (they read names, never contents: a column `address` may name a warehouse; a team raises one to `error` in `rules`): `privacy/declared-field` (Knex, Drizzle and TypeORM tables of the contexts, Prisma models in their schema), `privacy/event-payload-declared` (the `z.object` of the declaration, the class or the interface of its `.payload.ts`), `privacy/erasure-reaches-copies` (a consumer in the application layer, a projection included, that declares no `PersonalDataErasure` and handles no `privacy.data-subject.erased`), `privacy/subject-is-opaque` (declarations and events), `privacy/no-personal-data-in-logs` (an approximation on the text of the calls); all in `ddd-ts-kit check` at `warn`, silent with `stack.privacy` off; the vocabulary of the kit with `privacy.vocabulary` and `privacy.allow` in the config; fixtures, `explain`, an injection each in the copy of the example, which keeps its own words allowed until part 11; no ESLint counterpart: the five read names across files, which the checker holds |
| 11. The example adopts the ports of the kit | proposed |
| 12. The concept page, the pages it touches, the public wording | **started** with part 5: [the concept page](../concepts/personal-data.md) says what a generated project holds, the erasure end to end, what stays out of reach and what the tool does not decide; the README and the other pages come with this part |

## What the kit does today

Verified on the sources of 0.88.0 and the pages that describe them.

**Erasure of stored events.** `personalData(subjectId, value)` marks a value in the `encode`
of a `defineStoredEvent`; `PersonalDataCipher` seals it with the key of its subject
(AES-256-GCM, a nonce per value) before the store keeps it; `SubjectKeyStore` holds one key
per subject, in memory or in a table of the event store, and `erase(subject)` destroys it, so
a replay reads `[erased]`. The four persistence packages give that table and that store
(`create<Orm>EventSourcing`). `auditedSubjectKeys` of `@ddd-ts-kit/audit` writes every erasure
to the trail, with its actor and its date
([Event sourcing](../concepts/event-sourcing.md#personal-data-crypto-shredding),
[Audit trail](../concepts/audit-trail.md#the-right-to-erasure-and-an-append-only-chain)).

**The audit trail.** An entry carries identifiers and codes, never content; a declared field
is masked by `hmacMasker(secret)`, one secret for the whole trail. The page says how a key per
data subject would make the masks of an erased person meaningless, and that the kit provides
no such masker.

**Around it.** Spans carry nothing personal and the log adapters mask credentials
([Observability](../concepts/observability.md#what-each-signal-may-carry)); a file key starts
with `tenants/<tenant>/` and a query that signs a link to a file holding personal data declares
its permission sensitive ([File storage](../concepts/file-storage.md#security)); the skill of
the integration events asks for identifiers and facts, not personal data, in a payload.

**The example.** `examples/scheduling` erases a patient with
`npm run erase:patient -- <patientId> <operatorId>`: the key, the audit entry, then the rebuild
of the projections fed by the store, so the history reads `[erased]`.

Three facts the pages did not say, and that this proposal starts from:

1. **`init` wires no event sourcing.** The platform templates mount the outbox, the processed
   events, the jobs and the processes; neither `create<Orm>EventSourcing`, nor the
   `SubjectKeyStore`, nor the `PersonalDataCipher`. `generate aggregate --event-sourced` writes
   the aggregate, the codec of its stored events (whose `TODO(domain)` names `personalData`),
   its builder and its spec, and no repository adapter nor serializer: the example wired all
   of it by hand in `src/platform/`.
2. **The example keeps a person in clear.** The `identity` context stores `display_name` and
   `email` in its `persons` table, `identity.person.registered` publishes both, and the
   `notification` context copies the address into its `contacts` read model. `erase:patient`
   touches none of the three: after an erasure the patient is still named and reachable in the
   database.
3. **Its README says the limit in half a sentence.** "Limits of the erasure" speaks of the day
   `identity` erases persons, and nowhere of what stays in those two tables and in the event.

## The requirements, line by line

What the GDPR asks of a system, what the kit does, what is missing. Effort: S is one pull
request of half a day, M one of a day, L two or three. Risk: what can turn a green project red
or mislead a reader.

| Article | The kit today | Missing | Effort | Risk |
|---|---|---|---|---|
| 25, data protection by design; 5(1)(c), minimisation | the trail without content, clean spans, server-made file keys, payloads of identifiers | one declaration of the personal fields, read by every tool; a rule that reports an undeclared one | M | low: a declaration left out changes nothing |
| 17, erasure, of stored events | sealing, `erase`, the audit entry | the wiring by `init` and by the generator | M | low |
| 17, erasure, of rows | nothing | the aggregates kept as rows on the four ORMs, the read models, the files of a person, a generated script or use case | L | medium: the repository templates of four ORMs and the end-to-end test of the CLI |
| 17, erasure, in the trail | `masked()` under one secret, a page that says how to do better | a masker keyed by data subject; the subject of a masked field, which `MaskingSubject` does not carry | S | low |
| 17 and 19, propagation to the copies | the outbox, idempotent consumers, dead letters | an erasure event of the kit and its generated handler; the copies in the read models of other contexts; the personal payloads kept by the outbox, the dead letters and the topics | L | medium: a contract published by the kit, versioned like the others |
| 15, access; 20, portability | nothing | an export port per context, a use case of the platform that gathers by person, a readable format | M | low |
| 5(1)(e), storage limitation | `purgePublished` of the outbox, the hourly purge of staged files, scheduled jobs per tenant | a retention declared per table or read model, a generated job that applies it, archiving of the trail | M | medium: a purge destroys; it has to be explicit and tested |
| 30, records of processing | `describe`, `docs`, the event catalog, AsyncAPI | a "Personal data" section of each `CONTEXT.md` and a register per person, both generated | S | low: generated, never written by hand |
| 32, security | keys per subject, kept apart; sensitive permissions on files; tenant scoping and row-level security | nothing the tool should add; the pages already say to keep the keys apart | none | none |
| 6, lawful basis; 12 to 14, information; 28, processors; 35, impact assessment | nothing, rightly | nothing a tool can build; the public wording has to say so | none | **high when the wording lets a reader believe otherwise** |

## The design: one declaration, read by everything

Today `personalData(subject, value)` is both the declaration and the mechanism, for one
support only. The proposal keeps the mechanism per support and generalises the declaration.
The names below are a proposal; the pull requests settle them.

### The declaration

An object of the infrastructure, next to the mapper, that says which columns of a row are
personal and whose they are:

```ts
// infrastructure/persistence/person.personal-fields.ts
export const personPersonalFields = personalFields(persons, {
  subject: (row) => row.id,
  fields: ['display_name', 'email'],
  erasure: 'row', // or 'pseudonymise': the row stays, the fields read [erased]
});
```

- In the kernel: `PersonalFields<Row>`, the function `personalFields`, and two optional ports,
  `PersonalDataErasure` (`erase(subject)`) and `PersonalDataExport` (`exportOf(subject)`). A
  context without personal data declares nothing and wires nothing.
- The four persistence packages give the same adapter, proven by one contract suite of
  `@ddd-ts-kit/testing`, as the fakes of the brokers and of the repositories are.
- The same declaration for a read model: `ReadModelStore` already deletes a row by key with its
  stamp; what it lacks is "the keys of a person", which the declaration gives. The same for the
  files of a person: an area per subject, since `FileKeys.next(area)` already takes one.
- For an integration event: `defineIntegrationEvent({ ..., personal: ['email'] })`. It erases
  nothing, since a published message is published; it feeds the catalog, the register and the
  rule that reports a personal field published in clear without saying so.
- `personalData()` of the stored events stays as it is: it becomes one of the forms of the same
  declaration, and the register reads it too.

### The mechanism: `eraseDataSubject` in the kernel, wired by `init`

The `eraseDataSubject` of the example (`src/platform/erasure/`) moves to the kernel: the keys
destroyed first, then every declared `PersonalDataErasure`, then the rebuild of the projections
fed by the store, then the audit entry, with the same refusals (an id that is not opaque, an id
nobody knows). `init` writes `src/platform/privacy/`: the key store wrapped by
`auditedSubjectKeys`, the cipher, the event sourcing stores when an aggregate is event-sourced,
a script `npm run privacy:erase -- <subjectId> <operatorId>`, and an `EraseDataSubject` command
with its permission `privacy.erase`, declared sensitive, for the projects that expose it over
HTTP. The same folder carries `npm run privacy:export`.

### The propagation: a contract published by the kit

An integration event `privacy.data-subject.erased` (version 1: `subjectId`, `erasedAt`; who
asked stays in the audit trail), published by the use case of the platform through the outbox, and
`generate integration-handler <context> --erasure`, which writes the idempotent handler that
calls the `PersonalDataErasure` of the context. The payload carries the identifier alone: a
consumer that copied the email into its read model removes it on its side. For the copies
already gone (dead letters, topics), the page says the truth: the retention of the broker is
the bound, as the retention of the backups is today for the keys.

### The trail: `subjectMasker(keys)`

An `AuditMasker` of `@ddd-ts-kit/audit` that derives its HMAC key from the key of the subject
in the `SubjectKeyStore` (HKDF of the material, labelled for the trail), with
`masked('patientEmail', { subject: (command) => command.patientId })`, since the subject of a
masked field is neither the actor nor the resource of the entry. Erasing the person makes its
masks impossible to recompute; the chain stays valid. `hmacMasker` stays for whoever wants one
secret.

### Retention: on the same declaration

`personalFields(..., { retention: { after: 'ends_at', months: 36 } })`, and an equivalent for a
table with no personal field but a bounded life. A generated job `<context>.purge-expired`
(`generate job --purge`), idempotent, calls `purgeExpired(now)` of the adapter, per tenant when
there are tenants. For the trail, `archiveBefore(date)` exports the entries of a chain to the
file storage with the hash of its head, then removes them; the chain goes on from a dated
anchor, which the page on anchoring already describes in principle.

### The register: generated

`ddd-ts-kit docs` adds a `## Personal data` section to each `CONTEXT.md` (field, subject,
support, erasure, retention, where it leaves) and writes `docs/privacy/register.md`, the view
per person: which contexts know a person, by which fields, who receives them, for how long.
`docs --check` fails on drift, as for the rest. It is not the record of article 30, which needs
the purpose, the lawful basis and the recipients outside the system: the page says so and
leaves those columns to the controller.

### The rules, each with an id

| Id | What it reports | Where |
|---|---|---|
| `privacy/declared-field` | a column of a table or a field of a read model whose name belongs to the personal vocabulary (`email`, `phone`, `birth_date`, `first_name`, `iban`... a list of the kit plus `privacy.vocabulary` of the config) without a `personalFields` declaration | `ddd-ts-kit check` (text) |
| `privacy/event-payload-declared` | a field of that vocabulary in the payload of an integration event without `personal: [...]` | check and ESLint |
| `privacy/erasure-reaches-copies` | a context that consumes an event declaring personal fields and has neither a `PersonalDataErasure` nor an erasure handler | check (project) |
| `privacy/subject-is-opaque` | a `personalFields` or a `personalData` whose subject is itself a personal field (an email as identifier) | check and ESLint |
| `privacy/no-personal-data-in-logs` | a call to the logger or the metrics whose argument names a declared personal field | ESLint (an approximation) |

All at `warn` by default. Proposed as errors one minor version later, as
[CONTRIBUTING.md](../../CONTRIBUTING.md) asks of a rule that blocks; settled when they were built:
they stay warnings, since they read names and never contents, and a team raises one to `error` in
`rules` of its config. All silent in a project without a declaration and without a word of the vocabulary:
nothing is mandatory for a project without personal data.

## The pull requests, in merge order

Each one with its tests, its English and French pages, its skills, its `changes/` file,
`claude plugin validate` when the plugin moves, `docs/ARCHITECTURE.md` when a rule or a folder
of the canonical tree moves. Independent except where said.

| # | Pull request | Content | After | Size |
|---|---|---|---|---|
| 0 | `docs(proposals): privacy by design` | this page and its French page, the link in the index, the glossary terms | nothing | S |
| 0b | `feat(example): scheduling erases a person end to end` | without waiting for the kit: one erasure step per context in the example (`identity` pseudonymises the `persons` row, `notification` deletes the `contacts` row), called by `eraseDataSubject` after the key and before the rebuilds; an integration spec that reads the database after `erase:patient`; the README says in clear what remains (the published event, the backups). That hand-written code is the specification of the port of part 1 | 0 | M |
| 1 | `feat(kernel): personalFields and the PersonalDataErasure port` | `PersonalFields`, `personalFields()`, the ports `PersonalDataErasure` and `PersonalDataExport`, `eraseDataSubject` lifted from the example, in-memory fakes, the contract suite in `@ddd-ts-kit/testing` | nothing | M |
| 2 | `feat(audit): subjectMasker on the SubjectKeyStore` | `subjectMasker(keys)`, `masked(field, { subject })`, `MaskingSubject.dataSubject`, the audit pages, the cross-cutting skill | nothing | S |
| 3 | `feat(orm): the erasure adapter on the four ORMs` | `DrizzlePersonalDataErasure`, Knex, Prisma, TypeORM, `erasure: 'row' \| 'pseudonymise'`, read models included, each under the contract suite, the tenant respected | 1 | M, or one pull request per ORM |
| 4 | `feat(cli): init writes the privacy platform folder` | `src/platform/privacy/`: the audited keys, the cipher, `privacy:erase`, `privacy:export`, the event sourcing stores when an aggregate is event-sourced, the optional `EraseDataSubject` command; `init --force` for an existing project; section 2 of the architecture reference | 1, 2 | M |
| 5 | `feat(cli): generate repository declares the personal fields` | `generate repository ... --personal <field>,<field> --subject <column>` writes the declaration next to the mapper on the four ORMs; `generate projection` the same for a read model; the end-to-end test generates then checks | 1, 3 | M |
| 6 | `feat(events): the erasure event and its generated handler` | `dataSubjectErasedV1` in `@ddd-ts-kit/events`, published by the use case of the platform; `generate integration-handler --erasure`; `personal: [...]` on `defineIntegrationEvent`, read by the catalog and AsyncAPI (`x-personal-data`) | 1, 4 | M |
| 7 | `feat(kernel): retention on the declaration and the purge job` | `retention` on `personalFields` and `retainedRows` for a table without personal field, `purgeExpired` on the adapters, `generate job --purge`, per tenant | 3 | M |
| 8 | `feat(audit): archiveBefore on the trail` | archiving of a chain to `FileStorage` with the hash of its head, the anchor, the page of its limits | nothing | M |
| 9 | `feat(cli): the personal data register` | the `## Personal data` section of `CONTEXT.md`, `docs/privacy/register.md`, `describe --json`, `docs --check` | 1, 6 | S |
| 10 | `feat(check): the privacy rules` | the five rules at `warn` with their transition, fixtures, `explain`, sections 3 and 4 of the architecture reference, the skills (persistence, integration-event, cross-cutting); ESLint for the two that read code, in a second pull request | 1, 6 | L |
| 11 | `refactor(example): scheduling adopts the privacy ports of the kit` | the erasure steps of part 0b replaced by `personalFields` and `PersonalDataErasure`, `erase:patient` by `privacy:erase`, the handler of `privacy.data-subject.erased` in `notification`; the spec of part 0b stays and proves the equivalence | 3, 4, 6 | S |
| 12 | `docs: the privacy pages and the public wording` | `docs/concepts/personal-data.md` (a new concept page, on the reading path before production), the event sourcing, audit trail, file storage and multitenancy pages, the README (a feature line and a frame on what the tool does not decide), the skills | everything | M |

Merge order: 0, 0b, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12. Parts 2 and 8 can start beside 1
and 3. Part 0b makes the erasure true in the example at the second merge rather than the
twelfth, at the price of code written twice, by hand then through the ports: that is how the
kit has grown so far, and `eraseDataSubject` itself lives in the example before it moves to the
kernel. A minor version after part 6 (the ports and the platform folder), another after part 10
(the rules as warnings), and the error on the rules one minor version later.

## What is not proposed

- **A `privacy` context.** [Which contexts deserve a preset](context-presets.md#personal-data-requests-a-guide)
  settled it: requests on personal data cross every context, and a context that answered them
  alone would have to read everyone's tables. A capability of the platform, like the audit
  trail and the files.
- **Encryption per person of the columns kept as rows.** Crypto-shredding of a table breaks its
  indexes, its searches and its unique constraints; deleting or pseudonymising the row is the
  common practice, and the backups stay the bound, as they are today for the keys.
- **Consent, a banner, a privacy notice.** Out of the reach of a back-end kit.

## What a tool cannot guarantee, and the words to use

A kit can guarantee mechanisms and their presence: every declared personal field is erasable,
exportable, dated and inventoried; an undeclared one of the known vocabulary is reported; an
erasure leaves a proof. It cannot guarantee:

- the **lawful basis** of each processing (article 6), nor its **purpose**;
- the **information of the data subjects** (articles 12 to 14), **consent** and its withdrawal;
- the **processors** and the **transfers** (articles 28 and 44 onwards): the host, a managed
  broker, an email service;
- the **impact assessment** (article 35), the data protection officer, the **notification of a
  breach** (article 33);
- that a declaration is **complete**: a rule reads the name of a column, not what a text field
  may contain; a `notes` column may hold a diagnosis;
- the **backups** and the **retention of the broker**: the bound of an erasure is a date, never
  an instant;
- the **legal standing** of a pseudonymisation rather than a deletion, which the controller
  decides, as the audit trail page already says of what stays in the chain.

The wording that follows from it, for the README and for whatever presents the kit:

- Say "**the mechanisms of compliance, by construction**" or "**privacy by design, with the
  tooling**", never "compliance by construction" alone, which reads as a legal guarantee.
- On the right to erasure: "**Erasable by construction.** Every personal field is declared; one
  command erases a person from the tables, the events and the copies of the other contexts, and
  leaves a dated proof." Until parts 0b to 11 are merged, add "for the aggregates kept as
  events, and in the example".
- A frame under the features of the README: "**What the kit does not decide.** The kit provides
  the technical measures of privacy by design (GDPR article 25): declaration, erasure, export,
  retention, a register and a dated proof. The lawful basis of each processing, the information
  of the data subjects, the processors and the impact assessment are the project's own; a rule
  reads a column name, not what a text field may contain. By construction means built in by
  default, never a legal guarantee."

## Not decided

- Whether `erasure: 'pseudonymise'` should be the default of a generated declaration rather
  than `'row'`: a deleted row breaks the foreign keys of what referenced the person, a
  pseudonymised one keeps the history readable without the person. The first adapter will tell.
- Whether the export of a person should be one use case of the platform that calls every
  `PersonalDataExport`, or an integration event `privacy.data-subject.export-requested` that each
  context answers with a file, as the erasure does. Settled for the monolith with part 5: the
  first form, `exportDataSubject` run by `privacy:export`, every export audited; the second stays
  for a context extracted into a service of its own.
- Whether the vocabulary of `privacy/declared-field` should be a list of the kit at all, or a
  list the project writes in full: a list of the kit reports `email` in a project that never
  thought about it, which is the point, and reports it too in a column that holds a system
  address, which is a deviation to record.

## Sources

- Regulation (EU) 2016/679 (GDPR), articles 5, 6, 12 to 14, 15, 17, 19, 20, 25, 28, 30, 32,
  33 and 35: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>.
- Mathias Verraes and others on forgettable payloads and crypto-shredding in event stores, as
  cited by [Event sourcing](../concepts/event-sourcing.md#sources).

## See also

- [Event sourcing, per aggregate](../concepts/event-sourcing.md): what the sealing does today
- [Audit trail](../concepts/audit-trail.md): the chain, the masks and the proof of an erasure
- [File storage](../concepts/file-storage.md), [Multitenancy](../concepts/multitenancy.md)
- [Which contexts deserve a preset](context-presets.md): why no `privacy` context
