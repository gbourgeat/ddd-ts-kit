**English** · [Français](identity.fr.md)

# Briefing: identity

You build the bounded context `identity` of the scheduling example. Worker name: `identity`.

Scope
- You may write: `src/contexts/identity/**` and `test/e2e/identity-*.e2e.spec.ts`.
- Generators you may run: value-object, entity, domain-event, error, domain-service,
  command, query, route, port, adapter, event-handler, builder, e2e.

Slices, in this order (rows of `docs/architecture/slices.md`, rules below its table): 11, 12, 13,
14, 15, 16, 17. Aggregates `Person`, `Practice` (its members are part of it) and `Delegation`
exist with their repositories; the integration events of row 4 exist with their payloads decided
(read-only for you: `src/contexts/identity/published-language/*.payload.ts`; fill their
publishers and the domain events behind them). `ExpireDelegations` and its job exist, unfilled.

Contracts you own and must honour: the payloads above, and `PersonDirectoryContract`
(`published-language/person-directory.contract.ts`), which `scheduling` calls through a gateway:
give it an implementation that reads your tables, find the form the checker accepts, and say in
your report what the conductor must bind in `src/platform/platform.module.ts`.

Done when: every slice is built and tested (domain, handlers, adapters, routes), no marker is
left in your context, eslint, vitest and check are clean on your folder. Follow
`docs/architecture/briefings/README.md` for the common rules and the report.
