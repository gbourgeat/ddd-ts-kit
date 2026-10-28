**The end-to-end support binds the fake identity provider admin once the identity preset is written.**
Opening an organisation queues `identity.organisation.opened` and `identity.member.joined`, whose
handlers call the identity provider admin; in a test run no provider answers, so the outbox retried
for ever and `settled()` failed (`outbox: 2 (2 failed, waiting for a retry)`) in every spec that opens
an organisation. `test/e2e/support/start-application.ts` now composes the contexts through
`contextsOfTheRun()`, the place where the fake of an outside system is bound, and the identity preset
(with `init --preset identity` or `generate context identity --preset identity`) binds
`FakeIdentityProviderAdmin` there. In the explicit style, `identityModule(platform, outside)` takes
the adapters a test run replaces.

To move: in a project written before, bind the fake yourself in `contextsOfTheRun()`; the support
of an existing project is not rewritten.
