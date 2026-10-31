# End to end

Read when writing an end-to-end spec, or a use case no route reaches.

`npx ddd-ts-kit generate e2e <ctx> <UseCase>` writes the three baseline cases of a route:
401 without a credential, 403 without the permission, the documented status with it. Add
the business scenario; assert what a client observes (responses, published events), never
the database. What happens after the answer (the outbox relayed, the handlers it reaches) is
asserted once `await application.settled()` has resolved, never after a fixed delay: it fails
naming what is still pending. An outside system that answers nowhere in a test run is answered by its fake, bound in `contextsOfTheRun()` of `test/e2e/support/start-application.ts` (the identity preset binds `FakeIdentityProviderAdmin` there); without it the outbox retries and `settled()` fails. A use case no route reaches, sent by an integration event
handler, gets the same command: its spec publishes the upstream event, built from its
declaration, with `await application.publish([event])`, then awaits `settled()`; pass
`--event <eventType>` when handlers of several events send it. A use case only a job
(`generate job`) starts gets `await application.runJob('<context>.<job>')` instead, then
`settled()`. `runJob` throws on a per-tenant job that reached no tenant (`JobRun.tenants` is `0`):
open a tenant first (an organisation), after `reset()`. On an ORM, each spec opens a copy of the PostgreSQL
cluster a global setup initialised once per run (`test/support/test-database-template.ts`), and
creates its tables there.

A spec past 350 lines (`clean/file-size`) is split by behaviour into parts named after it:
`test/e2e/place-order-refusals.e2e.spec.ts` beside `test/e2e/place-order.e2e.spec.ts`. With a
journey across use cases, `test/e2e/journey-<name>.e2e.spec.ts`, it is the only end-to-end spec
the guard lets you create by hand. What the specs of one context share (signing a person in, a
world) goes in `test/e2e/support/<context>/`, never copied into each spec.
