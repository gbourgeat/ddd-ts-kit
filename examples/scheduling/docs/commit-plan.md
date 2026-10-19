**English** · [Français](commit-plan.fr.md)

# Commit plan

For the lead, who commits: the build ran without git (several workers on one tree), so the
history is cut afterwards. Paths are relative to the root of the repository. Messages follow the
kit's commit discipline: conventional, scope = the bounded context, `platform` or `example`,
header of at most 100 characters.

## What this plan can and cannot promise

- **Order.** The order is the one the method prescribes: root changes, strategic artefacts,
  bootstrap, platform, then per context its language, its contracts, its concepts and its use
  cases, then what proves the whole.
- **Size.** The target is 20 files and 600 changed lines per commit, generated documents not
  counted. Commits over the target say so. They are over for three reasons: a bootstrap is one
  command (93 files); an aggregate written by a worker as one file carries the behaviour of
  several use cases (the `Calendar`, the `Appointment`); a use case commit carries its specs,
  which are longer than its code.
- **Compiling at every commit: not feasible, and not claimed.** Files that generators update
  at each run (the barrel `<context>.declarations.ts`, the permissions, the route list,
  `CONTEXT.md`, the tables of a context, the composition files of the platform) exist here only
  in their final state, and go in the first commit that needs them: they name classes that
  later commits bring. The project compiles and `npm run verify` is green at these points only:
  after commit 1 (the kit's repository, untouched by the example), and after the last commit.
  A history green at every commit needs the generators run in a worktree per slice, which is
  what the kit's `parallel-work` skill prescribes and what this build could not do without git.
- **Tangled files.** When two slices share a file (an aggregate, the table of a context), the
  file is in the first commit that needs it, whole, as the commit discipline says.
- The last entries of each context named "remaining files" hold what no rule claimed: read
  their list before committing.

Before committing: `npm run check:dashes` and `npm run example:verify` at the root.

## Commits

### 1. `chore(example): add the example workspace to the repository`

Root changes only, in their own commit.

```text
package.json
package-lock.json
eslint.config.mjs
knip.json
.github/workflows/ci.yml
.gitlab-ci.yml
examples/README.md
```

### 2. `chore(example): bootstrap the project with one init command`

93 files, 92 counted, 4194 lines counted (over the target). Everything `init` and `generate worker` wrote, with the hand fixes the workspace needed (scripts/tsc.mjs, scripts/kit.mjs, .dependency-cruiser.workspace.mjs, docker-compose.yml, the realm) and the composition files of src/platform in their final state.

```text
examples/scheduling/.claude/rules/application.md
examples/scheduling/.claude/rules/domain.md
examples/scheduling/.claude/rules/infrastructure.md
examples/scheduling/.claude/rules/platform.md
examples/scheduling/.claude/rules/presentation.md
examples/scheduling/.claude/rules/published-language.md
examples/scheduling/.claude/rules/tests.md
examples/scheduling/.claude/settings.json
examples/scheduling/.dependency-cruiser.cjs
examples/scheduling/.dependency-cruiser.workspace.mjs
examples/scheduling/.dockerignore
examples/scheduling/.env.example
examples/scheduling/.github/branch-protection.md
examples/scheduling/.github/dependabot.yml
examples/scheduling/.github/workflows/ci.yml
examples/scheduling/.github/workflows/codeql.yml
examples/scheduling/.github/workflows/pr-title.yml
examples/scheduling/.gitignore
examples/scheduling/.gitlab-ci.yml
examples/scheduling/.gitlab/merge-request-settings.md
examples/scheduling/CLAUDE.md
examples/scheduling/Dockerfile
examples/scheduling/commitlint.config.mjs
examples/scheduling/ddd-ts-kit.config.json
examples/scheduling/docker-compose.yml
examples/scheduling/docker/keycloak/scheduling-realm.json
examples/scheduling/eslint.config.mjs
examples/scheduling/knexfile.js
examples/scheduling/knip.json
examples/scheduling/lefthook.yml
examples/scheduling/migrations/0001_initial.js
examples/scheduling/package.json
examples/scheduling/renovate.json
examples/scheduling/scripts/events.ts
examples/scheduling/scripts/gen.mjs
examples/scheduling/scripts/kit.mjs
examples/scheduling/scripts/openapi.ts
examples/scheduling/scripts/tsc.mjs
examples/scheduling/src/apps/worker/main.ts
examples/scheduling/src/main.ts
examples/scheduling/src/platform/audit/audit.module.ts
examples/scheduling/src/platform/audit/audit.permissions.ts
examples/scheduling/src/platform/audit/audited-events.ts
examples/scheduling/src/platform/audit/create-audit.ts
examples/scheduling/src/platform/audit/list-audit-entries.handler.ts
examples/scheduling/src/platform/audit/list-audit-entries.query.ts
examples/scheduling/src/platform/audit/list-audit-entries.route.ts
examples/scheduling/src/platform/buses/create-command-bus.ts
examples/scheduling/src/platform/buses/create-query-bus.ts
examples/scheduling/src/platform/composition/compose-application.ts
examples/scheduling/src/platform/config/app-config.ts
examples/scheduling/src/platform/config/config-error.ts
examples/scheduling/src/platform/config/load-config.ts
examples/scheduling/src/platform/config/read-tracing.ts
examples/scheduling/src/platform/database/connect-to-database.ts
examples/scheduling/src/platform/database/inert-persistence.ts
examples/scheduling/src/platform/database/open-persistence.ts
examples/scheduling/src/platform/database/open-test-database.ts
examples/scheduling/src/platform/database/persistence-over.ts
examples/scheduling/src/platform/database/persistence.ts
examples/scheduling/src/platform/database/schema.ts
examples/scheduling/src/platform/observability/errors.ts
examples/scheduling/src/platform/events/create-event-provider.ts
examples/scheduling/src/platform/events/event-provider.ts
examples/scheduling/src/platform/events/in-process-events.ts
examples/scheduling/src/platform/events/start-outbox-relay.ts
examples/scheduling/src/platform/http/error-statuses.ts
examples/scheduling/src/platform/http/refusal-for.ts
examples/scheduling/src/platform/http/start-http-server.ts
examples/scheduling/src/platform/http/with-documentation.ts
examples/scheduling/src/platform/jobs/job-settings.ts
examples/scheduling/src/platform/composition/lay-foundations.ts
examples/scheduling/src/platform/observability/create-logger.ts
examples/scheduling/src/platform/observability/create-metrics.ts
examples/scheduling/src/platform/composition/platform-test.module.ts
examples/scheduling/src/platform/composition/platform.module.ts
examples/scheduling/src/platform/redis/open-redis.ts
examples/scheduling/src/platform/resilience/adapter-aspects.ts
examples/scheduling/src/platform/resilience/default-resilience.ts
examples/scheduling/src/platform/resilience/own-policy.ts
examples/scheduling/src/platform/resilience/resilience-settings.ts
examples/scheduling/src/platform/resilience/self-governed.ts
examples/scheduling/src/platform/observability/tracing.ts
examples/scheduling/test/architecture/extractable.spec.ts
examples/scheduling/test/e2e/support/auth-environment.ts
examples/scheduling/test/e2e/support/create-credentials.ts
examples/scheduling/test/e2e/support/start-application.ts
examples/scheduling/test/e2e/support/story-of.ts
examples/scheduling/test/e2e/support/test-environment.ts
examples/scheduling/tsconfig.build.json
examples/scheduling/tsconfig.json
examples/scheduling/vitest.config.ts
examples/scheduling/vitest.e2e.config.ts
```

### 3. `docs(example): state the needs and discover the domain`

2 files, 2 counted, 148 lines counted.

```text
examples/scheduling/docs/architecture/discovery.md
examples/scheduling/docs/architecture/needs.md
```

### 4. `docs(example): find the bounded contexts, their language and their map`

4 files, 4 counted, 167 lines counted.

```text
examples/scheduling/docs/architecture/before-bootstrap/README.md
examples/scheduling/docs/architecture/before-bootstrap/context-map.md
examples/scheduling/docs/architecture/before-bootstrap/glossary.md
examples/scheduling/docs/architecture/contexts.md
```

### 5. `feat(platform): keep relation tuples in PostgreSQL and combine roles with relationships`

27 files, 27 counted, 820 lines counted (over the target). The generated files of src/platform/auth are in this commit in their final, rewired state.

```text
examples/scheduling/docs/adr/0001-combine-token-roles-with-relationships-in-one-authorizer.md
examples/scheduling/src/platform/auth/authorization/access-policies.ts
examples/scheduling/src/platform/auth/authorization/authorization.ts
examples/scheduling/src/platform/auth/authentication/create-authenticator.ts
examples/scheduling/src/platform/auth/authorization/create-authorizer.ts
examples/scheduling/src/platform/auth/relationships/create-relation-tuple-tables.ts
examples/scheduling/src/platform/auth/relationships/create-tuple-store.ts
examples/scheduling/src/platform/auth/authentication/http-boundary.ts
examples/scheduling/src/platform/auth/relationships/knex-relation-tuple-store.contract.spec.ts
examples/scheduling/src/platform/auth/relationships/knex-relation-tuple-store.spec.ts
examples/scheduling/src/platform/auth/relationships/knex-relation-tuple-store.ts
examples/scheduling/src/platform/auth/authentication/offline-authenticator.ts
examples/scheduling/src/platform/auth/relationships/permission-mapping.ts
examples/scheduling/src/platform/auth/authorization/permissions.ts
examples/scheduling/src/platform/auth/authentication/principal-of.ts
examples/scheduling/src/platform/auth/relationships/relate-system-actors.ts
examples/scheduling/src/platform/auth/relationships/relation-tuples-table.ts
examples/scheduling/src/platform/auth/relationships/relationship-schema.ts
examples/scheduling/src/platform/auth/relationships/resource-of.ts
examples/scheduling/src/platform/auth/relationships/resource-permissions.ts
examples/scheduling/src/platform/auth/authorization/role-grant.ts
examples/scheduling/src/platform/auth/authorization/role-grants.ts
examples/scheduling/src/platform/auth/authorization/roles-and-relationships.authorizer.spec.ts
examples/scheduling/src/platform/auth/authorization/roles-and-relationships.authorizer.ts
examples/scheduling/src/platform/auth/authentication/security-schemes.ts
examples/scheduling/src/platform/buses/read-only-impersonation.spec.ts
examples/scheduling/src/platform/buses/read-only-impersonation.ts
```

### 6. `docs(example): plan the slices and brief the workers`

8 files, 8 counted, 389 lines counted.

```text
examples/scheduling/docs/architecture/briefings/README.md
examples/scheduling/docs/architecture/briefings/analytics.md
examples/scheduling/docs/architecture/briefings/identity.md
examples/scheduling/docs/architecture/briefings/notification.md
examples/scheduling/docs/architecture/briefings/scheduling-appointment.md
examples/scheduling/docs/architecture/briefings/scheduling-calendar.md
examples/scheduling/docs/architecture/plan.md
examples/scheduling/docs/architecture/slices.md
```

### 7. `feat(example): share the stamp read models can store`

3 files, 3 counted, 52 lines counted. Workaround of a defect of @ddd-ts-kit/knex; used by the projections of three contexts, so it comes before them.

```text
examples/scheduling/src/shared-kernel/.gitkeep
examples/scheduling/src/shared-kernel/storable-stamp.spec.ts
examples/scheduling/src/shared-kernel/storable-stamp.ts
```

### 8. `docs(example): record the projections directory as a decision`

1 files, 1 counted, 29 lines counted.

```text
examples/scheduling/docs/adr/0002-keep-read-models-with-projections-in-application-projections.md
```

### 9. `feat(identity): declare the context and its language`

7 files, 6 counted, 243 lines counted.

```text
examples/scheduling/src/contexts/identity/CONTEXT.md
examples/scheduling/src/contexts/identity/application/authorization/identity.permissions.ts
examples/scheduling/src/contexts/identity/identity.declarations.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/create-identity-tables.schema.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/identity.schema.ts
examples/scheduling/src/contexts/identity/presentation/http/identity.routes.ts
examples/scheduling/src/contexts/identity/published-language/index.ts
```

### 10. `feat(identity): publish what happens to people, practices and delegations`

44 files, 44 counted, 853 lines counted (over the target).

```text
examples/scheduling/src/contexts/identity/application/integration/publishers/delegation-granted.publisher.ts
examples/scheduling/src/contexts/identity/application/integration/publishers/delegation-revoked.publisher.ts
examples/scheduling/src/contexts/identity/application/integration/publishers/person-registered.publisher.ts
examples/scheduling/src/contexts/identity/application/integration/publishers/practice-member-added.publisher.ts
examples/scheduling/src/contexts/identity/application/integration/publishers/practice-member-removed.publisher.ts
examples/scheduling/src/contexts/identity/application/integration/publishers/practice-opened.publisher.ts
examples/scheduling/src/contexts/identity/domain/events/delegation-granted.event.ts
examples/scheduling/src/contexts/identity/domain/events/delegation-revoked.event.ts
examples/scheduling/src/contexts/identity/domain/events/person-registered.event.ts
examples/scheduling/src/contexts/identity/domain/events/practice-member-added.event.ts
examples/scheduling/src/contexts/identity/domain/events/practice-member-removed.event.ts
examples/scheduling/src/contexts/identity/domain/events/practice-opened.event.ts
examples/scheduling/src/contexts/identity/published-language/delegation-granted.v1.integration-event.ts
examples/scheduling/src/contexts/identity/published-language/delegation-granted.v1.payload.ts
examples/scheduling/src/contexts/identity/published-language/delegation-revoked.v1.integration-event.ts
examples/scheduling/src/contexts/identity/published-language/delegation-revoked.v1.payload.ts
examples/scheduling/src/contexts/identity/published-language/person-registered.v1.integration-event.ts
examples/scheduling/src/contexts/identity/published-language/person-registered.v1.payload.ts
examples/scheduling/src/contexts/identity/published-language/practice-member-added.v1.integration-event.ts
examples/scheduling/src/contexts/identity/published-language/practice-member-added.v1.payload.ts
examples/scheduling/src/contexts/identity/published-language/practice-member-removed.v1.integration-event.ts
examples/scheduling/src/contexts/identity/published-language/practice-member-removed.v1.payload.ts
examples/scheduling/src/contexts/identity/published-language/practice-opened.v1.integration-event.ts
examples/scheduling/src/contexts/identity/published-language/practice-opened.v1.payload.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-granted.event.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-granted.publisher.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-revoked.event.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-revoked.publisher.spec.ts
examples/scheduling/src/contexts/identity/test/unit/person-registered.event.spec.ts
examples/scheduling/src/contexts/identity/test/unit/person-registered.publisher.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-member-added.event.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-member-added.publisher.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-member-removed.event.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-member-removed.publisher.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-opened.event.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-opened.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-booked.v1.payload.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-cancelled.v1.payload.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-completed.v1.payload.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-confirmed.v1.payload.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-expired.v1.payload.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-marked-no-show.v1.payload.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-rescheduled.v1.payload.ts
examples/scheduling/src/contexts/scheduling/published-language/calendar-created.v1.payload.ts
```

### 11. `feat(identity): register a person at their first sign-in`

30 files, 30 counted, 978 lines counted (over the target).

```text
examples/scheduling/src/contexts/identity/application/commands/register-person/register-person.command.ts
examples/scheduling/src/contexts/identity/application/commands/register-person/register-person.handler.ts
examples/scheduling/src/contexts/identity/domain/aggregates/person.aggregate.ts
examples/scheduling/src/contexts/identity/domain/errors/invalid-display-name.error.ts
examples/scheduling/src/contexts/identity/domain/errors/invalid-email.error.ts
examples/scheduling/src/contexts/identity/domain/errors/person-not-registered.error.ts
examples/scheduling/src/contexts/identity/domain/repositories/person.repository.ts
examples/scheduling/src/contexts/identity/domain/value-objects/display-name.vo.ts
examples/scheduling/src/contexts/identity/domain/value-objects/email.vo.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/knex-person-directory.reader.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/knex-person.repository.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/person-row.schema.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/person.mapper.ts
examples/scheduling/src/contexts/identity/presentation/http/register-person-accepted.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/register-person-body.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/register-person.route.ts
examples/scheduling/src/contexts/identity/test/builders/person.builder.ts
examples/scheduling/src/contexts/identity/test/fakes/person.repository.fake.ts
examples/scheduling/src/contexts/identity/test/integration/knex-person-directory.reader.spec.ts
examples/scheduling/src/contexts/identity/test/integration/person.repository.contract.spec.ts
examples/scheduling/src/contexts/identity/test/unit/display-name.vo.spec.ts
examples/scheduling/src/contexts/identity/test/unit/email.vo.spec.ts
examples/scheduling/src/contexts/identity/test/unit/invalid-display-name.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/invalid-email.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/person-not-registered.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/person-registered.event-handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/person.aggregate.spec.ts
examples/scheduling/src/contexts/identity/test/unit/register-person.handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/register-person.route.spec.ts
examples/scheduling/test/e2e/identity-register-person.e2e.spec.ts
```

### 12. `feat(identity): open a practice with its first manager`

29 files, 29 counted, 1223 lines counted (over the target).

```text
examples/scheduling/src/contexts/identity/application/commands/open-practice/open-practice.command.ts
examples/scheduling/src/contexts/identity/application/commands/open-practice/open-practice.handler.ts
examples/scheduling/src/contexts/identity/domain/aggregates/practice.aggregate.ts
examples/scheduling/src/contexts/identity/domain/errors/unknown-practice.error.ts
examples/scheduling/src/contexts/identity/domain/errors/unknown-role.error.ts
examples/scheduling/src/contexts/identity/domain/errors/unknown-time-zone.error.ts
examples/scheduling/src/contexts/identity/domain/repositories/practice.repository.ts
examples/scheduling/src/contexts/identity/domain/value-objects/membership.vo.ts
examples/scheduling/src/contexts/identity/domain/value-objects/role.vo.ts
examples/scheduling/src/contexts/identity/domain/value-objects/time-zone.vo.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/knex-practice.repository.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/practice-row.schema.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/practice.mapper.ts
examples/scheduling/src/contexts/identity/presentation/http/open-practice-accepted.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/open-practice-body.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/open-practice.route.ts
examples/scheduling/src/contexts/identity/test/builders/practice.builder.ts
examples/scheduling/src/contexts/identity/test/fakes/practice.repository.fake.ts
examples/scheduling/src/contexts/identity/test/integration/practice.repository.contract.spec.ts
examples/scheduling/src/contexts/identity/test/unit/membership.vo.spec.ts
examples/scheduling/src/contexts/identity/test/unit/open-practice.handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/open-practice.route.spec.ts
examples/scheduling/src/contexts/identity/test/unit/unknown-practice.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice.aggregate.spec.ts
examples/scheduling/src/contexts/identity/test/unit/role.vo.spec.ts
examples/scheduling/src/contexts/identity/test/unit/time-zone.vo.spec.ts
examples/scheduling/src/contexts/identity/test/unit/unknown-role.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/unknown-time-zone.error.spec.ts
examples/scheduling/test/e2e/identity-open-practice.e2e.spec.ts
```

### 13. `feat(identity): add and remove the members of a practice`

23 files, 23 counted, 946 lines counted (over the target).

```text
examples/scheduling/src/contexts/identity/application/commands/add-member/add-member.command.ts
examples/scheduling/src/contexts/identity/application/commands/add-member/add-member.handler.ts
examples/scheduling/src/contexts/identity/application/commands/remove-member/remove-member.command.ts
examples/scheduling/src/contexts/identity/application/commands/remove-member/remove-member.handler.ts
examples/scheduling/src/contexts/identity/domain/errors/already-member.error.ts
examples/scheduling/src/contexts/identity/domain/errors/not-a-member.error.ts
examples/scheduling/src/contexts/identity/domain/errors/practice-left-unmanaged.error.ts
examples/scheduling/src/contexts/identity/presentation/http/add-member-accepted.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/add-member-body.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/add-member-params.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/add-member.route.ts
examples/scheduling/src/contexts/identity/presentation/http/remove-member-accepted.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/remove-member-params.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/remove-member.route.ts
examples/scheduling/src/contexts/identity/test/unit/add-member.handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/add-member.route.spec.ts
examples/scheduling/src/contexts/identity/test/unit/already-member.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/not-a-member.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-left-unmanaged.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/remove-member.handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/remove-member.route.spec.ts
examples/scheduling/test/e2e/identity-add-member.e2e.spec.ts
examples/scheduling/test/e2e/identity-remove-member.e2e.spec.ts
```

### 14. `feat(identity): grant and revoke a delegation on a desk`

42 files, 42 counted, 1760 lines counted (over the target).

```text
examples/scheduling/src/contexts/identity/application/commands/grant-delegation/grant-delegation.command.ts
examples/scheduling/src/contexts/identity/application/commands/grant-delegation/grant-delegation.handler.ts
examples/scheduling/src/contexts/identity/application/commands/revoke-delegation/revoke-delegation.command.ts
examples/scheduling/src/contexts/identity/application/commands/revoke-delegation/revoke-delegation.handler.ts
examples/scheduling/src/contexts/identity/domain/aggregates/delegation.aggregate.ts
examples/scheduling/src/contexts/identity/domain/errors/delegation-already-active.error.ts
examples/scheduling/src/contexts/identity/domain/errors/delegation-ends-in-the-past.error.ts
examples/scheduling/src/contexts/identity/domain/errors/delegation-not-active.error.ts
examples/scheduling/src/contexts/identity/domain/errors/unknown-delegation.error.ts
examples/scheduling/src/contexts/identity/domain/errors/not-a-practitioner.error.ts
examples/scheduling/src/contexts/identity/domain/errors/not-an-assistant.error.ts
examples/scheduling/src/contexts/identity/domain/repositories/delegation.repository.ts
examples/scheduling/src/contexts/identity/domain/value-objects/desk.vo.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/delegation-row.schema.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/delegation.mapper.ts
examples/scheduling/src/contexts/identity/infrastructure/persistence/knex-delegation.repository.ts
examples/scheduling/src/contexts/identity/presentation/http/grant-delegation-accepted.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/grant-delegation-body.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/grant-delegation-params.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/grant-delegation.route.ts
examples/scheduling/src/contexts/identity/presentation/http/revoke-delegation-accepted.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/revoke-delegation-params.dto.ts
examples/scheduling/src/contexts/identity/presentation/http/revoke-delegation.route.ts
examples/scheduling/src/contexts/identity/test/builders/delegation.builder.ts
examples/scheduling/src/contexts/identity/test/fakes/delegation.repository.fake.ts
examples/scheduling/src/contexts/identity/test/integration/delegation.repository.contract.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-already-active.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-ends-in-the-past.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-granted.event-handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-not-active.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/unknown-delegation.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation-revoked.event-handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/delegation.aggregate.spec.ts
examples/scheduling/src/contexts/identity/test/unit/desk.vo.spec.ts
examples/scheduling/src/contexts/identity/test/unit/grant-delegation.handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/grant-delegation.route.spec.ts
examples/scheduling/src/contexts/identity/test/unit/not-a-practitioner.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/not-an-assistant.error.spec.ts
examples/scheduling/src/contexts/identity/test/unit/revoke-delegation.handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/revoke-delegation.route.spec.ts
examples/scheduling/test/e2e/identity-grant-delegation.e2e.spec.ts
examples/scheduling/test/e2e/identity-revoke-delegation.e2e.spec.ts
```

### 15. `feat(identity): expire delegations past their end`

5 files, 5 counted, 224 lines counted.

```text
examples/scheduling/src/contexts/identity/application/commands/expire-delegations/expire-delegations.command.ts
examples/scheduling/src/contexts/identity/application/commands/expire-delegations/expire-delegations.handler.ts
examples/scheduling/src/contexts/identity/application/scheduling/expire-delegations.job.ts
examples/scheduling/src/contexts/identity/test/unit/expire-delegations.handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/expire-delegations.job.spec.ts
```

### 16. `feat(identity): keep relationships in step with memberships and delegations`

11 files, 11 counted, 410 lines counted.

```text
examples/scheduling/src/contexts/identity/application/event-handlers/delegation-granted.event-handler.ts
examples/scheduling/src/contexts/identity/application/event-handlers/delegation-revoked.event-handler.ts
examples/scheduling/src/contexts/identity/application/event-handlers/person-registered.event-handler.ts
examples/scheduling/src/contexts/identity/application/event-handlers/practice-member-added.event-handler.ts
examples/scheduling/src/contexts/identity/application/event-handlers/practice-member-removed.event-handler.ts
examples/scheduling/src/contexts/identity/application/ports/identity-relationships.port.ts
examples/scheduling/src/contexts/identity/infrastructure/external/remote-identity-relationships.adapter.ts
examples/scheduling/src/contexts/identity/test/fakes/identity-relationships.fake.ts
examples/scheduling/src/contexts/identity/test/integration/remote-identity-relationships.adapter.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-member-added.event-handler.spec.ts
examples/scheduling/src/contexts/identity/test/unit/practice-member-removed.event-handler.spec.ts
```

### 17. `feat(identity): answer the person directory to other contexts`

1 files, 1 counted, 10 lines counted.

```text
examples/scheduling/src/contexts/identity/published-language/person-directory.contract.ts
```

### 18. `feat(scheduling): declare the context and its language`

7 files, 6 counted, 431 lines counted.

```text
examples/scheduling/src/contexts/scheduling/CONTEXT.md
examples/scheduling/src/contexts/scheduling/application/authorization/scheduling.permissions.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/create-scheduling-tables.schema.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/scheduling.schema.ts
examples/scheduling/src/contexts/scheduling/presentation/http/scheduling.routes.ts
examples/scheduling/src/contexts/scheduling/published-language/index.ts
examples/scheduling/src/contexts/scheduling/scheduling.declarations.ts
```

### 19. `feat(scheduling): publish what happens to calendars and appointments`

40 files, 40 counted, 987 lines counted (over the target).

```text
examples/scheduling/src/contexts/scheduling/application/integration/publishers/appointment-booked.publisher.ts
examples/scheduling/src/contexts/scheduling/application/integration/publishers/appointment-cancelled.publisher.ts
examples/scheduling/src/contexts/scheduling/application/integration/publishers/appointment-completed.publisher.ts
examples/scheduling/src/contexts/scheduling/application/integration/publishers/appointment-confirmed.publisher.ts
examples/scheduling/src/contexts/scheduling/application/integration/publishers/appointment-expired.publisher.ts
examples/scheduling/src/contexts/scheduling/application/integration/publishers/appointment-marked-no-show.publisher.ts
examples/scheduling/src/contexts/scheduling/application/integration/publishers/appointment-rescheduled.publisher.ts
examples/scheduling/src/contexts/scheduling/application/integration/publishers/calendar-created.publisher.ts
examples/scheduling/src/contexts/scheduling/domain/events/appointment-booked.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/appointment-cancelled.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/appointment-completed.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/appointment-confirmed.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/appointment-expired.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/appointment-marked-no-show.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/appointment-rescheduled.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/calendar-created.event.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-booked.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-cancelled.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-completed.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-confirmed.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-expired.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-marked-no-show.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-rescheduled.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/published-language/calendar-created.v1.integration-event.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-booked.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-booked.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-cancelled.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-cancelled.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-completed.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-completed.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-confirmed.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-confirmed.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-expired.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-expired.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-marked-no-show.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-marked-no-show.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-rescheduled.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-rescheduled.publisher.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar-created.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar-created.publisher.spec.ts
```

### 20. `feat(scheduling): know the practitioners of a practice from identity`

8 files, 8 counted, 283 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/ports/practitioner-directory.port.ts
examples/scheduling/src/contexts/scheduling/application/projections/practitioners.projection.ts
examples/scheduling/src/contexts/scheduling/domain/errors/unknown-practitioner.error.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/knex-practitioner-directory.repository.ts
examples/scheduling/src/contexts/scheduling/test/fakes/practitioner-directory.fake.ts
examples/scheduling/src/contexts/scheduling/test/integration/knex-practitioner-directory.repository.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/practitioners.projection.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/unknown-practitioner.error.spec.ts
```

### 21. `feat(scheduling): create a calendar for a practitioner`

30 files, 30 counted, 1477 lines counted (over the target). The Calendar aggregate is in this commit whole, with the behaviour the next four use cases call: the workers built it as one file.

```text
examples/scheduling/src/contexts/scheduling/application/commands/create-calendar/create-calendar.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/create-calendar/create-calendar.handler.ts
examples/scheduling/src/contexts/scheduling/domain/aggregates/calendar.aggregate.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-booking-window.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/unknown-calendar.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/unknown-time-zone.error.ts
examples/scheduling/src/contexts/scheduling/domain/repositories/calendar.repository.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/booking-window.vo.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/time-zone.vo.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/calendar-row.schema.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/calendar.mapper.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/knex-calendar.repository.ts
examples/scheduling/src/contexts/scheduling/presentation/http/create-calendar-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/create-calendar-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/create-calendar.route.ts
examples/scheduling/src/contexts/scheduling/test/builders/calendar.builder.ts
examples/scheduling/src/contexts/scheduling/test/fakes/calendar.repository.fake.ts
examples/scheduling/src/contexts/scheduling/test/integration/calendar.repository.contract.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/booking-window.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar-appointment-type-defined.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar-created.event-handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar-exception-added.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar-opening-hours-set.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar-time-off-added.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/calendar.aggregate.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/create-calendar.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/create-calendar.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-booking-window.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/time-zone.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/unknown-time-zone.error.spec.ts
```

### 22. `feat(scheduling): set the opening hours of a calendar`

16 files, 16 counted, 545 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/commands/set-opening-hours/set-opening-hours.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/set-opening-hours/set-opening-hours.handler.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-range.error.ts
examples/scheduling/src/contexts/scheduling/domain/events/calendar-opening-hours-set.event.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/opening-hours.vo.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/range.vo.ts
examples/scheduling/src/contexts/scheduling/presentation/http/opening-range.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/set-opening-hours-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/set-opening-hours-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/set-opening-hours-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/set-opening-hours.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-range.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/opening-hours.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/range.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/set-opening-hours.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/set-opening-hours.route.spec.ts
```

### 23. `feat(scheduling): add an exception to a day`

13 files, 13 counted, 361 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/commands/add-exception/add-exception.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/add-exception/add-exception.handler.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-day.error.ts
examples/scheduling/src/contexts/scheduling/domain/events/calendar-exception-added.event.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/exception.vo.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-exception-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-exception-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-exception-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-exception.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/add-exception.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/add-exception.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/exception.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-day.error.spec.ts
```

### 24. `feat(scheduling): add a time off`

15 files, 15 counted, 393 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/commands/add-time-off/add-time-off.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/add-time-off/add-time-off.handler.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-time-off.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/time-off-covers-appointments.error.ts
examples/scheduling/src/contexts/scheduling/domain/events/calendar-time-off-added.event.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/time-off.vo.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-time-off-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-time-off-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-time-off-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/add-time-off.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/add-time-off.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/add-time-off.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-time-off.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/time-off-covers-appointments.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/time-off.vo.spec.ts
```

### 25. `feat(scheduling): define an appointment type`

23 files, 23 counted, 524 lines counted (over the target).

```text
examples/scheduling/src/contexts/scheduling/application/commands/define-appointment-type/define-appointment-type.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/define-appointment-type/define-appointment-type.handler.ts
examples/scheduling/src/contexts/scheduling/domain/errors/booking-too-far.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/booking-too-late.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-appointment-type.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/off-grid.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/outside-availability.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/unknown-appointment-type.error.ts
examples/scheduling/src/contexts/scheduling/domain/events/calendar-appointment-type-defined.event.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/appointment-type.vo.ts
examples/scheduling/src/contexts/scheduling/presentation/http/define-appointment-type-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/define-appointment-type-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/define-appointment-type-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/define-appointment-type.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-type.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/booking-too-far.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/booking-too-late.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/define-appointment-type.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/define-appointment-type.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-appointment-type.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/off-grid.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/outside-availability.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/unknown-appointment-type.error.spec.ts
```

### 26. `feat(scheduling): hold a slot once, by the domain and by the database`

41 files, 41 counted, 2202 lines counted (over the target). The Appointment aggregate with its whole life, the Scheduler, the exclusion constraint adapter and the concurrent booking spec. Larger than the target: one aggregate, written as one file.

```text
examples/scheduling/src/contexts/scheduling/domain/aggregates/appointment.aggregate.ts
examples/scheduling/src/contexts/scheduling/domain/errors/appointment-already-confirmed.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/appointment-ended.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/unknown-appointment.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/appointment-not-started.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-booking.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-slot.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/patient-limit-reached.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/reason-required.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/slot-taken.error.ts
examples/scheduling/src/contexts/scheduling/domain/repositories/appointment.repository.ts
examples/scheduling/src/contexts/scheduling/domain/services/scheduler.service.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/booking.vo.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/cancellation.vo.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/slot.vo.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/appointment-row.schema.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/appointment.mapper.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/knex-appointment.repository.ts
examples/scheduling/src/contexts/scheduling/test/builders/appointment.builder.ts
examples/scheduling/src/contexts/scheduling/test/fakes/appointment.repository.fake.ts
examples/scheduling/src/contexts/scheduling/test/integration/appointment-journey.spec.ts
examples/scheduling/src/contexts/scheduling/test/integration/appointment.repository.contract.spec.ts
examples/scheduling/src/contexts/scheduling/test/integration/concurrent-booking.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-already-confirmed.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-booked.event-handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-cancelled.event-handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-ended.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-expired.event-handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/unknown-appointment.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-not-started.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment-rescheduled.event-handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/appointment.aggregate.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/booking.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/cancellation.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-booking.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-slot.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/patient-limit-reached.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/reason-required.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/scheduler.service.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/slot-taken.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/slot.vo.spec.ts
```

### 27. `feat(scheduling): keep relationships in step with calendars and appointments`

6 files, 6 counted, 139 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/event-handlers/appointment-booked.event-handler.ts
examples/scheduling/src/contexts/scheduling/application/event-handlers/calendar-created.event-handler.ts
examples/scheduling/src/contexts/scheduling/application/ports/scheduling-relationships.port.ts
examples/scheduling/src/contexts/scheduling/infrastructure/external/remote-scheduling-relationships.adapter.ts
examples/scheduling/src/contexts/scheduling/test/fakes/scheduling-relationships.fake.ts
examples/scheduling/src/contexts/scheduling/test/integration/remote-scheduling-relationships.adapter.spec.ts
```

### 28. `feat(scheduling): book an appointment`

7 files, 7 counted, 365 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/commands/book-appointment/book-appointment.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/book-appointment/book-appointment.handler.ts
examples/scheduling/src/contexts/scheduling/presentation/http/book-appointment-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/book-appointment-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/book-appointment.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/book-appointment.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/book-appointment.route.spec.ts
```

### 29. `feat(scheduling): confirm a requested appointment`

7 files, 7 counted, 215 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/commands/confirm-appointment/confirm-appointment.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/confirm-appointment/confirm-appointment.handler.ts
examples/scheduling/src/contexts/scheduling/presentation/http/confirm-appointment-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/confirm-appointment-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/confirm-appointment.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/confirm-appointment.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/confirm-appointment.route.spec.ts
```

### 30. `feat(scheduling): cancel an appointment, the patient until 24 hours before`

10 files, 10 counted, 357 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/authorization/patient-cancels-until-notice.policy.ts
examples/scheduling/src/contexts/scheduling/application/commands/cancel-appointment/cancel-appointment.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/cancel-appointment/cancel-appointment.handler.ts
examples/scheduling/src/contexts/scheduling/presentation/http/cancel-appointment-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/cancel-appointment-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/cancel-appointment-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/cancel-appointment.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/cancel-appointment.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/cancel-appointment.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/patient-cancels-until-notice.policy.spec.ts
```

### 31. `feat(scheduling): reschedule an appointment in one step`

10 files, 10 counted, 411 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/authorization/patient-reschedules-until-notice.policy.ts
examples/scheduling/src/contexts/scheduling/application/commands/reschedule-appointment/reschedule-appointment.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/reschedule-appointment/reschedule-appointment.handler.ts
examples/scheduling/src/contexts/scheduling/presentation/http/reschedule-appointment-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/reschedule-appointment-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/reschedule-appointment-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/reschedule-appointment.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/patient-reschedules-until-notice.policy.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/reschedule-appointment.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/reschedule-appointment.route.spec.ts
```

### 32. `feat(scheduling): complete an appointment or mark a no-show`

14 files, 14 counted, 438 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/commands/complete-appointment/complete-appointment.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/complete-appointment/complete-appointment.handler.ts
examples/scheduling/src/contexts/scheduling/application/commands/mark-appointment-no-show/mark-appointment-no-show.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/mark-appointment-no-show/mark-appointment-no-show.handler.ts
examples/scheduling/src/contexts/scheduling/presentation/http/complete-appointment-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/complete-appointment-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/complete-appointment.route.ts
examples/scheduling/src/contexts/scheduling/presentation/http/mark-appointment-no-show-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/mark-appointment-no-show-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/mark-appointment-no-show.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/complete-appointment.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/complete-appointment.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/mark-appointment-no-show.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/mark-appointment-no-show.route.spec.ts
```

### 33. `feat(scheduling): expire unconfirmed appointments`

5 files, 5 counted, 216 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/expire-unconfirmed-appointments/expire-unconfirmed-appointments.handler.ts
examples/scheduling/src/contexts/scheduling/application/scheduling/expire-unconfirmed-appointments.job.ts
examples/scheduling/src/contexts/scheduling/test/unit/expire-unconfirmed-appointments.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/expire-unconfirmed-appointments.job.spec.ts
```

### 34. `feat(scheduling): list appointments and the agenda of a practice by access scope`

22 files, 22 counted, 1113 lines counted (over the target).

```text
examples/scheduling/src/contexts/scheduling/application/ports/agenda.port.ts
examples/scheduling/src/contexts/scheduling/application/projections/agenda.projection.ts
examples/scheduling/src/contexts/scheduling/application/queries/list-appointments/list-appointments.handler.ts
examples/scheduling/src/contexts/scheduling/application/queries/list-appointments/list-appointments.query.ts
examples/scheduling/src/contexts/scheduling/application/queries/list-appointments/list-appointments.result.ts
examples/scheduling/src/contexts/scheduling/application/queries/list-practice-agenda/list-practice-agenda.handler.ts
examples/scheduling/src/contexts/scheduling/application/queries/list-practice-agenda/list-practice-agenda.query.ts
examples/scheduling/src/contexts/scheduling/application/queries/list-practice-agenda/list-practice-agenda.result.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/knex-agenda.repository.ts
examples/scheduling/src/contexts/scheduling/presentation/http/list-appointments-line.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/list-appointments.route.ts
examples/scheduling/src/contexts/scheduling/presentation/http/list-practice-agenda-line.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/list-practice-agenda-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/list-practice-agenda.route.ts
examples/scheduling/src/contexts/scheduling/test/builders/agenda-entry.builder.ts
examples/scheduling/src/contexts/scheduling/test/fakes/agenda.fake.ts
examples/scheduling/src/contexts/scheduling/test/integration/knex-agenda.repository.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/agenda.projection.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/list-appointments.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/list-appointments.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/list-practice-agenda.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/list-practice-agenda.route.spec.ts
```

### 35. `feat(scheduling): show an appointment with the name of its patient`

12 files, 12 counted, 371 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/ports/person-directory-gateway.port.ts
examples/scheduling/src/contexts/scheduling/application/queries/get-appointment/get-appointment.handler.ts
examples/scheduling/src/contexts/scheduling/application/queries/get-appointment/get-appointment.query.ts
examples/scheduling/src/contexts/scheduling/application/queries/get-appointment/get-appointment.result.ts
examples/scheduling/src/contexts/scheduling/infrastructure/external/in-process-person-directory.gateway.ts
examples/scheduling/src/contexts/scheduling/presentation/http/get-appointment-answer.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/get-appointment-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/get-appointment.route.ts
examples/scheduling/src/contexts/scheduling/test/fakes/person-directory-gateway.fake.ts
examples/scheduling/src/contexts/scheduling/test/integration/person-directory-gateway.contract.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/get-appointment.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/get-appointment.route.spec.ts
```

### 36. `feat(scheduling): show the day of a calendar, busy without the name`

8 files, 8 counted, 475 lines counted.

```text
examples/scheduling/src/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.handler.ts
examples/scheduling/src/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.query.ts
examples/scheduling/src/contexts/scheduling/application/queries/get-calendar-day/get-calendar-day.result.ts
examples/scheduling/src/contexts/scheduling/presentation/http/get-calendar-day-answer.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/get-calendar-day-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/get-calendar-day.route.ts
examples/scheduling/src/contexts/scheduling/test/unit/get-calendar-day.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/get-calendar-day.route.spec.ts
```

### 37. `feat(scheduling): offer a freed slot to the first waiter`

37 files, 37 counted, 1316 lines counted (over the target).

```text
examples/scheduling/src/contexts/scheduling/application/commands/join-waitlist/join-waitlist.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/join-waitlist/join-waitlist.handler.ts
examples/scheduling/src/contexts/scheduling/application/commands/offer-freed-slot/offer-freed-slot.command.ts
examples/scheduling/src/contexts/scheduling/application/commands/offer-freed-slot/offer-freed-slot.handler.ts
examples/scheduling/src/contexts/scheduling/application/event-handlers/appointment-cancelled.event-handler.ts
examples/scheduling/src/contexts/scheduling/application/event-handlers/appointment-expired.event-handler.ts
examples/scheduling/src/contexts/scheduling/application/event-handlers/appointment-rescheduled.event-handler.ts
examples/scheduling/src/contexts/scheduling/domain/aggregates/waitlist.aggregate.ts
examples/scheduling/src/contexts/scheduling/domain/errors/already-waiting.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-offer.error.ts
examples/scheduling/src/contexts/scheduling/domain/errors/invalid-waiter.error.ts
examples/scheduling/src/contexts/scheduling/domain/events/waitlist-joined.event.ts
examples/scheduling/src/contexts/scheduling/domain/events/waitlist-slot-offered.event.ts
examples/scheduling/src/contexts/scheduling/domain/repositories/waitlist.repository.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/offer.vo.ts
examples/scheduling/src/contexts/scheduling/domain/value-objects/waiter.vo.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/knex-waitlist.repository.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/waitlist-row.schema.ts
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/waitlist.mapper.ts
examples/scheduling/src/contexts/scheduling/presentation/http/join-waitlist-accepted.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/join-waitlist-body.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/join-waitlist-params.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/join-waitlist.route.ts
examples/scheduling/src/contexts/scheduling/test/builders/waitlist.builder.ts
examples/scheduling/src/contexts/scheduling/test/fakes/waitlist.repository.fake.ts
examples/scheduling/src/contexts/scheduling/test/integration/waitlist.repository.contract.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/already-waiting.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-offer.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/invalid-waiter.error.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/join-waitlist.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/join-waitlist.route.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/offer-freed-slot.handler.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/offer.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/waiter.vo.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/waitlist-joined.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/waitlist-slot-offered.event.spec.ts
examples/scheduling/src/contexts/scheduling/test/unit/waitlist.aggregate.spec.ts
```

### 38. `feat(scheduling): answer the appointment export to other contexts`

3 files, 3 counted, 216 lines counted.

```text
examples/scheduling/src/contexts/scheduling/infrastructure/persistence/knex-appointment-export.repository.ts
examples/scheduling/src/contexts/scheduling/published-language/appointment-export.contract.ts
examples/scheduling/src/contexts/scheduling/test/integration/knex-appointment-export.repository.spec.ts
```

### 39. `feat(scheduling): remaining files of the context`

6 files, 6 counted, 91 lines counted. Whatever no pattern above claimed: read the list, it should be short.

```text
examples/scheduling/src/contexts/scheduling/presentation/http/calendar-day-appointment-type.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/calendar-day-appointment.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/calendar-day-busy.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/calendar-day-span.dto.ts
examples/scheduling/src/contexts/scheduling/presentation/http/day-range.dto.ts
examples/scheduling/src/contexts/scheduling/test/unit/unknown-calendar.error.spec.ts
```

### 40. `feat(notification): declare the context and its language`

7 files, 6 counted, 198 lines counted.

```text
examples/scheduling/src/contexts/notification/CONTEXT.md
examples/scheduling/src/contexts/notification/application/authorization/notification.permissions.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/create-notification-tables.schema.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/notification.schema.ts
examples/scheduling/src/contexts/notification/notification.declarations.ts
examples/scheduling/src/contexts/notification/presentation/http/notification.routes.ts
examples/scheduling/src/contexts/notification/published-language/index.ts
```

### 41. `feat(notification): know the contact of a person from identity`

8 files, 8 counted, 233 lines counted.

```text
examples/scheduling/src/contexts/notification/application/ports/contacts.port.ts
examples/scheduling/src/contexts/notification/application/projections/contacts.projection.ts
examples/scheduling/src/contexts/notification/domain/errors/contact-unknown.error.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/knex-contacts.repository.ts
examples/scheduling/src/contexts/notification/test/fakes/contacts.fake.ts
examples/scheduling/src/contexts/notification/test/integration/knex-contacts.repository.spec.ts
examples/scheduling/src/contexts/notification/test/unit/contact-unknown.error.spec.ts
examples/scheduling/src/contexts/notification/test/unit/contacts.projection.spec.ts
```

### 42. `feat(notification): send a notification for each fact of an appointment`

33 files, 33 counted, 1586 lines counted (over the target). The Notification aggregate, the Mailer port with its development adapter and its resilience policy, the command and the five consumers.

```text
examples/scheduling/src/contexts/notification/application/commands/send-notification/send-notification.command.ts
examples/scheduling/src/contexts/notification/application/commands/send-notification/send-notification.handler.ts
examples/scheduling/src/contexts/notification/application/integration/handlers/scheduling-appointment-booked.integration-handler.ts
examples/scheduling/src/contexts/notification/application/integration/handlers/scheduling-appointment-cancelled.integration-handler.ts
examples/scheduling/src/contexts/notification/application/integration/handlers/scheduling-appointment-confirmed.integration-handler.ts
examples/scheduling/src/contexts/notification/application/integration/handlers/scheduling-appointment-expired.integration-handler.ts
examples/scheduling/src/contexts/notification/application/integration/handlers/scheduling-appointment-rescheduled.integration-handler.ts
examples/scheduling/src/contexts/notification/application/ports/mailer.port.ts
examples/scheduling/src/contexts/notification/domain/aggregates/notification.aggregate.ts
examples/scheduling/src/contexts/notification/domain/errors/invalid-notification-kind.error.ts
examples/scheduling/src/contexts/notification/domain/events/notification-sent.event.ts
examples/scheduling/src/contexts/notification/domain/repositories/notification.repository.ts
examples/scheduling/src/contexts/notification/domain/value-objects/notification-kind.vo.ts
examples/scheduling/src/contexts/notification/infrastructure/external/remote-mailer.adapter.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/knex-notification.repository.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/notification-row.schema.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/notification.mapper.ts
examples/scheduling/src/contexts/notification/test/builders/notification.builder.ts
examples/scheduling/src/contexts/notification/test/fakes/mailer.fake.ts
examples/scheduling/src/contexts/notification/test/fakes/notification.repository.fake.ts
examples/scheduling/src/contexts/notification/test/integration/mailer-outage.spec.ts
examples/scheduling/src/contexts/notification/test/integration/notification.repository.contract.spec.ts
examples/scheduling/src/contexts/notification/test/integration/remote-mailer.adapter.spec.ts
examples/scheduling/src/contexts/notification/test/unit/invalid-notification-kind.error.spec.ts
examples/scheduling/src/contexts/notification/test/unit/notification-kind.vo.spec.ts
examples/scheduling/src/contexts/notification/test/unit/notification-sent.event.spec.ts
examples/scheduling/src/contexts/notification/test/unit/notification.aggregate.spec.ts
examples/scheduling/src/contexts/notification/test/unit/scheduling-appointment-booked.integration-handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/scheduling-appointment-cancelled.integration-handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/scheduling-appointment-confirmed.integration-handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/scheduling-appointment-expired.integration-handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/scheduling-appointment-rescheduled.integration-handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/send-notification.handler.spec.ts
```

### 43. `feat(notification): plan, withdraw and send reminders once`

28 files, 28 counted, 1266 lines counted (over the target).

```text
examples/scheduling/src/contexts/notification/application/commands/plan-reminder/plan-reminder.command.ts
examples/scheduling/src/contexts/notification/application/commands/plan-reminder/plan-reminder.handler.ts
examples/scheduling/src/contexts/notification/application/commands/send-due-reminders/send-due-reminders.command.ts
examples/scheduling/src/contexts/notification/application/commands/send-due-reminders/send-due-reminders.handler.ts
examples/scheduling/src/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.command.ts
examples/scheduling/src/contexts/notification/application/commands/withdraw-reminder/withdraw-reminder.handler.ts
examples/scheduling/src/contexts/notification/application/event-handlers/notification-sent.event-handler.ts
examples/scheduling/src/contexts/notification/application/event-handlers/reminder-sent.event-handler.ts
examples/scheduling/src/contexts/notification/application/scheduling/send-due-reminders.job.ts
examples/scheduling/src/contexts/notification/domain/aggregates/reminder.aggregate.ts
examples/scheduling/src/contexts/notification/domain/errors/reminder-not-due.error.ts
examples/scheduling/src/contexts/notification/domain/events/reminder-sent.event.ts
examples/scheduling/src/contexts/notification/domain/repositories/reminder.repository.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/knex-reminder.repository.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/reminder-row.schema.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/reminder.mapper.ts
examples/scheduling/src/contexts/notification/test/builders/reminder.builder.ts
examples/scheduling/src/contexts/notification/test/fakes/reminder.repository.fake.ts
examples/scheduling/src/contexts/notification/test/integration/reminder.repository.contract.spec.ts
examples/scheduling/src/contexts/notification/test/unit/notification-sent.event-handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/plan-reminder.handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/reminder-not-due.error.spec.ts
examples/scheduling/src/contexts/notification/test/unit/reminder-sent.event-handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/reminder-sent.event.spec.ts
examples/scheduling/src/contexts/notification/test/unit/reminder.aggregate.spec.ts
examples/scheduling/src/contexts/notification/test/unit/send-due-reminders.handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/send-due-reminders.job.spec.ts
examples/scheduling/src/contexts/notification/test/unit/withdraw-reminder.handler.spec.ts
```

### 44. `feat(notification): list the notifications of a person`

12 files, 12 counted, 581 lines counted.

```text
examples/scheduling/src/contexts/notification/application/ports/list-notifications-reader.port.ts
examples/scheduling/src/contexts/notification/application/queries/list-notifications/list-notifications.handler.ts
examples/scheduling/src/contexts/notification/application/queries/list-notifications/list-notifications.query.ts
examples/scheduling/src/contexts/notification/application/queries/list-notifications/list-notifications.result.ts
examples/scheduling/src/contexts/notification/infrastructure/persistence/knex-list-notifications-reader.repository.ts
examples/scheduling/src/contexts/notification/presentation/http/list-notifications-line.dto.ts
examples/scheduling/src/contexts/notification/presentation/http/list-notifications.route.ts
examples/scheduling/src/contexts/notification/test/fakes/list-notifications-reader.fake.ts
examples/scheduling/src/contexts/notification/test/integration/knex-list-notifications-reader.repository.spec.ts
examples/scheduling/src/contexts/notification/test/unit/list-notifications.handler.spec.ts
examples/scheduling/src/contexts/notification/test/unit/list-notifications.route.spec.ts
examples/scheduling/test/e2e/notification-list-notifications.e2e.spec.ts
```

### 45. `feat(analytics): declare the context and its language`

7 files, 6 counted, 162 lines counted.

```text
examples/scheduling/src/contexts/analytics/CONTEXT.md
examples/scheduling/src/contexts/analytics/analytics.declarations.ts
examples/scheduling/src/contexts/analytics/application/authorization/analytics.permissions.ts
examples/scheduling/src/contexts/analytics/infrastructure/persistence/analytics.schema.ts
examples/scheduling/src/contexts/analytics/infrastructure/persistence/create-analytics-tables.schema.ts
examples/scheduling/src/contexts/analytics/presentation/http/analytics.routes.ts
examples/scheduling/src/contexts/analytics/published-language/index.ts
```

### 46. `feat(analytics): project the outcome of appointments and the occupancy of days`

21 files, 21 counted, 1032 lines counted (over the target).

```text
examples/scheduling/src/contexts/analytics/application/ports/occupancy-register.port.ts
examples/scheduling/src/contexts/analytics/application/ports/outcome-register.port.ts
examples/scheduling/src/contexts/analytics/application/projections/occupancy.projection.ts
examples/scheduling/src/contexts/analytics/application/projections/outcomes.projection.ts
examples/scheduling/src/contexts/analytics/domain/errors/invalid-day.error.ts
examples/scheduling/src/contexts/analytics/domain/services/occupancy-measure.service.ts
examples/scheduling/src/contexts/analytics/domain/value-objects/day.vo.ts
examples/scheduling/src/contexts/analytics/infrastructure/persistence/knex-occupancy-register.repository.ts
examples/scheduling/src/contexts/analytics/infrastructure/persistence/knex-outcome-register.repository.ts
examples/scheduling/src/contexts/analytics/test/builders/appointment-fact.builder.ts
examples/scheduling/src/contexts/analytics/test/builders/occupancy.builder.ts
examples/scheduling/src/contexts/analytics/test/builders/outcome.builder.ts
examples/scheduling/src/contexts/analytics/test/fakes/occupancy-register.fake.ts
examples/scheduling/src/contexts/analytics/test/fakes/outcome-register.fake.ts
examples/scheduling/src/contexts/analytics/test/integration/occupancy-register.contract.spec.ts
examples/scheduling/src/contexts/analytics/test/integration/outcome-register.contract.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/day.vo.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/invalid-day.error.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/occupancy-measure.service.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/occupancy.projection.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/outcomes.projection.spec.ts
```

### 47. `feat(analytics): read the occupancy of the calendars one measures`

8 files, 8 counted, 315 lines counted.

```text
examples/scheduling/src/contexts/analytics/application/queries/list-occupancy/list-occupancy.handler.ts
examples/scheduling/src/contexts/analytics/application/queries/list-occupancy/list-occupancy.query.ts
examples/scheduling/src/contexts/analytics/application/queries/list-occupancy/list-occupancy.result.ts
examples/scheduling/src/contexts/analytics/presentation/http/list-occupancy-line.dto.ts
examples/scheduling/src/contexts/analytics/presentation/http/list-occupancy-params.dto.ts
examples/scheduling/src/contexts/analytics/presentation/http/list-occupancy.route.ts
examples/scheduling/src/contexts/analytics/test/unit/list-occupancy.handler.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/list-occupancy.route.spec.ts
```

### 48. `feat(analytics): verify occupancy nightly and rebuild outcomes from scheduling`

11 files, 11 counted, 522 lines counted.

```text
examples/scheduling/src/contexts/analytics/application/commands/verify-occupancy/verify-occupancy.command.ts
examples/scheduling/src/contexts/analytics/application/commands/verify-occupancy/verify-occupancy.handler.ts
examples/scheduling/src/contexts/analytics/application/ports/appointment-export-gateway.port.ts
examples/scheduling/src/contexts/analytics/application/scheduling/verify-occupancy.job.ts
examples/scheduling/src/contexts/analytics/infrastructure/external/in-process-appointment-export.gateway.ts
examples/scheduling/src/contexts/analytics/test/fakes/appointment-export-contract.fake.ts
examples/scheduling/src/contexts/analytics/test/fakes/appointment-export-gateway.fake.ts
examples/scheduling/src/contexts/analytics/test/integration/appointment-export-gateway.contract.spec.ts
examples/scheduling/src/contexts/analytics/test/integration/outcome-register.rebuild.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/verify-occupancy.handler.spec.ts
examples/scheduling/src/contexts/analytics/test/unit/verify-occupancy.job.spec.ts
```

### 49. `docs(example): generate the contracts and the integration notes`

5 files, 2 counted, 163 lines counted. Generated documents; they belong with the last commit that changed a route or an event. Given once here because the build was parallel.

```text
examples/scheduling/docs/context-map.md
examples/scheduling/docs/integration/README.md
examples/scheduling/docs/integration/asyncapi.json
examples/scheduling/docs/integration/event-catalog.md
examples/scheduling/openapi/openapi.json
```

### 50. `test(example): prove the contexts together, from a booking to its trace`

11 files, 11 counted, 714 lines counted (over the target).

```text
examples/scheduling/test/e2e/journey-authorization.e2e.spec.ts
examples/scheduling/test/e2e/journey-booking.e2e.spec.ts
examples/scheduling/test/e2e/journey-observability.e2e.spec.ts
examples/scheduling/test/e2e/support/book-appointment.ts
examples/scheduling/test/e2e/support/listed.ts
examples/scheduling/test/e2e/support/log-lines.ts
examples/scheduling/test/e2e/support/open-staffed-practice.ts
examples/scheduling/test/e2e/support/register-people.ts
examples/scheduling/test/e2e/support/slot-starting.ts
examples/scheduling/test/e2e/support/staffed-practice.ts
examples/scheduling/test/e2e/support/storage-outage.ts
```

### 51. `feat(example): script the real run and record its transcript`

5 files, 5 counted, 585 lines counted.

```text
examples/scheduling/docs/demo-transcript.md
examples/scheduling/scripts/demo.mjs
examples/scheduling/scripts/demo/glitchtip.mjs
examples/scheduling/scripts/demo/keycloak.mjs
examples/scheduling/scripts/demo/transcript.mjs
```

### 52. `docs(example): measure the tooling and present the example`

5 files, 5 counted, 951 lines counted (over the target).

```text
examples/scheduling/README.md
examples/scheduling/docs/commit-plan.md
examples/scheduling/docs/tooling-report.md
examples/scheduling/docs/tooling/generator-log.jsonl
examples/scheduling/scripts/measure-tooling.mjs
```
