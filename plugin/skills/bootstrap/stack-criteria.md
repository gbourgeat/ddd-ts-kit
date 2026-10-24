# Stack criteria

Every choice has a default that works. Change one only for a reason found in the needs, the
strategic artefacts or the existing code, and write that reason down. Flags and values:
`npx ddd-ts-kit init --help`.

## Inferred, not asked

| Flag | Infer from | Default |
|---|---|---|
| `--http` | a framework already in `package.json`; `none` when the system exposes no API | `express` |
| `--validation` | a library already in `package.json`; `class-validator` with NestJS habits | `zod` |
| `--di` | `nest` with `--http nest` and only then; `manual` only on request | `tsyringe` |
| `--style`, `--assembly` | `declared` with `tsyringe` (no module file to maintain); `explicit` otherwise | `declared`, `barrel` |
| `--tests` | a runner already configured | `vitest` |
| `--orm`, `--database` | an ORM already in `package.json`; `none` only when nothing is stored | `drizzle`, `postgres` |
| `--events` | never chosen: `outbox` as soon as there is an ORM (`in-memory` with one needs `--allow-no-outbox "<reason>"`, a recorded deviation) | `outbox` |
| `--audit` | `on` with an ORM; `off` needs the owner to say nobody will ever ask who did what | `on` |
| `--event-sourcing` | `on` only when an aggregate will be kept as its events (a history to replay, every change kept); the generator refuses `--event-sourced` without it | `off` |
| `--privacy` | `on` with an ORM: the requests of a data subject (erasure, export) answered from the platform; `off` when the owner says the system keeps nothing about a person | `on` |
| `--docs-ui` | taste | `swagger` |
| `--logger` | `pino` or `winston` when the team already runs one; both are adapters of the kernel `Logger` | `stdout` |
| `--errors` | `sentry` when a Sentry or a GlitchTip receives the incidents | `none` |
| `--ci` | the host of `git remote get-url origin` | `github` |

## Asked, when the artefacts do not answer

Ask in one batch, each with the recommended value and what it costs to change later.

| Question | Flag | Criteria |
|---|---|---|
| Who authenticates users? | `--authn` | `jwt`: any OpenID Connect issuer already in place. `keycloak`: self-hosted identity, a local realm comes with it. `none`: no user at all, or a prototype; refused in production. |
| How are rights decided? | `--authz` | `rbac`: rights follow job functions. `abac`: rights depend on attributes (amount, department, time). `rebac`: rights follow relations (owner, member, shared with). Look at the actors and the read models of the discovery: "sees only their own" points to `rebac` or `abac`. Changing later replaces an adapter, not the handlers. |
| One process, or several from day one? | `--broker`, `--cache` | One process: `none`, `none`; the in-memory bus and the outbox are enough, and contexts stay extractable. Several instances: `--cache redis` (shared lock for jobs, rate limiter, relay wake-up). A context deployed alone, or outside consumers: a broker. |
| Which broker? (only if one is needed) | `--broker` | `rabbitmq`: work queues and routing, the usual default. `kafka`: ordered log, replay, high volume. `nats`: light and fast. `redis`: a Redis is already there. A broker needs an ORM: it is reached through the outbox. |

## Not flags

Decided after the bootstrap, as adapters bound in `src/platform/` (skill
`ddd-ts-kit:cross-cutting`): metrics and the tracing backend (an OTLP endpoint in the
environment). A dedicated process for scheduled jobs is `npx ddd-ts-kit generate worker`,
when the first job exists.

## What a choice must satisfy

- maintained, on its current stable or long-term-support version, widely used;
- operable by the team that will run it (one more server is one more thing to keep alive);
- reversible: everything sits behind a port, so say what replacing it would touch.

A choice outside the supported values (`custom` ORM, broker or authorizer) is an adapter to
write and hold to the contract suite, and a decision record in `docs/adr/`.
