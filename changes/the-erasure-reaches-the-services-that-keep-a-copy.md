**An erasure now reaches beyond the database the platform holds: `privacy:erase` announces
`privacy.data-subject.erased` through the outbox once every copy is erased, `generate
erasure-handler <context>` writes the idempotent handler of a context that erases its own copy, and
an integration event says which fields of its payload are personal, and whose.** The event is
`dataSubjectErasedV1` of `@ddd-ts-kit/kernel`, version 1, `{ subjectId, erasedAt, requestedBy }`:
identifiers only, a name or an email refused at `create` (`InvalidDataSubjectErasedError`). It lives
in the kernel because the application layer of every context handles it, and it is shaped as a
definition of `@ddd-ts-kit/events`, so that the registry, the catalog, AsyncAPI, `on`, `consume`,
`@IntegrationEventHandler` and the container take it as any other. A generated project with
`--privacy on` publishes it at the end of `runErasure`, once per tenant with shared tables, never
after a failed erasure, and lists it in its event catalog and AsyncAPI document with the contexts
that consume it. `generate erasure-handler <context>` writes
`application/integration/handlers/data-subject-erased.integration-handler.ts` over the
`<Context>PersonalDataErasure` of the context, its spec on the fake, and its subscription under the
consumer name `<context>.data-subject-erased`: the decorator in the declared style, the module file
of an explicit context, the hand-wired platform with the adapter wrapped as any other (in a
transaction behind a broker); it refuses a context that has no erasure yet. `defineIntegrationEvent`
takes `personal: { subject, fields }`, checked against the fields the payload schema documents (no
field, a field twice, a personal subject or an unknown path is refused), written by the catalog
under the payload and by AsyncAPI as `x-personal-data` on the message. The events, kernel and CLI
READMEs, the concept page and its diagram, the proposal and the persistence and integration event
skills say it, in English and in French.
