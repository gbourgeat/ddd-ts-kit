# ADR-0002: Keep read models with projections in application/projections

- Status: accepted
- Date: 2026-10-10
- Deviates from: `contexts.scheduling.extraDirectories.application/projections`, `contexts.notification.extraDirectories.application/projections`, `contexts.analytics.extraDirectories.application/projections`

## Context

Three contexts keep read models up to date from events: `scheduling` (practitioners known from `identity`, the agenda from its own events), `notification` (contacts) and `analytics` (outcomes and occupancy). The kernel gives this a role of its own, `@Projection`, whose README places it in `application/projections/*.projection.ts`. The architecture reference lists a closed tree per context in which that directory does not appear, the checker refuses it (`tree/closed`), and the generated barrel leaves the classes out.

## Decision

Projections live in `application/projections/` of the three contexts, declared as an extra directory in the configuration, and the composition root adds them to the module of their context by name.

## Consequences

A read model is written by one named class that the kit makes idempotent and ordered, instead of several integration event handlers each sending a command. The barrel does not list these classes: a projection that is not named in `src/platform/compose-application.ts` is silently not subscribed, so the end-to-end specs of each read model are what proves the wiring. `ddd-ts-kit docs` does not list projections in `CONTEXT.md`.

## Alternatives considered

Integration event handlers sending commands to an aggregate that is a read model (the supported form): more files, hand-written idempotency and ordering, and no rebuild. Putting the projection files in `application/integration/handlers/` under another suffix: the role check refuses a class without the decorator of the directory.

## Scope

The directory `application/projections/` of `scheduling`, `notification` and `analytics`, and nothing else: files named `*.projection.ts` holding one class declared with `@Projection`. The rule is `tree/closed`.

## Removal condition

The checker and the barrel know `application/projections/`: the three `extraDirectories` entries and the explicit registration in the composition root are then deleted. Checked at each upgrade of the kit by whoever upgrades it.
