**English** · [Français](deploy-and-rollback.fr.md)

# Deploy and rollback

**Summary.** The kit stops at the image: the pipeline builds it and pushes nothing. This page says
what a ddd-ts-kit project ships beyond that image (the migrations, the outbox relay, the workers,
the readiness route, the OpenTelemetry export), in which order a release goes out, what a
rollback of each piece means, and how a coding agent takes part: three tiers of autonomy mapped
on the environments, deploy, status and rollback as one script each, a gate before production,
and a rollback rehearsed in staging before anything needs it. It follows the deploy stage of the
[AI-native SDLC playbook of Anthropic](https://cdn.prod.website-files.com/6889473510b50328dbb70ae6/6aba736348bdf4f08183f463_AI%20Native%20SDLC%20Playbook_designv2%20(1).pdf),
read against what the kit writes. The kit ships no deployment tool and no MCP server: the scripts
of this page are the project's, and the page says so where it matters.

## What a project ships

| Piece | Written by | What it is |
|---|---|---|
| the image | the `Dockerfile` of `init` | a multi-stage build: `npm ci`, `npm run build` (the aliases of `dist/` rewritten for Node), then a `node:26-slim` stage with the production dependencies only, run as `node`, on port 3000. `ENTRY` (a build argument, `dist/src/main.js` by default) chooses the process: `dist/src/apps/worker/main.js` for the worker, `dist/src/apps/<context>/main.js` for one context run alone. One image, several processes |
| the migrations | `npm run db:generate <what-it-does>` | `migrations/` (`prisma/migrations/` on Prisma), applied by `npm run db:migrate` against the target database, as a step of the release and never at the start of the process |
| the API | `src/main.ts` | the HTTP server, the buses, the consumers of integration events and, with `--events outbox`, the outbox relay (`startOutboxRelay`, every `OUTBOX_RELAY_INTERVAL_MS`): the events a command stored are published by this process |
| the worker | `npx ddd-ts-kit generate worker` | `src/apps/worker/main.ts`: the same modules without the HTTP server, the jobs by time started whatever `RUN_JOBS` says, and `RUN_JOBS=false` by default for the API. It runs no outbox relay: the events its commands store are relayed by the API |
| a context as a service | `npx ddd-ts-kit generate service <context>` | `src/apps/<context>/main.ts`, its jobs with it and out of the whole application, none of the platform: the same image with another `ENTRY`, the same `DEPLOYMENT_NAME` in every container ([when to extract microservices](when-to-extract-microservices.md)) |
| the readiness route | the HTTP start of `src/platform/http/`, with `--cache redis` only | `GET /health/ready` answers 200 when Redis is reachable and 503 otherwise, before the rate limiter and every route. Without Redis the kit writes no health route: a platform that probes one needs a route the project adds. No liveness route is written |
| the OpenTelemetry export | `src/platform/observability/` | spans to `OTEL_EXPORTER_OTLP_ENDPOINT` (none leaves the process when it is unset), `TRACE_SAMPLE_RATIO`, and the metrics of every use case and every adapter call, `use_case_*` and `dependency_call_*`, which reach the `Metrics` port of the kernel: `createMetrics()` answers a no-op adapter until the `TODO(platform)` of `create-metrics.ts` binds OpenTelemetry or Prometheus, so nothing is measured before then. No gauge of the outbox or the jobs is emitted: the depth of the outbox is `store.stats()` or the SQL of [closing the loop](closing-the-loop.md) ([observability](../concepts/observability.md)) |
| the configuration | `src/platform/config/` | environment variables read once at start (`.env.example`, at the root of the project, lists them): a wrong one stops the process before it listens, not at the first request. Behind a load balancer, `TRUST_PROXY` names the proxies believed when they give the caller in `X-Forwarded-For` (a number of hops, or their addresses); left out, none is, and every caller shares the address of the balancer, and one window of the rate limit |

`docker-compose.yml` and `npm run infra:up` are the local infrastructure of a developer, not a
deployment.

## The order of a release

1. **Migrate, forward compatibly.** A migration of a release adds: a table, a column with a
   default, an index. It renames or drops nothing the version still running reads, so that the
   old process and the new one run on the same schema during the switch. A contraction (the drop
   of a column nothing reads any more) is a migration of a later release. A stored event changes
   shape only by a new version with its upcaster (`stored-events.lock.json`,
   `event-sourcing/upcaster-required`): the release that reads the new version goes out before
   the one that writes it.
2. **Deploy the image**, one instance at a time: the API, then the worker and the services, all
   from the same tag. Where the readiness route exists, the platform sends traffic to an instance
   once it answers 200. Two versions run side by side for the length of the roll: both accept the
   schema of step 1, and the consumer of an integration event tolerates the payload of the
   version before and the version after, as the [team workflow](team-workflow.md) requires.
3. **Relay.** The rows of the outbox written by the old process are published by the new one:
   the relay reads them in order and marks each one sent, and a consumer is idempotent
   (`events/consumer-idempotent`). Nothing is lost in the switch, and a delivery repeated by the
   switch is harmless.

| Step | Command | Exits non-zero when |
|---|---|---|
| migrate | `npm run db:migrate` with `DATABASE_URL` of the target | a migration fails: nothing is deployed |
| deploy | the platform's: the image tag of the pipeline run that built it | an instance never answers ready |
| status | the readiness route, the outbox depth (`store.stats()`, or the SQL of [closing the loop](closing-the-loop.md)) and, once a `Metrics` adapter is bound, the `use_case_*` error rate of the new version | a value is out of its band |

## What a rollback of each piece means

| Piece | A rollback is | Needs |
|---|---|---|
| the image | the previous tag deployed again, the same way | nothing else when the migration was additive |
| an additive migration | none: the old process ignores the column or the table it does not know | nothing |
| a contraction | never rolled back: a dropped column is gone. The fix is a forward release | the contraction kept one release behind the code that stops reading |
| the outbox | nothing: the rows the rolled-back version wrote are relayed by the version that runs after it, in the same format | the payload of an event published by the new version read by the consumers of the old one: the tolerance of step 2 |
| a consumer | the previous handler, which reads the version of the event it knows | the producer's new version published next to the old one, never in its place ([event versioning](../concepts/event-versioning.md)) |
| the jobs | nothing: a job sends one command, idempotent by construction; a period run twice during the switch is harmless | |
| the stored events | the previous reader, which must know every version already stored | the upcaster deployed one release before the writer, as step 1 says |
| the audit trail | nothing: the chain records what ran, including what the rolled-back version did | |

`knex migrate:rollback` and its equivalents exist and are for a developer's database: on a
target, a destructive step is never run backwards.

## Three tiers of autonomy, on the environments

The playbook tiers what an agent may do by environment. On a ddd-ts-kit project:

| Environment | The agent | Who authorises | Held by |
|---|---|---|---|
| development (a developer's compose, a preview environment per branch) | deploys, reads the status and rolls back on its own | nobody: the environment is disposable | the `allow` list of `.claude/settings.json` |
| staging | deploys and reads the status; rehearses the rollback (below); writes what it saw in the report of its story | a person reads the report before the production release | the `allow` list, narrowed to the staging scripts |
| production | prepares: the tag, the migration plan, the status it expects, the rollback it rehearsed; runs nothing | a person, by name, with a change id | `.claude/hooks/production-gate.mjs`, written by `init --agent-profile regulated`: a command that names the production environment is blocked unless `RELEASE_APPROVAL` names an approver and a change id, and the refusal says who may set it |

The gate is a hook of Claude Code; Codex and Copilot do not run it. There, the production scripts
stay out of every allow list, and the platform's own authorisation (a protected environment, an
approval step) is the gate.

## Deploy, status and rollback as one script each

The project writes three scripts, which the kit does not generate because they depend on the
platform: `scripts/deploy.sh <environment> <tag>`, `scripts/status.sh <environment>`,
`scripts/rollback.sh <environment>`. Each one prints one line per step, exits non-zero on the
first failure, and can be run twice (a second deploy of the same tag changes nothing). The
rollback script is the deploy of the previous tag plus the status: nothing a person would not
type.

An agent reaches them one way or the other, never both:

- **through an MCP server of the platform team**, which exposes `deploy`, `status` and
  `rollback` as tools scoped per environment and holds the credentials: the agent never sees a
  token, the server logs every call, and the production tool checks the approval itself;
- **through the `allow` list** of `.claude/settings.json`, as `init` writes the inner loop:
  `Bash(scripts/status.sh *)`, `Bash(scripts/deploy.sh staging *)`,
  `Bash(scripts/rollback.sh staging *)`, with the credentials in the environment of the session
  and the production scripts absent from the list.

Two routes would mean two audits and two sets of credentials; the one the team chooses is the one
the hook above guards. The [sandbox guide](agent-sandbox.md) says which of these runs inside the
sandbox of the agent (the shell) and which outside it (an MCP server).

## The rehearsal

A rollback that was never run is not a rollback. In staging, on a schedule (a weekly job of the
platform, or of the pipeline with its credentials), the previous tag is deployed over the current
one, the status is read, then the current tag is deployed again, and the two status lines are
kept. The same script, the same tag format and the same status as production, so that
[closing the loop](closing-the-loop.md) can call it when a detection fires, by an agent in staging
and by a person with the approval in production.

## The pipeline's part

The pipeline builds the image and pushes nothing: pushing the tag and deploying it belong to the
platform, after the `gate` job. When a run fails, the `claude-triage` extra
(`init --ci-extras claude-triage`, [the pipeline](../../pipeline/README.md#free-by-default-paid-on-request))
is the read-only first step the playbook recommends: three lines on the pull request, the most
likely cause, flaky or real, what to do; it reruns nothing and changes nothing.

## What the kit does not do

- No deployment tool, no MCP server, no platform API: the three scripts and the server that
  exposes them are the project's and the platform team's.
- No health route without Redis, and no liveness route: a platform that probes one gets a route
  the project adds in `src/platform/http/`.
- No orchestration of a blue-green or a canary release: the order above is what the pieces
  need, whatever the platform does with it.
- `ddd-ts-kit measures` reads the lifecycle of a story from git and the files of
  `docs/architecture/`; the time to deploy and the failure rate of a release come from the
  platform, not from the kit.

## See also

- [Team workflow](team-workflow.md): the consumer that tolerates both worlds, the order of a
  cross-context change
- [Event versioning](../concepts/event-versioning.md), [Observability](../concepts/observability.md)
- [When to extract microservices](when-to-extract-microservices.md): one context as a service
- [Sandboxing coding agents](agent-sandbox.md): what runs inside the sandbox of the agent
- [Which command, when](commands.md#release-and-deploy): the commands of a release
