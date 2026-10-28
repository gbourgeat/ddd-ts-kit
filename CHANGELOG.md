# Changelog

What each version changes for someone who uses the kit. The packages of `packages/` are released
together, under one version; the notes of each [GitHub release](https://github.com/gbourgeat/ddd-ts-kit/releases)
list the pull requests behind it.

## 0.99.0

**`merge-trunk` regenerates the Prisma client after a schema merge, `--abort` restores the behaviour pages, and `--continue` says when the trunk moved.** A merge that added or changed `prisma/schema/<context>.prisma` left the git-ignored `generated/schema.sql` of the in-process test database stale until `npm run db:client` ran, so the end-to-end requests answered 500 on missing tables: with the Prisma stack, `merge-trunk` (and `--continue`) now runs `db:client` after `regenerate` when the merge changed a file under `prisma/schema/`, and stops, naming the script, when it fails (Drizzle, Knex and TypeORM derive no such file: their test database reads the tracked sources). The pages of `docs/behaviour/` are now derived files: settled by regenerating when they conflict, staged again after `regenerate` rewrote them, and restored and named by `--abort` instead of refusing with "changed by hand since it was staged". A merge left in progress keeps the trunk commit of its first run, so `--continue` now reports `trunk moved: <ref> was <a> when the merge started, it is <b> now` (`trunkMoved` in `--json`) and tells to run `merge-trunk` again once the merge is committed.

**The guard says where the `requires(...)` declarations of a module live.** A worker whose context module file is near the size limit created `application/authorization/declare-<module>-use-cases.policy.ts` by hand. The declarations already go to `<module>/<module>.module.ts` when `generate command|query ... --module <module>` is given (modules of the model, 0.98.0); the guard now answers a new `*.policy.ts` with that, and the wiring and access-control skills and the authorization page say it.

**`check --changed-since` reports a finding whose cause is a changed file, not only the findings that sit on a changed file.** A violation may now name `subjects`, the other files it is repaired in (shown in `--json`), and `--changed-since` keeps it when its file or one of its subjects changed. `events/consumer-idempotent` (handler not registered with a consumer name), `declarations/port-adapter-wired`, `authz/declared` (use case missing from the authorization map or declared on its message class) and `authz/policy-asked` now name the module files, composition files, authorization files or policy files that repair them, `<module>/<module>.module.ts` of a module of the model included. So a worker who removes a registration from a module file, or changes a policy, sees the error at once instead of at the full `check`. `events/consumer-idempotent` also reads every module file of a context, so a handler registered in the module file of its module is no longer reported against the first module file found.

**`check --changed-since <ref>` (and `verify-slice`) now judge a tracked file modified but not committed.** The list of changed files compared the merge base with `HEAD` only, so an edit not yet committed was skipped, contrary to the comment of the function, and a green run said nothing of it. It is now the union of the files committed since the merge base, the tracked files modified in the index or the working tree, and the untracked files git does not ignore. No more need to commit before checking.

**A relative `--worktree .worktrees/<name>` resolves against the main checkout, from any worktree.** `worker-scope`, `story-scope` and `worker-scope --resume` resolved the asked path against the root of the checkout the command ran in, so the line `plan-waves` prints, run from a trunk worktree (`.worktrees/wave7`), nested the new worktree in the trunk's (`.worktrees/wave7/.worktrees/<name>`). A relative path under `.worktrees/` now goes to the main checkout, as the default place does, and a note says so; any other relative path still starts at the project you run from.

**A run of a per-tenant job says how many tenants it ran for, and `runJob` of the e2e support fails on a run that reached none.** `JobRun` has a new `tenants` field on a succeeded per-tenant run (absent for a global job), also in the log line of the run: with an empty tenant directory the job is never called and the run is `succeeded` with `tenants: 0`. The generated `runJob(name)` throws on it, telling the spec to open a tenant (an organisation) first.

To move: a project generated before keeps its `test/e2e/support/start-application.ts`; add `tenants` to the destructuring of `jobs.runNow(name)` and throw when `tenants === 0` to get the check.

## 0.98.0

**The test runners page measures Vitest against Jest, and says which settings make each faster.**
`docs/tools/test-runners.md` (and its French page) said speed was not measured; it now gives the
wall time, CPU and memory of both runners on three pairs of projects identical but for `--tests` (a
new project, the identity preset, the scheduling example ported to Jest), cold and warm, with and
without coverage, unit and integration specs apart, one file, and on four CPUs as on a hosted
runner. Without coverage Jest is 24 to 29 percent faster on the larger projects; with coverage as
generated Vitest is 1.6 to 2.4 times faster on the example, the cost of Jest's `v8` provider, while
Jest with the `babel` provider is the fastest of the three (20.6 s against 29.5 and 48.0). The page
also measures the coverage providers and what each one reports, the number of workers, the pool
and isolation of Vitest, the worker threads of Jest, the related specs of a changed file, a
pipeline without cache, the install and mutation testing, and closes on a table of recommendations
by case, each with its measured gain and what to watch. It names two limits of the Jest template
the measures found: coverage through `v8`, and PostgreSQL started in process once per spec file
where the Vitest template starts it once per run.

**A Jest project starts PostgreSQL in process once per run, as a Vitest project does.** On an ORM,
`init --tests jest` writes `test/support/test-database-template.ts`, a global setup that initialises
the PGlite cluster once and saves it, and `test/support/test-database-teardown.ts`, which deletes
it, both named in `jest.config.js`; `open-test-database.ts` opens a copy of that cluster in each
spec instead of running an initdb of its own, as it already did under Vitest. On the identity
preset the integration specs under Jest take 26 CPU seconds instead of 45, for the same wall time
on a workstation (`docs/tools/test-runners.md`), and a busy machine no longer makes the hook that
opens the database outlast its timeout.

To move: in a Jest project on an ORM, copy the two files of `test/support/` from a new project
(`init --tests jest` with the same `--orm`), name them in `jest.config.js`
(`globalSetup: '<rootDir>/test/support/test-database-template.ts'`,
`globalTeardown: '<rootDir>/test/support/test-database-teardown.ts'`), and take
`inProcessPostgres()` of the new `src/platform/database/open-test-database.ts` in place of
`PGlite.create()`.

**A Jest project measures its coverage through the `babel` provider.** The `jest.config.js` that
`init --tests jest` writes sets `coverageProvider: 'babel'` instead of `'v8'`: on the scheduling
example ported to Jest, a run with coverage takes 20.6 s instead of 48.0 s on a workstation, and
65 s instead of 201 s on four CPUs, faster than the same specs under Vitest (measured in
`docs/tools/test-runners.md`). The branches it reports are those of the `v8` provider of Vitest;
the `v8` provider of Jest reported two to three points more. A line left out of the measure carries
the hint the provider reads, `istanbul ignore`, which `v8` did not read, as `babel` does not read
`v8 ignore`: the explanation of `test/coverage-governed` (`ddd-ts-kit explain`) gives both, and
the testing rules of a new project name the one its runner reads.

To move: in the `jest.config.js` of an existing Jest project, set `coverageProvider: 'babel'`,
rewrite each `v8 ignore` comment as `istanbul ignore` with its decision record, and run
`npm run test:coverage` once: a layer whose branch threshold sat within three points of the old
figure can fall under it.

**The test runners page says how mutation testing fares under each runner.** On the identity
preset, Stryker completes under Vitest in 1 min 46 s with 19 processes and 1 min 54 s with 8, for
11.6 GB and 5.4 GB of summed memory; under Jest it did not complete on a workstation of 31 GB, at
19 or 8 processes nor with each process restarted after 10 runs, each Jest process reaching about
2.5 GB within the first minute. `docs/tools/test-runners.md` gives the figures, a recommendation
(`--concurrency 8` under Vitest on a workstation, the mutation job planned on Vitest) and a limit
of Jest.

**`reset()` of the end-to-end support writes the grants of the system actors again.** With `--authz rebac` and a database (any ORM), `startApplication().reset()` emptied the relation tuples with every other table, so the relationships `relateSystemActors` wrote at start were gone from the second test of a spec on, and a reaction that sent a protected command as a system actor was refused with FORBIDDEN. `reset()` now calls `relateSystemActors()` after emptying the database, which leaves the application in the state it had right after start while the specs stay isolated.

To move: in a generated project, make `reset` in `test/e2e/support/start-application.ts` call `relateSystemActors()` after `database.reset()`, and drop the calls a spec made to relate its system actors again.

**The privacy register no longer says "until erased" for a retention read from configuration.**
`personalFields` accepts `configuredRetention: 'RETENTION_PERIODS'`, the key of the configuration
that gives the period when the project reads it at run time and purges by its own job. The generated
register and the `CONTEXT.md` write ``configured by `RETENTION_PERIODS` `` in the Kept column. The key
is read from the source text, never the value; the kit's own purge still runs only from a literal
`retention`, and the two together are refused.

**`generate erasure-handler` on an event-sourced context says that the key of the subject erases it, instead of sending to a table.** The context has no table to erase: its personal values are sealed by `personalData(subjectId, value)`, and `privacy:erase` (`eraseDataSubject`) destroys the key, which erases them in every context. The refusal now names `personalData`, `eraseDataSubject` and the guides, and the privacy guide, the persistence and integration-event skills say that a retention date on such a context is a scheduled job that calls the same key destruction.

**A file of types only no longer fails the coverage floor of a Jest project on the `v8` provider.**
A file that declares interfaces and type aliases and is imported with `import type` only, for
example `application/commands/pay/pay.result.ts`, is never loaded at run time, and the `v8`
provider of Jest reported all its lines uncovered, so that the floor of the layer failed though
nothing executable was untested. `governedJestCoverage()` now reads each source file as text and
leaves out of `collectCoverageFrom` those that declare types only, as it does for the ports; a
layer that holds nothing else is held to nothing, under Vitest too. Vitest and the `babel`
provider of Jest already skipped such a file.

To move: nothing; a project that moved its types into the command file to get around it can move
them back.

**`generate e2e` writes the spec of a use case only a job starts.** A use case with no route and no integration event handler used to be refused, although a job (`generate job`) is a starter of a use case too. The spec now starts the application, runs the job as the scheduler would with `await application.runJob('<context>.<job>')`, awaits `settled()` and leaves the `then` to fill. The refusal, when nothing starts the use case, names the job as a third starter it looked for. The shared support `test/e2e/support/start-application.ts` gains `runJob(name)`, which rejects when the run did not succeed, and `composeApplication` returns its `jobs` scheduler.

To move: in an existing project, add `runJob(name: string): Promise<void>;` to `RunningApplication` in `test/e2e/support/start-application.ts` and implement it with `jobs.runNow(name)` on the composed application (a run whose `outcome` is not `succeeded` throws); add `readonly jobs: JobScheduler` to `Application` in `compose-application.ts`, returned as `platform.jobs` (manual wiring) or `container.resolve(JobScheduler)` (tsyringe). `generate e2e` notes a support without `runJob`.

**`events/consumer-idempotent` accepts options spread from a shared object.**
`consume(definition, { ...options, consumer: 'ctx.name' }, handler)` passes when `options` is a
`const` of the same file initialised with an object literal that carries `processed`, or a value typed
`ConsumeOptions`; the consumer name is still read as the literal `consumer` key. A spread whose content
the file does not show is still refused, and the fix says that `processed` cannot be read.

**`generate command --aggregate` writes a handler that changes an aggregate that exists and writes nothing, and `--creates` is the birth.** Until now every command generated with `--aggregate` called `<Aggregate>.create(...)` and saved a new row on each run, so the use case a job sends created a row on every tick until a worker filled it, and the handler did not compile when `create` of the aggregate takes other arguments (TS2554). The handler now receives the repository of the aggregate, answers `void`, and holds a `TODO(domain)` (load, call one intention method, save): it compiles against the aggregate as it is and writes nothing. `--aggregate <Name> --creates` generates the former handler, which gives birth to the aggregate and answers its identifier. `--creates` without `--aggregate` is refused. A policy added later to the permission of a generated command is asked in either form.

To move: add `--creates` to the `generate command ... --aggregate` of each slice that is the birth of its aggregate (a `Start with` cell of a story included). A handler already generated is left as it is.

**In the explicit style, each module of the model has its module file, `<module>/<module>.module.ts`, composed by `<context>.module.ts`.** A context divided into modules (`contexts.<name>.modules`) registered the handlers, consumers and reactions of every module in its one `<context>.module.ts`, which passed the 350 lines of `clean/file-size` on a large context, and `tree/closed` refused any other file at the root of the context, so a project had to declare an extra directory to split it. Now `generate module <context> <module>` writes `<module>/<module>.module.ts` and composes it from `<context>.module.ts`: on tsyringe the file exports `{ register(builder), onStart({ resolve }) }`, called from `register` and `onStart` of the context; wired by hand (`--di manual` or `nest`) it exports `registerHandlers`, `registerReactions`, `registerJobs`, `useCases()` and `routes(platform)`, called from the functions of the same names. `generate <kind> ... --module <module>` writes its registration there when the file exists; wired by hand, a use case whose repository another module file already creates is registered in that file, so a repository is still created once per context. `tree/closed` accepts the module file at the root of a declared module and reports any other file there; `check` reads it as a module file (`composition/only-in-module`, `declarations/port-adapter-wired`, `authz/declared`, `domain-events/transactional-before-commit`), and so do `describe`, `docs` and the generators that read the registrations. A wiring block written into a module file also merges an import it repeats once the import names the file in its module, which wrote the same import twice in a context with modules. The declared style is unchanged: a module has no module file, its classes declare themselves.

To move: in an explicit context with modules, run `npx ddd-ts-kit generate module <context> <module>` again for each module (it adds the module file and its composition, and nothing else), then move the registrations of each module from `<context>.module.ts` to its module file, with their imports; a `composition/` folder declared in `extraDirectories` for this can go.

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

## 0.97.0

**Under the sandbox of the regulated profile, `prisma-generate` and `typeorm-generate` say that the database is out of reach instead of failing with a raw connection error.** A sandboxed command cannot open a TCP connection to the local PostgreSQL (probed on Claude Code 2.1.311 on Linux: `allowedDomains` with the host and the port, `allowLocalBinding` and `allowAllUnixSockets` all end in `ECONNREFUSED`; the sandbox's network leaves through an HTTP proxy only, and `allowLocalBinding` and `allowUnixSockets` are macOS settings), so `init` writes no setting for it. When `DATABASE_URL` is set and its server does not answer, the two commands stop before the ORM tool, exit 3 and say that migrations and database tests run outside the sandbox, by the owner or the CI. `drizzle-kit generate` needs no connection and is unchanged. The sandbox guide (and its French translation), the notes of `init` and the `persistence`, `parallel-work` and `story` skills say it.

**`check` reports a slice the started application cannot run: a job nobody registers, a system actor nobody grants, a permission nobody holds under relationships.** Three rows of a trial were marked done with every spec and `verify` green, yet the started application could not do them. Two rules are new and one reads more:

- **`scheduling/job-registered`** (an error): in the explicit style, the class of a job (`application/scheduling/*.job.ts`) or background job (`application/background/*.background-job.ts`) that no other file outside the tests registers (`.handledBy(..)`, `.register(..)` or `new`) is reported. The declared style registers by decorator, which `declarations/role-declared` already requires.
- **`authz/system-actor-granted`** (an error): under relationships, a `systemActor(<name>)` of a context (a string literal, or `<Class>.name`) in a file that sends a command or a query not declared public needs the subject `system:system:<name>` in a file of `platform/auth/relationships/`. Without it the command is refused with FORBIDDEN when the application runs, which a spec on a fake authorizer never shows. Silent with an authorizer of the project's own.
- **`authz/granted`** now reads relationships too (a warning, as under roles): a permission the schema leaves on the context is held by its operators, and it is reported when no signed-in grant holds it and no source outside the tests writes an `operator` relationship on that context (for a person or a system actor). Silent with an authorizer of the project's own, which may grant what the schema does not, and in a project that makes no person operator of any context in its sources: it provisions its operators out of the tree, and a project as generated stays at zero finding. It stays a warning because a permission granted to nobody can be a state between two slices. A permission derived on an element is not judged, and a schema or a tuple the checker cannot read keeps the rule silent.

**`generate job` wrote the grant of the system actor of a job under a subject the authorizer never matches.** On relationships it wrote `subject: 'system:<job>'`, while the authorizer reads an actor as `<type>:<id>`, here `system:system:<job>`: the job was refused at run time. It now writes `system:system:<job>`.

The use-case and plan-slices skills say a row is done when the started application does it, and name the three rules that prove it.

To move: run `ddd-ts-kit check`. Register each reported job in the module file of its context; in `relate-system-actors.ts` of a project on relationships, write `system:system:<name>` for each reported system actor, and correct the lines `generate job` wrote as `system:<job>`; make somebody operator of each context whose permissions `authz/granted` reports (a provisioning step), or leave the warning while the grant is the work of a later slice.

**`generate projection` works in the explicit style.** It no longer refuses `stack.style: explicit`. On tsyringe the projector keeps `@Projection` and `@On` and the module file of the context includes it with `builder.include(<Name>Projection)`, so its consumer, its processed mark and its metrics are the ones of the declared style. On a platform wired by hand (Nest, or `di: manual`) the projector is a plain class and the module file subscribes it under its consumer name `<context>.<name>`, with the processed mark of any hand-wired consumer (no projection metrics, no listing by `describe`).

**`generate job` and `generate integration-event` with `--local-only` name the command the conductor runs on the trunk.** The refusal (these two kinds write shared files: the job settings and the grant of the system actor, the audited events and the context map) now prints the same command without `--local-only` (and without `--cwd`), then says to commit it there, run `merge-trunk` in the worker's branch and fill the TODOs, as the refusal of a missing repository already does. The `parallel-work` and `plan-slices` skills and the parallel-work guide (and its French translation) plan a job or an integration event of a row as a conductor step before the worker's row, the contracts first. The shared part is not split: the registries stay the conductor's.

**`worktree`, `worker-scope` and `story-scope` cut the branch of the new worktree with `--no-track`.** A worker's branch needs no upstream, and recording one writes `.git/config`, which the Claude Code sandbox keeps read-only for the length of a session (`git worktree add -b` failed with "unable to lock .git/config" and left a branch without a worktree). The three commands now succeed there. Their default worktree already resolves under `.worktrees/` of the main checkout wherever they run, from inside another worktree too; specs on temporary repositories (a read-only `config.lock`, a run from a worktree) pin both.

**The codec `generate aggregate --event-sourced` and `generate domain-event` write now declares an event without data in the shape `docs --stored-events` accepts.** The generator wrote `interface LedgerCreditedData {}`, which the command refuses ("declares no member"). It now writes `type LedgerCreditedData = Record<string, never>;`, which is recorded as it stands; an event that carries fields gets an `interface` with them, as before.

To move: nothing for a codec already filled. A generated codec you left with an empty `interface XData {}` for an event that carries nothing: write `type XData = Record<string, never>;`.

**The guard refuses a git command that skips the hooks of the project.** A headless session committed with `git commit --no-verify` and nothing stopped it, though the pre-commit and commit-msg hooks are the local gate of the pipeline. The guard now refuses `--no-verify` on `git commit`, `push`, `merge`, `pull` and `rebase` (also its unambiguous abbreviations), `-n` on `git commit` (alone or in a cluster such as `-an`), `git -c core.hooksPath=...`, `git config core.hooksPath`, and `LEFTHOOK=0` or `HUSKY=0` set for a command that runs git. The reason says the hooks are the local gate; in `advise` mode it asks, with `guard: "off"` it is silent. The commit-discipline skill says so.

To move: nothing. If a hook is broken, fix the hook or have the project owner skip it in a terminal.

## 0.96.0

**`plan-waves` replays the generator commands of the plan and refuses a name the glossary does not define, before a worker runs the row.** A plan whose rows use words the glossary of their context does not define, with no `--term`, was handed to workers as it was, and each of them was refused at the first command: on a plan of the incident-response example written by a small model, 71 of the 85 commands of one context. Once the rows can be ordered, `plan-waves` now replays their generator commands in a copy of the project, in the order of the waves, and reports, without waves and with exit 1, each name whose words the glossary of its context does not define (`undefined-word`) or that carries a technical word no term holds (`technical-word`), counting the `--term` of the row and of the rows it waits for, with the `--term` to add. The generator itself says which names a command introduces, so the check judges exactly what a worker would meet. The commands the generator refuses for another reason (a missing `--module`, an aggregate no row generates) are listed apart, without failing (`notReplayed` in `--json`). The `plan-slices` skill commits a plan only once `plan-waves` exits 0.

To move: run `npx ddd-ts-kit plan-waves` on a plan in progress, and add to its rows the `--term` it names.

**`merge-trunk` stops before it writes when the trunk changes a path the session cannot write, and no longer counts the sandbox's device nodes as uncommitted work.** In a Claude Code sandbox, a trunk that changed `.claude/settings.json` (mounted read-only) or a folder under an Edit deny rule left the worktree half merged, and the character devices the sandbox binds over denied paths made the cleanliness check refuse. Before the merge writes anything, `merge-trunk` now probes each path the trunk changes (the file, and its folder for the merge to create or remove it); when one is not writable it stops with nothing changed, names the paths and exits 3, the code `init` uses: the owner runs the same command from a terminal outside the sandbox. Untracked character devices are ignored by the cleanliness check; any other untracked or modified file still refuses. The `parallel-work` and `story` skills say that a merge of a trunk that changes the settings of the project is the owner's.

**`generate context` and `init --context` refuse a bounded context named `schema`, on every ORM.** On Prisma the models of a context live in `prisma/schema/<context>.prisma`, beside the main file `prisma/schema/schema.prisma` (the generator of the client, the datasource and the tables of the platform): a context named `schema` would have written its models into that shared file, which the guard already read as the file of no context. The name is refused before anything is written, with the reason and a name to use instead. It is refused on every ORM, not on Prisma alone: `init --force` moves a project to another ORM, and the word names the storage, not a capability of the business. `schema-registry` and other names that only hold the word are accepted.

**`init` run again on a Prisma project laid out before 0.95 keeps its one `prisma/schema.prisma`, says how to move it, and `generate repository` waits for the move.** On a project whose schema was the one `prisma/schema.prisma` of 0.94, `init` 0.95.0 wrote a fresh `prisma/schema/schema.prisma` beside it (a second generator and datasource), while `prisma.config.ts` still named the old file, and the `git mv` of the To move of 0.95.0 then failed on its target. While `prisma/schema.prisma` is there and `prisma/schema/schema.prisma` is not, `init` now writes neither `prisma/schema/schema.prisma` nor `prisma.config.ts`, keeps `db:client` on the one file (under `--force` too), and its notes give the steps of the move with each context of the project and the file its models go to. The move stays the team's: it parts the models by their `@@schema` and edits a config and a script the team may have changed. `generate repository` refuses to write the model of a context until the move, with the same steps: Prisma would not read `prisma/schema/<context>.prisma` while `prisma.config.ts` names the one file.

To move: the two To move lines of 0.95.0 now run in either order. A project that already ran `init` 0.95.0 deletes the `prisma/schema/` folder it wrote (it holds only that fresh `schema.prisma`) before `mkdir prisma/schema && git mv prisma/schema.prisma prisma/schema/schema.prisma`.

**`init` allows by name the install scripts the stack needs, the regulated profile pins them after the first install, and `doctor` reports one a bump left unreviewed.** `@prisma/engines` (under `--orm prisma`: it downloads the schema engine `prisma migrate` and `db:client` run) and `@confluentinc/kafka-javascript` (under `--broker kafka`: it downloads the prebuilt native client, or builds it, and the client does not load without it) go into `allowScripts` of `package.json` under npm and into `allowBuilds` of `pnpm-workspace.yaml` under pnpm. Under pnpm, the default package manager, nothing allowed them: pnpm 12 skipped both scripts at every install, so a project on Kafka had no native client (Prisma fetches its engine at first use). Under npm 11.19 the scripts ran, but every install listed them among the scripts not yet reviewed, which npm says a later release blocks. The entries are by name: npm accepts only a name or exact versions (it drops `^7.10.0` with a warning), and the versions are known once the install resolved the ranges. An entry the project has for one of these packages, a pin or a denial, is kept, even under `--force`, and a denial is said. The other install scripts an install lists (esbuild, `@swc/core`, `unrs-resolver`, `protobufjs`, `@parcel/watcher`, lefthook, the preinstall of `prisma`) are left to the team: the kit needs none of them. Under `--agent-profile regulated`, the notes of `init` ask the owner to pin both after the first install, `npm install-scripts approve @prisma/engines @confluentinc/kafka-javascript` turning each name into the installed version (under pnpm, `'<package>@<version>': true` in `allowBuilds`), and say that a bump of one of them then needs the same step once its new script was read. `doctor` reads the version installed against that list: `install-script <package>` is `missing` without an entry (`init` adds it), `other version` when only pins of other versions exist, with the `approve` and `rebuild` commands, both failing `--strict`, and `written otherwise` for a denial, which does not.

To move: run `npx ddd-ts-kit init` again on a project on Prisma or Kafka: it adds the two entries (a pnpm project with an `allowBuilds` block of its own is told what to add). Then, on pnpm, `pnpm rebuild @confluentinc/kafka-javascript @prisma/engines` runs the scripts the earlier installs skipped.

**`init --agent-profile regulated` and the sandbox guide now say that the `permissions.allow` rules of the project apply only in a workspace trusted on the machine.** A headless `claude -p` run in a workspace never trusted (a fresh clone in CI, a scripted agent run) ignores the `allow` entries of `.claude/settings.json` and prints `Ignoring N permissions.allow entries` on stderr, while `deny` and `ask` still apply; this was checked on Claude Code 2.1.311. The notes of `init` and `docs/guides/agent-sandbox.md` give the two ways to trust a workspace (open it once interactively, or `projects["<root>"].hasTrustDialogAccepted` in `~/.claude.json` of the account that runs it) and say that a git worktree uses the trust of its main checkout (Claude Code docs; not probed). `doctor` does not report the trust: it would have to open `~/.claude.json`, which also holds account data.

**A worker is no longer locked out because `verify-slice` regenerated the derived files.** `verify-slice` runs `regenerate` in the worktree of a worker, which rewrites the derived files outside its context (`clients/`, `docs/behaviour/`, `docs/context-map.md`, `openapi/`, `docs/integration/`). When the worker had run inline code in the same stretch (for example `verify-slice --json | node -e ...`), the guard read those files as its own writes outside the scope and refused every Bash and Edit call until the conductor restored them. The guard now leaves what `regenerate` rewrites out of the files it watches after inline code; any other file outside the scope still stops the worker. Workers still commit their derived files with the slice, as `parallel-work` says, and `merge-trunk` still takes the trunk's side and regenerates.

**The spec that `generate aggregate --event-sourced` writes uses the builder it is generated with, so the deadcode gate of the project stays green on the trunk.** The builder (`test/builders/<aggregate>.builder.ts`) was written with no importer: the generated spec built its aggregate through `create` and `givenEvents`, so `npm run deadcode` (knip) reported `Unused files` on the builder until a later row first used it. The spec now has a test that loads the aggregate through its builder (state of its birth, no event recorded), the way the state-stored spec already did. The state-stored aggregate needed no change: its spec built every case through its builder.

To move: nothing for a project already generated. Re-running the generator on a new aggregate writes the spec with the builder.

## 0.95.0

**The bare project of a wide stack passes its lint.** With `--audit on` and a tenancy, `src/platform/event-sourcing/create-event-sourcing.ts` imported `ExecutionScope` without using it, an error of `@typescript-eslint/no-unused-vars`; it is imported only where it is used, without the audit. On a composition by hand (manual or Nest DI), `composeApplication` grew a line with each option, and with audit, Sentry, presentation, Nest routes, files over HTTP, an external broker, rate limiting and Redis it reached 31 lines, over the limit of `clean/function-size`: the boundary of the HTTP server is now built by a function of its own, `boundaryOf`, placed under it. To move: a project whose lint reports either finding drops the import, or moves the `httpBoundary({...})` literal of `composeApplication` into a function `boundaryOf(platform, options, presentation)` placed under it.

**`generate context` writes the three cells of each glossary row and the sentence of its classification.** `--term "<Term>=<meaning>|<not to be confused with>"` fills the "Not to be confused with" cell, on every generator that takes `--term`; a pipe is the one character a cell of the table cannot hold, so it never clashes with a meaning, and a second one is refused. `generate context --reason "<one sentence>"` writes the line under `## Classification` in place of its `TODO(domain)`. The `bootstrap` skill passes both, so the draft `docs/architecture/glossary.md` is deleted without losing a cell.

**Under a tenancy, the identity preset declares its context the control plane of the tenants instead of writing seven suppressions, and a fresh project prints the passing line its `AGENTS.md` names.** `generate context identity --preset identity` with `--tenancy shared-table` wrote a `ddd-ts-kit-disable-next-line tenancy/scoped-statement` in each of the seven adapters of the context, and `check` printed `0 errors, 0 warnings, 7 suppressions` where the guide of the project gives `0 suppressions` as the line of a pass. A context now says where it stands against the tenancy of the project: `"tenancy": "control-plane"` under `contexts.<name>` of `ddd-ts-kit.config.json`, for a context that decides who belongs to which tenant and whose tables belong to none. `tenancy/scoped-statement` does not judge its adapters, `generate repository` confines none of its repositories (unless `--tenant-scoped` is passed), `governance/recorded-deviation` asks for the entry `contexts.<name>.tenancy` of `deviations` with its decision record, and `config/valid` reports another value. The preset writes the key, the entry and its record `docs/adr/NNNN-<context>-is-the-control-plane-of-the-tenants.md`, and its adapters carry no suppression on Drizzle, Knex and Prisma (it is not written for TypeORM). The `persistence` skill says to declare such a context rather than suppress its statements.

To move, optional since the suppressions keep passing: in a project that ran the preset under a tenancy, add `"tenancy": "control-plane"` to the entry of the identity context under `contexts`, add `{ "what": "contexts.identity.tenancy", "adr": "0001", "reason": "The identity context is the control plane of the tenants: it decides who belongs to which, and its rows belong to none of them." }` to `deviations` (the number of the record the preset wrote), then remove the seven `ddd-ts-kit-disable-next-line tenancy/scoped-statement` lines of `src/contexts/identity/infrastructure/persistence/`. `check` then prints `0 suppressions`.

**`init` no longer stops midway when a sandbox protects a path: it writes every other file and gives the command to finish.** Under the sandbox of Claude Code, which the regulated profile turns on, the agent cannot write `.claude/settings.json` nor `.claude/hooks/`, and `init` stopped with `EEXIST` after part of its files, leaving a project that could not be verified. It now leaves out each file it cannot write, lists it under `unwritable` (and in `skipped`) of its report, a dry run included, and ends with a note that gives the same `init` to run from a terminal outside the sandbox: it writes the missing files and keeps the ones written. It exits with the new code 3, so that a script or an agent never reads a half-written project as done. A file the sandbox masks with a device is reported as unwritable, no longer as an existing file to keep. Every command that writes files (`generate`, `docs`, `sdk`, the moves) reports a protected path the same way and exits 3, and then deletes nothing, so that a move whose target is protected loses no file. The `bootstrap` skill hands the real `init` and `npm run hooks:install` to the owner in a sandboxed session: the agent runs the dry run and shows the command, the owner runs `init`, the agent resumes at `npm install`, and the owner installs the git hooks before the first commit.

**`generate --help` shows `[--module <module>]` on every kind that takes it, and the other kinds refuse `--module`.** In a context divided into modules of its model, the generator refuses a file of a layer written without `--module`, yet no kind showed the flag in its usage: an agent that read `generate --help --json` left it out. The usage line of the 31 kinds that write the files the modules divide (the model, the use cases, their routes, ports, adapters, gateways, policies, events, jobs and projections) now ends with `[--module <module>]`, `generate --help --json` gives `writesInModules` for each kind, and the note of `--module` says that a context with modules requires it. A kind that writes only what the context keeps aside or what lies outside the contexts (`builder`, `test-world`, `route-group`, `guard`, `schema`, `e2e`, `service`, `module`, `context`, `acceptance`, `worker`, `adr`) refuses `--module` instead of ignoring it: `generate service servicing --module ledger` was accepted with no effect, and `generate guard ... --module` wrote the spec of a guard kept at the level of the context into the module. The plan-slices and scaffold skills say which commands carry it.

To move: drop `--module` from a command of one of those twelve kinds, in a plan or a script.

**Under the sandbox of Claude Code, `docs:generate` and `acceptance --lock` write their files again, and the regulated profile lets the agent install the stack `init` chose.** The sandbox turns an `Edit` deny rule into a path no shell command writes, so the deny rules `init` wrote on the generated contracts and the lock of an acceptance (`Edit(./openapi/**)`, `Edit(./docs/integration/asyncapi.*)`, `Edit(./docs/integration/event-catalog.md)`, `Edit(./test/acceptance/*.acceptance.lock.json)`) made their own generators fail with `EROFS`. They are `ask` rules now, which keep the Edit tool off the files without reaching the sandbox; the guard of the plugin still refuses a hand edit of them, and now of the forms of `openapi/forms/` too. `init --agent-profile regulated` derives the sandbox from the stack: `sandbox.filesystem.allowWrite` holds the cache of the package manager (`~/.npm`, or the store and the cache of pnpm) and `~/.cache/prisma` under `--orm prisma`, and `sandbox.network.allowedDomains` gains `binaries.prisma.sh` under Prisma and `github.com` and `release-assets.githubusercontent.com` under `--broker kafka`, where the prebuilt binary of the Kafka client comes from. A list the project already holds gains the entries it lacks, and `doctor` names them. The notes of `init` say that the owner runs the first install outside the agent (a path missing when a session starts stays read-only for that session), that the Kafka client built from sources needs more than the sandbox allows, and that a sandbox the managed settings require ignores these entries of the project file, which then go into the managed settings. `docs/guides/agent-sandbox.md` says the same.

To move: run `npx ddd-ts-kit init` again. It takes the four deny rules out of `permissions.deny` and asks for them instead, and under the regulated profile it adds the paths and the hosts of the stack to the sandbox block. Then run the first install yourself, outside the agent.

**The guard no longer refuses `cd <worktree> && git add <verdict> && git commit`, nor `sed -n` on a verdict.** A command that names the lock of an acceptance or a verdict of the `acceptance-judge` agent was refused as soon as one of its programs was not a reader, so a chain that started with `cd` could not version a verdict, and `sed -n 1,30p` could not read one. `cd`, `pushd`, `popd`, `pwd`, `true` and `test` now touch nothing, and `sed` without `-i` (nor a script that writes with `w`, `W` or `e`), `awk` whose program writes nothing (no `>`, pipe, `system`, `@include` nor script file), `less` without a log file and `jq` read. A redirection to a file is still a write. The rules of a worker now follow `pushd` and `popd` as they follow `cd`, to judge where its commands write.

**Under Jest, `pending(...)` of `@ddd-ts-kit/testing/e2e` reads a failed assertion of `node:assert` as an assertion.** Jest runs a spec in a vm context, and `node:assert`, a core module, throws its `AssertionError` from the outer realm: it is not an instance of the `Error` the kit sees there, so `pending` stopped before it read its name, and a scenario waiting for its route, failing on `expectStatus` as expected, was reported as a broken scenario (`The scenario stops on AssertionError [ERR_ASSERTION]: ..., not on an assertion`). `pending` and `eventually` now read a failure by its shape (a string `name` and `message`), never by `instanceof Error`, and `expectRefusal` and `thenError` name the class of an error of another realm instead of printing it whole. A cycle of causes no longer makes `pending` loop.

**`ddd-ts-kit check` reads the source root as git sees it: an ignored folder or a dot-directory in a context is no longer reported by `tree/closed`.** The Claude Code sandbox leaves `.claude/.cc-writes/` in a folder where a command ran, and a context that held it failed `tree/closed` (and with it `check:arch` and `verify`) with a fix that offered to declare `.claude` as a module. The walk of the source root now leaves out the entries git ignores and no one tracks (a `.gitignore`, `.git/info/exclude`, the global excludes file of the machine), listed by one `git ls-files` call, and every dot-directory under the contexts directory. A tracked file is read even when an ignore pattern names it. Outside a git repository, or when the project sits in a folder its enclosing repository ignores, every entry is read as before, the dot-directories of the contexts left out. `tree/documented-paths` no longer reports a path of `docs/architecture` that goes through a dot-directory of a context either. What git ignores under the source root is no longer read by any rule of `check`, so a source the project keeps out of git is not judged either.

**`generate domain-event` on an event-sourced aggregate adds only what the aggregate and its codec lack.** Run on the birth event that `generate aggregate --event-sourced --birth <Event>` already wrote, it imported the event a second time and declared a second applier, and the aggregate no longer compiled; a second run on a later event did the same. Each piece (the member of the union of events, the entry of `appliers()`, the apply method, the import, the data type and the entry of the codec) is now added only when it is absent, in a context and in a module alike, so a command run twice leaves both files as they are.

**`todo` reads the markers of every kind of file, the Prisma schema included, and `verify-slice` stages the schema and the behaviour pages the generator wrote for the slice.** `ddd-ts-kit todo <context>` read only the TypeScript and Markdown files of the context: the `TODO(domain)` that `generate repository` leaves in `prisma/schema.prisma` (the columns of the new model) went unnoticed, and the row was committed with it. `todo` now reads the schema of Prisma, every file of `prisma/schema/`, a marker of `prisma/schema/<context>.prisma` under that context and another under the context whose database schema holds its model (`todo <context>` lists it), and, for the whole project, the migrations (`migrations/`, `prisma/migrations/`), the pages under `docs/` and the configuration at the root (`docker-compose.yml`, the config files of the ORMs, `ddd-ts-kit.config.json`), not the lockfiles. The other ORMs already wrote that marker in the tables file of the context, which `todo` read. `status`, `story-check` and the state of a worker count the same markers. `verify-slice` listed `prisma/schema.prisma` and `docs/behaviour/*` as left out, for a person to decide about, while the generator and `regenerate` had written them for the slice. It now stages the pages of `docs/behaviour/` (the page of the context, the application and the index, but not the page of another context), and the main Prisma file `prisma/schema/schema.prisma` when its one change since `HEAD` is the database schema of the context joining the datasource (the models are in `prisma/schema/<context>.prisma`, staged with the context), or the schema index of the platform (`<platformDir>/database/schema.ts`, for Drizzle, Knex and TypeORM) when every line changed there is the import of the tables file of the context. Any other change in the same file keeps it left out. The working migration of a Prisma worker (`prisma/migrations/<number>_working_<what>/migration.sql`) is staged like those of the other ORMs.

**A folder whose name starts with a dot under the contexts directory is never a context, nor a module.** The Claude Code sandbox leaves `.claude/.cc-writes` in a folder where a command wrote, and `ddd-ts-kit docs` wrote `docs/behaviour/.claude.md` for it, `list`, `status` and the other commands that walk the contexts read it as an undeclared context, and the ESLint plugin located its files in a context named `.claude`. The listing of the directories of a workspace now leaves out every name that starts with a dot, which covers the contexts and the modules of a context for all commands, and the location of a file by its path (CLI and ESLint plugin) no longer reads a dot folder as a context. `check` already left such a folder out of its walk.

**`merge-trunk --abort` works when the regeneration rewrote a file the merge had staged.** `merge-trunk --continue` now stages again the derived files (and the migrations, decision records, lockfile) its steps rewrite, so a `CONTEXT.md` the trunk changed is no longer left staged then modified, which made `git merge --abort` and `git reset --merge` fail with `Entry '...' not uptodate`. `--abort` also restores, and names, such a file when it was modified after staging; if any other tracked file was changed by hand, it refuses (exit 2) and says which, and discards nothing.

**`generate command --aggregate --local-only` names the repository to generate first, and plan-slices plans it.** A worker that runs a command on an aggregate with no repository is refused under `--local-only`, because the command would create the repository and write shared files (the schema index, the grants). The refusal listed those files and never said the cause. It now adds the exact command for the trunk, `ddd-ts-kit generate repository <context> <Aggregate>`, with no flag: it reads the aggregate and writes the event store adapter, with no table, when the aggregate is event-sourced. `generate aggregate` does not write the repository, by design: the repository is a row of the skeleton. The plan-slices and parallel-work skills now say that every aggregate a command row names has a skeleton row generating its repository (and `--event-sourced` on the aggregate when it is), which the command rows depend on.

**A name that says a term of the glossary passes the technical-word checks: `ScoringModel` once `Scoring model` is a row of CONTEXT.md.** The generator and `language/no-technical-name` refused every name carrying `Model`, `Data`, `Manager` and the other technical words, even when the business itself names the concept so: the scoring model of credit risk, a regulated object with its own validation and versioning, or the copy of data of the GDPR right of access. The team had to rename it to please the linter, and the code drifted from the words of the examiner. A technical word now passes when the words of the name around it say a whole term of the `## Ubiquitous language` table of the context, inflected or not: `Scoring model` holds `ScoringModel`, `ScoringModels` and `ScoringModelVersioned`, `Copy of data` holds `CopyOfData`, and `PricingModel` or `InvoiceData` are still refused. The generator and the checker judge the name with the same function. The refusal says how: use the business word, or, when the business does say it, define the term in CONTEXT.md, in the same command with `--term "Scoring model=<meaning>"`. A concept name ending with `Data` or `Info` is now refused by that one check, with its message, instead of the earlier "names a technical bucket"; the name of a port, a gateway, a policy, a route or a projection keeps the bucket check on its last word, which a term of the glossary lifts the same way. The clean-code and glossary skills say when to add such a row: when a domain expert uses the term, never to silence the rule.

**`generate adapter <context> <Port> --kind simulated` writes an adapter that answers in memory, for an environment whose outside system is simulated.** A sandbox, a demo or an environment kept for examiners had no supported way to run a port without its provider: the remote adapter threw "has no transport yet", and the fake of `test/fakes/` is test code that production code may not import. The new kind writes `infrastructure/external/simulated-<port>.adapter.ts` and its spec: a class of production code that answers as the outside system would, from records it keeps, through the translator of `infrastructure/anti-corruption/` when the system has one. It is bound to the port like the remote adapter, kind `external`, with no policy of its own (`--decorators` is refused): `@Adapter(<Port>, { kind: 'external' })` in the declared style, `builder.bind(<Port>).toClass(Simulated<Port>).as('external')` in an explicit module on tsyringe, a note that says what to instantiate where the context is wired by hand (manual, Nest). A port keeps one adapter: in the declared style a remote adapter is refused while a simulated one is declared, and the other way round, and the refusal says which file to remove. The import graph still refuses a fake of the tests imported by production code (`not-to-test`).

To move: a port whose remote adapter only throws while its provider is simulated: delete that adapter and its spec (and its binding in an explicit module), then run `npx ddd-ts-kit generate adapter <context> <Port> --kind simulated` and answer its operations the way the outside system would, as its fake does in the tests.

**`generate value-object`, `error` and `domain-error` write in the shared kernel, and its terms have a glossary the checks read.** `generate value-object shared-kernel Money --term "Money=<meaning>"` writes `src/shared-kernel/money.vo.ts` and its spec beside it, at the root of `sharedKernelDir`, as the tree lays the shared kernel out, and starts `src/shared-kernel/CONTEXT.md`, the glossary of the shared kernel, with the term. `generate error shared-kernel InvalidMoney forCents` writes the refusal of such a value at the same root, its code in `shared-kernel.codes.ts` (`SharedKernelCodes`) under `"stack.refusals": "named"`; `domain-error shared-kernel` does it under `classes`, and now takes `--term` as the other kinds do. `language/glossary-term` names the value objects (`*.vo.ts`) and, under `named` or `factories`, the refusals (`*.error.ts`) of the shared kernel after that glossary, and `errors/known-code` counts the codes the shared kernel lists. Any other kind given `shared-kernel` is refused with what the shared kernel holds and the contexts to use instead, where it said `Unknown context "shared-kernel"`. The three kinds now declare a shared write (`generate --help --json`): `--local-only` refuses them in the shared kernel, and a worker runs them in its own context. The guard refuses a new `*.vo.ts` or `*.error.ts` of the shared kernel written by hand, with the command that generates it.

To move: a project whose shared kernel holds a value object or, under `named` or `factories`, a refusal is now judged by `language/glossary-term`: write `src/shared-kernel/CONTEXT.md` with a `## Ubiquitous language` table that defines their words, or run the next `generate value-object shared-kernel ... --term` that creates it.

**On Prisma, each bounded context keeps its models in a file of its own, `prisma/schema/<context>.prisma`, which its worker changes with the mapper on its own branch.** A worker of `parallel-work` that added a state field to an aggregate needed a column, but `prisma/schema.prisma` held the models of every context and the guard refused it to the worker as a shared file: the conductor wrote the column on the trunk, where the mapper of the context had not changed, and the trunk failed to typecheck until the column was reverted. Drizzle, Knex and TypeORM already kept the tables of a context in its own `infrastructure/persistence/`; Prisma now does the same with its multi-file schema. `init --orm prisma` writes `prisma/schema/schema.prisma` (the generator of the client, the datasource and the tables of the platform: outbox, background jobs, process instances, event store, audit trail) and `prisma.config.ts` names the folder (`schema: './prisma/schema'`); `generate repository` writes the model in `prisma/schema/<context>.prisma`, started with the models region of the context, and adds the database schema of the context to the datasource on the first repository of the context only. The guard lets the worker of a context write `prisma/schema/<context>.prisma`, and refuses it the file of another context and `prisma/schema/schema.prisma`; `generate --local-only` treats it as a file of the context, `verify-slice` stages it with the slice (and the main file only when its one change is the context joining the datasource), and `todo <context>` lists its markers; `worker-scope` briefs the worker on Prisma that the models of its context are its own, a stored field changing its column and the mapper in one commit. The identity preset lays its models out in `prisma/schema/identity.prisma`, `privacy/declared-field` and `persistence/no-file-content` read every `.prisma` file of `prisma/schema/`, and `db:client` derives the schema of the tests from the folder (`prisma migrate diff --to-schema prisma/schema`).

To move: in a project on Prisma, `mkdir prisma/schema && git mv prisma/schema.prisma prisma/schema/schema.prisma`; in that file write the `output` of the generator one level up (`"../../generated/prisma"`), and move the models and enums of each context (those whose `@@schema` is the schema of the context) out of the `// ddd-ts-kit:models` region into `prisma/schema/<context>.prisma`, between a `// ddd-ts-kit:models` and a `// /ddd-ts-kit:models` line of their own, then remove the empty region from the main file. In `prisma.config.ts` set `schema: './prisma/schema'`, and in the `db:client` script of `package.json` replace `--to-schema prisma/schema.prisma` by `--to-schema prisma/schema`. Run `npm run db:client`: the tables are the same, so `npm run db:generate` finds no change and no migration is needed.

## 0.94.1

**The glossary step finds the terms of the identity preset in the plugin, and every row of a context with modules passes `--module`.** The `glossary` skill sent an agent to `packages/cli/src/presets/identity-terms.ts`, a file of the repository of the kit: the package ships no source, and before the bootstrap a project has no CLI installed. The terms are now on a page beside the skill, `identity-preset.md`, kept equal to the rows the preset writes by a spec of the CLI. The `plan-slices` skill said that what the modules share stays at the level of the context, and a plan of a context with modules then left `--module` out of its policies, integration events and integration handlers, which the generator refuses there: it now says that every generator command of such a row carries `--module`, and that the generator keeps the shared files (codes, permissions, the schema of the database, route groups, fakes and builders) at the level of the context by itself.

## 0.94.0

**The rules of `@ddd-ts-kit/eslint-plugin` run whole when Oxlint loads the plugin as a JS plugin.** Oxlint hands a rule no type information and a parser that parses nothing. `naming-business-name` threw there, which stopped every rule of the kit on the file (303 of 985 files of a generated application); it now reads the names of the code when the linter offers no parser services, as it already did without a program. `clean-no-commented-out-code`, `language-declared-vocabulary`, `authz-declared` and `ports-implements-never-extends`, which parse a text of their own, reported nothing under Oxlint; they now parse with the parser of typescript-eslint when the run configured none (or only the stand-in of Oxlint). The findings under ESLint do not change. On the copy of the example with every rule of the catalogue broken once, Oxlint reports the 77 injections ESLint reports, each at the same place.

**Under relationships, a permission modelled on an element is no longer held by the operators of the context, and a use case on the context says so.** `generate command` and `generate query` write, next to the `{ type: 'context', id: '<context>' }` resource, a `TODO(domain)` naming the element the permission is checked on (`{ type: '<aggregate>', id: <message>.<aggregate>Id }`), so `ddd-ts-kit todo` and `status` list it until the resource names it; a search keeps the context. The schema written by `init` derives on `context` only the permissions no element derives: the elements go in `elements` of `relationships/relationship-schema.ts`, and a permission derived there leaves the operators of the context, where it used to be granted to all of them whatever the element. The access-control skill and the guide on choosing access control say when the context is the right resource.

`authz/resource-modelled` (an error under relationships, from the first day) reports a requirement whose resource is the context for a permission the relationship schema derives on an element type, and a search whose gate is on the context while its scope asks the same permission derived on the element; it reads the types written in `elements` or in place in `defineSchema`, and reports a schema or a resource it cannot read.

To move: in a project generated earlier, open `relationships/relationship-schema.ts`: move the types of the elements out of `defineSchema` into an `elements` object and derive on `context` only `permissions.all()` minus the ids those elements derive (the template of `init` shows it), then replace each context resource by the element the use case is about. A search whose requirement and scope use the same permission needs two: one on the context, one on the element. Then run `ddd-ts-kit check`: name the element in each reported requirement, give a search two permissions (one on the context to run it, one on the element for the scope), or make the schema readable (an object literal given to `defineSchema`, derived keys as `[<context>Permissions['<permission>'].id]`).

**`generate job` under relationships relates the system actor of the job as `system:<job>`, not `system:system:<job>`.**

The tuple written in `platform/auth/relationships/relate-system-actors.ts` carried the prefix
twice, so the actor of the job (`system:<context>.<job>`) held no right and every run was refused
`FORBIDDEN` before its handler ran.

To move: a job generated before this version has `system:system:` in its line of
`relate-system-actors.ts`: remove one `system:`.

**With the identity preset, a per-tenant job runs for every organisation, including one opened after the process started.**

Until now `init` gave the scheduler the tenants of `TENANTS`, read once when the process
started: an organisation created later (a sign-up, an operator) never got the run of a per-tenant
job (a reminder, a purge, a deadline), with no error and no log. `init` under tenancy now writes
`src/platform/composition/tenant-directory.ts`, the one place the scheduler's `TenantDirectory`
is made; `--preset identity` (and `generate context --preset identity`) replaces it by a
directory that reads the organisations of the identity context from the database at each
occurrence, on Drizzle, Knex and Prisma (the preset refuses TypeORM). A project with tenancy and
no source of tenants keeps `TENANTS`, and the documentation says plainly that a fixed list misses
a tenant created later. The adapter is integration-tested on PostgreSQL, including an
organisation opened after the first read and, on tsyringe, its run of a per-tenant job.

`privacy:erase` and `privacy:export` go through the same directory: with the identity preset they
reach the organisations of the database, not only the tenants of `TENANTS`, and they refuse to
run when the directory lists none.

A per-tenant run reading its own tenant only is now proven end to end on the real tenant-scoped
repository of a generated multi-tenant project, and the generated job spec points to that
pattern where it kept an `it.todo`.

To move: a project with tenancy regenerates its platform; a project that already holds the
identity preset and tenancy replaces `src/platform/composition/tenant-directory.ts` (or, before
this version, the `InMemoryTenantDirectory` bound in `compose-application.ts` or
`lay-foundations.ts`) by a directory over `<Orm>OrganisationTenantDirectory`. `TENANTS` is no
longer read once the organisations are the tenants.

**`scheduling/tenancy-declared` reports a job that does not say whether it runs per tenant or globally.** In a project whose `stack.tenancy` is not `none`, the options of every `@Scheduled(..)` and `builder.job(..)` must carry `tenancy: 'per-tenant'` or `tenancy: 'global'`. A job that leaves it out runs globally, in no tenant, as a system actor that names none, and a tenant-scoped repository refuses it at run time (`NoCurrentTenantError`) while the specs on fakes stay green. An error from the first day, with the fix in the message; what the checker cannot read (options that are not an object literal, a spread, a `tenancy` that is not a literal) is reported, never passed. The jobs `init` registers in the platform (`files.purge-staged`, `privacy.purge-expired`, `audit.archive`) now write `tenancy: 'global'`, which is what they already did by default.

To move: run `ddd-ts-kit check` in a project under tenancy and add `tenancy: 'per-tenant'` to each reported job that reads or writes tenant data (the `TenantDirectory` must be bound so the scheduler can list the tenants), or `tenancy: 'global'` to a job that works across tenants and reaches no tenant-scoped repository.

**The mutation job of a merge request or pull request in a generated project reuses the report of the night.** The night runs Stryker without a base, so it writes `reports/mutation/mutation.json` and no incremental file, and the job of a change that downloaded that report found nothing to reuse: it logged "No incremental result file found" and ran every mutant. The job now copies the json report to `reports/mutation/incremental.json` before it runs, the same object Stryker reads back, and mutates what the change touches only. On the example of the kit this takes the job from 1,133 s to about 140 s.

To move: in a project generated before this version, add one step after the download of the report of the night, in the `mutation-changed` job of `.github/workflows/ci.yml` or the `mutation_changed` job of `.gitlab-ci.yml`: `if [ -f reports/mutation/mutation.json ]; then cp reports/mutation/mutation.json reports/mutation/incremental.json; fi`. Or run `ddd-ts-kit init` in a scratch copy and take the job from there.

## 0.93.0

**The behaviour pages of `ddd-ts-kit docs` no longer open a rule with the row ids and criteria of its title.** A regression spec named `#FIX1 escalates ...` or an acceptance scenario named `#US1.04 AC1 a member declares ...` is written in `docs/behaviour/` as `escalates ...` and `a member declares ...`, read with the patterns `acceptance` uses for rows and criteria; the rest of the title is kept as it is.

To move: run `ddd-ts-kit docs` once to rewrite the pages.

**`todo` and `status` no longer count an `it.todo` in `test/architecture/extractable.spec.ts`.** The spec kept one in the branch for a project with no context, which never runs once a context exists, so a gate that wants nothing left had to explain it away. The branch is now a passing case, `has no context to wire alone yet`, in the three variants of the template (tsyringe, declared, manual); Jest still gets no table without rows.

To move: a project already generated keeps its `it.todo` until the spec is regenerated, or replace that line by `it('has no context to wire alone yet', () => expect(contexts).toHaveLength(0));`.

**`measures` reads a history of any size and finds the merge that closes a story, whatever its subject.** `runGit` no longer stops at the 1 MB of output `spawnSync` allows by default (a git that cannot answer is now an error that says so, not an empty answer that made every story read "not committed"), and `branchCommits` asks the files only of `docs/architecture` and `test/acceptance`, so a store versioned once in the history does not weigh on it. The lead time ends at the close of the story: the first commit of the first-parent history that contains the last commit of the story, whether a merge commit with any subject or a squash; the merge of the trunk into the story branch (`merge-trunk`) is never taken for it, and a story with no report is not closed.

**`status` no longer repeats the `Next:` line of the plan after the build has moved on.** At step 7 (the build) no skill rewrites that line row by row, so it kept naming the first row after all of them were done. `status` now derives the next step from `docs/architecture/slices.md`: the next row ready on the trunk, or `7 build done: close step 7 in docs/architecture/plan.md (Next: done)` once every row is done. The line of the plan is printed beside it when the two disagree, and `planNext` carries it in `--json` (`next` is the derived one). The `start` skill says that at step 7 the line is derived.

**The `biome.json`, `knip.json` and `.gitignore` of `init` ignore what is not the project.** The Claude Code sandbox leaves empty files in the project (`.mcp.json`, `.claude/launch.json`, `.claude/settings.local.json`, dotfiles), and installs under it may write a pnpm store there: `biome format` failed on the empty JSON files and warned on the broken links of `.pnpm-store/`, and Knip failed loading the empty `.mcp.json`. `biome.json` now reads the git ignore file and skips `.claude` and `.mcp.json`, `knip.json` sets `"mcp": false`, and `.gitignore` lists `.pnpm-store/` with pnpm. The guide on sandboxing agents says which files the sandbox leaves, and the read-only `.git/config.lock` to delete outside it.

To move: in a project written before this change, add `"vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true }` and the entries `"!**/.claude"` and `"!.mcp.json"` to `biome.json`, `"mcp": false` to `knip.json`, and `.pnpm-store/` to `.gitignore` with pnpm (or run `init --force`, which rewrites the files).

**`generate service` writes a docker-compose.yml that Docker reads.** The compose service took `"${{service.portVariable}}:3000"` literally, because the templates keep every `${{ ... }}` for the expressions of a GitHub workflow, and `docker compose config` refused it. The port is now `"${PAGING_PORT:-3001}:3000"`: the service listens on the variable of its context, 3001 by default.

To move: a compose file written by an earlier `generate service` holds `${{service.portVariable}}`; replace it with `${<CONTEXT>_PORT:-3001}` (the context in upper snake case).

**A locked regression spec of a fix can be amended by the session, and `acceptance --lock` refuses a spec that fails the formatter or the linter.** The guard used to refuse every write to a locked regression spec, by the session and by sub-agents alike, so the `acceptance-judge` agent never had a new version to rule on and a spec that failed the lint could never be corrected. Now the main session of the fix may write a new version (with the editor tools or a formatter or `eslint --fix` in the shell), a sub-agent still may not; `npx ddd-ts-kit acceptance <code>` reports the change since the lock, and `--lock` takes it only with an `amend` verdict of the judge (a change of layout alone needs none, the fingerprint ignores white space). `acceptance <code> --lock` also runs the formatter (the `format` script, in check mode) and the linter (the `lint` script) of the project on the files it locks, the regression specs of a fix or the acceptance spec of a story, and refuses to lock while they fail, naming the file and what the tool reports. A project without those scripts or tools is locked as before. The `fix`, `story` and `testing` skills say to format and lint the spec before locking, and what the session does when a locked spec turns out wrong.

**`generate job` writes a job that runs once per tenant in a project with tenancy, and `init` gives the scheduler the tenants.** A job without `tenancy` is global: it runs in no tenant, its command carries a system actor that names none, and a tenant-scoped repository threw `NoCurrentTenantError` on every real run, while the generated spec (fakes, a recorded command) stayed green. Under `stack.tenancy`, `generate job` now writes `tenancy: 'per-tenant'` (`--global` writes `tenancy: 'global'` for work across tenants, refused in a project without tenancy), says which it wrote, and its spec runs the occurrence for two tenants. `init` reads `TENANTS` (comma separated tenant ids, validated at start) into `config.tenants`, passes it as `tenants` to `composeApplication` and binds an `InMemoryTenantDirectory` on the scheduler, so a hand-written `tenancy: 'per-tenant'` no longer throws `InvalidJobScheduleError` at boot. `src/main.ts`, the worker and the services pass `tenants: config.tenants`. On tsyringe, `compose-application.ts` was at the size limit of the checker: `ContextSelection` now lives in `composition/context-selection.ts` and, with an HTTP framework, `routesOf` in `composition/routes-of.ts`.

To move: in a project under tenancy, add `tenancy: 'per-tenant'` to each `@Scheduled` (or the `tenancy` key of `platform.jobs.register` on a hand-wired platform) whose use case reads a tenant-scoped repository, list the tenants in `TENANTS` of the environment, and run `ddd-ts-kit init --force` to receive `config.tenants`, the `tenants` option and the binding (or add them by hand: `tenants: new InMemoryTenantDirectory(options.tenants ?? [])` in `kernelModule`, `tenants: config.tenants` in the entry points).

**`generate service` takes the context out of the application of `src/main.ts` and the worker.** The entry point of the service composed the context, but `everyContext` still listed it and `src/main.ts` composed `everyContext`, so the API and the service both subscribed its durable consumers, drove its process store and scheduled its jobs. The root now exports `everyContext` (the full list: the tools, the generated contracts, the end-to-end tests) and `hostedContexts` (every context but those run as services, read from the `extracted` regions `generate service` fills with the module and the routes of the context); `src/main.ts` and the worker compose `hostedContexts`, and `jobSettings(env)` leaves out the jobs of the extracted contexts. `generate service` also writes `test/architecture/hosting.spec.ts`, which composes both roots and fails when a module, a consumer, a process or a job of a service is registered in the whole application, when a consumer is registered twice, or when the entry point of a service does not leave the jobs of the platform to the whole application.

To move: run `ddd-ts-kit init --force` (the new root, `main.ts`, the worker), pass `hostedContexts` as the third argument of `composeApplication` in `src/main.ts` and `src/apps/worker/main.ts`, and for each context already run as a service add its module (its name on tsyringe, its `<context>Module` on a hand-wired platform) and its routes to the `extracted` regions of `compose-application.ts`, its name to the `extracted` region of `src/platform/jobs/job-settings.ts`; copy `test/architecture/hosting.spec.ts` from a fresh project, whose `extracted` region lists the services.

**A service no longer runs the jobs of the platform, and the processes of one deployment share the namespace of their Redis keys.** `composeApplication` always added the audit and privacy modules, so a service written by `generate service` scheduled `audit.archive` and `privacy.purge-expired` (and `files.purge-staged`) with the defaults of the kernel, `enabled: true`, since `jobSettings(env, '<context>')` kept only `<context>.*`: `JOB_AUDIT_ARCHIVE_ENABLED=false` did not reach it, and an archive that removes entries from the database ran onto the disk of the service. The platform jobs now belong to the whole application: `ApplicationOptions.platformJobs` (default `true`) is `false` in the entry point of a service, and `auditModule`, `privacyModule` and `filesModule` (or `registerPlatformJobs` on a hand-wired platform) register their job only when it is on. The lock, the cache, the rate limiter, the relay signal and the Redis job store took `OTEL_SERVICE_NAME`, which a deployment sets per container, so the API and a service held different locks and ran the same occurrence on one database: they now take `DEPLOYMENT_NAME` (`config.deploymentName`, the project name when left out), while `OTEL_SERVICE_NAME` keeps naming the container in the traces. `test/architecture/hosting.spec.ts` composes the root of a service and fails when it registers a job of the platform or of another context.

To move: set the same `DEPLOYMENT_NAME` in every container of a deployment (the cache, the lock and the job store keep their old keys only if it equals the old `OTEL_SERVICE_NAME` of the API); in each `src/apps/<context>/main.ts` add `platformJobs: false` beside `jobs`; run `ddd-ts-kit init --force` for the modules and the configuration, and `openRedis(config)` now reads `config.deploymentName`.

## 0.92.0

**What a method of a Nest controller takes is its signature too: `@Body() body: IssueInvoiceBody` is read into the generated `<context>.controllers.ts`, and `@KitRoute` no longer gives `request`.**
`withAnswers` of `@ddd-ts-kit/http/nest` becomes `withSignatures(controller, { method: { params,
query, headers, body, answer } })`: the DTO class of each part of the request a parameter takes
whole, as `ddd-ts-kit` reads it from the source, and the answer. The bridge validates each part by
that class, so a route no longer depends on `emitDecoratorMetadata`, which tsx and esbuild do not
write: `npm run dev` serves the same validation as the build. A generated Nest controller no longer
builds `paramsSchema` nor `bodySchema`, and its `@KitRoute` holds the refusal codes alone.
`nest/controllers-current` also reports a part taken whole by a type the kit cannot read (an inline
type, an interface, a `Record`) that `request` of `@KitRoute` does not give.

To move: replace `withAnswers(Controller, { method: X })` by `withSignatures(Controller, { method:
{ answer: X } })` where it was written by hand; a project on `--routes nest` runs `npx ddd-ts-kit
docs`, then drops `request` and the schemas it built from its generated controllers.

**Under `"stack.routes": "nest"`, every route generator writes the Nest form: a search, an upload, a form and a representation.**
`generate route` writes a search as a Nest controller, its page given in `@KitRoute` (`request:
{ query }`, `response.body: pageSchemaOf(line)`), where it used to refuse. `generate file-upload`
writes a Nest controller whose method takes `@Upload() file: IncomingFile`, the new parameter
decorator of `@ddd-ts-kit/http/nest`: the kit streams the file and checks it against the `upload`
of `@KitRoute`, which now takes `upload` and `form` as `@Controller` of the kit does; a method that
takes `@Upload()` with no `upload` declared is refused when the routes are built. `generate form`
and `generate representation` write their options at the top of `@KitRoute`, the form typed by the
body class. `nest/no-parallel-pipeline` points `@UploadedFile()` and `ParseFilePipe` at `@Upload()`.
`nest/controllers-current` reads `request: { query }` written short.

**The identity preset is written for Nest controllers too: `init --preset identity --http nest --routes nest`.**
Under `"stack.routes": "nest"`, its twelve routes are Nest controllers built by Nest with the buses it
injects: their parts and their answers read from their signatures into the generated
`identity.controllers.ts`, their summaries, descriptions and refusal codes in `@KitRoute`, the shared
invitation token documented once as before. The module of the context lists those controllers, and
its spec mounts them through the pipeline of the kit, as the spec of each controller does. A
project on `--routes controllers` gets the controllers of the kit as before.

**A Nest project validates with class-validator and writes its routes as Nest controllers, by default.**
`init --http nest` now records `"validation": "class-validator"`, as Nest validates, and
`"routes": "nest"`: `generate route`, `file-upload`, `form` and `representation` write Nest
controllers built by Nest and served by the kit, their parts and answers read from their
signatures. `--validation zod` (or another library) keeps the controllers of the kit, and
`--routes controllers` asks for them on class-validator too. `describe`, `generate e2e` and every
reading of the routes of a context now read the route methods of Nest controllers, and the
generated list of a context holds the Nest controllers of its modules, which it left out.

To move: nothing for a recorded project, which keeps the stack its config says, `init --force`
included. A new Nest project that wants the controllers of the kit passes `--routes controllers`.

**A strategy of Passport authenticates the calls of the kit: `passportPrincipal` of `@ddd-ts-kit/auth/passport`.**
`passportPrincipal(strategy, { actorOf })` runs a strategy of Passport on each request, as
`passport.authenticate` does, and answers the session `resolvePrincipal` hands the pipeline: the
guards of the routes and the permissions of the use cases decide as with any authenticator, on
every door. A strategy of `passport-jwt` or a class of `@nestjs/passport` (given lazily, once Nest
has built it) works as it is; `actorOf` reads the user its verify callback or its `validate`
answered. It fails closed: a credential the strategy fails is a 401, an error, a redirect (a
sign-in flow) or a strategy silent past `timeoutMs` refuses the request, and only a request
without credential, or one the strategy passes, goes on anonymous. The entry imports nothing of
Passport. `nest/no-parallel-pipeline` now points `@nestjs/passport` in a context at it.

**On Drizzle, Prisma and TypeORM, `npm run db:generate` makes the audit trail append-only in the migration that creates it: no statement to paste by hand any more.**

The tools of these ORM write no trigger, so a project with `--audit on` had a `TODO(platform)` asking to copy the statements `npm run db:audit-guard` prints into a migration of its own. `ddd-ts-kit drizzle-generate` now adds them to the migration that creates `audit_entries`, once, and two commands do the same around the tool of the other ORM: `ddd-ts-kit prisma-generate --name <what-it-does>` (`prisma migrate dev --create-only`) and `ddd-ts-kit typeorm-generate <folder>/<what-it-does>` (`typeorm migration:generate` on the compiled data source). A project whose migrations hold the guard already, or without an audit trail, gets the tool of its ORM as before.

Generating and applying a first migration on a real PostgreSQL, which no test did before, found three more things, fixed here: on Drizzle, the platform schemas (`messaging`, `audit`, `event_store`) were never created, so a first migration failed on a new database without a word from drizzle-kit (they are now exported with `pgSchema`); on TypeORM, the migrations were never compiled into the `dist/migrations` the data source reads, so `db:migrate` answered `No migrations are pending` (`tsconfig.json` includes `migrations`, `typeorm-generate` imports its types as types and formats the file, ESLint leaves the migrations a tool writes alone), and TypeORM writes no `CREATE SCHEMA`, which `typeorm-generate` adds at the start of `up`; and the `CREATE SCHEMA` drizzle-kit writes is made `IF NOT EXISTS`, so that a migration applies to a database that has the schema already. A job of the night and of the release now generates, guards and applies the first migration of each of the three ORM on a real PostgreSQL, every gate of the project then run.

To move:

- **A TypeORM project generated before: `npm run db:migrate` never applied any migration.** It answered `No migrations are pending`, since nothing compiled `migrations/` into `dist/migrations`; a database that only `db:migrate` built has none of the tables. Run `init --force` (it writes `tsconfig.json` with `migrations` in `include`, `eslint.config.mjs` that leaves `migrations/**` to the tool, and `db:generate` through `ddd-ts-kit typeorm-generate`); then, in each migration written before, make the import `import type { MigrationInterface, QueryRunner } from 'typeorm';`, add `await queryRunner.query('CREATE SCHEMA IF NOT EXISTS "<schema>"');` at the start of `up` for each schema its tables use (`messaging`, `audit`, the schema of each context), and with an audit trail the statements `npm run db:audit-guard` prints after the creation of `audit_entries`; `npm run build && npm run db:migrate` then applies them. A database built by `synchronize` or by hand is to compare with the migrations before migrating it.
- **A Drizzle project generated before: a first migration failed on a new database** (`messaging`, `audit` and `event_store` never created). Run `init --force`, or add to `schema.ts` `export const messaging = pgSchema(MESSAGING_SCHEMA);` and the same for `AUDIT_SCHEMA` and `EVENT_STORE_SCHEMA`, then `npm run db:generate add-platform-schemas`: `drizzle-generate` now writes every `CREATE SCHEMA` as `CREATE SCHEMA IF NOT EXISTS`, so this migration also applies to a database whose schemas were created by hand; with an audit trail and no guard yet, paste what `npm run db:audit-guard` prints into a custom migration (`npm run db:generate -- audit-guard --custom`).
- **A Prisma project generated before:** set `db:generate` to `ddd-ts-kit prisma-generate --name` (`init --force` writes it); with an audit trail and no guard yet, `npm run db:generate audit-guard` writes an empty migration to paste what `npm run db:audit-guard` prints into.
- A migration that already holds the guard by hand is recognised and left alone by the three commands.

**`init --authn passport` verifies the bearer tokens with a strategy of Passport, and the identity preset runs on it.**
The platform gets `bearer-strategy.ts`, a strategy of `passport-jwt` on the key set the issuer
publishes (`jwks-rsa`, `AUTH_JWKS_URI`), its issuer and its audience, and `actor-of-token.ts`,
which reads the payload with `actorOfClaims`; `create-authenticator.ts` puts them behind the
`Authenticator` port with `passportAuthenticator`, new in `@ddd-ts-kit/auth/passport`, so that the
HTTP boundary, the procedures and the end-to-end tests (credentials signed for the strategy)
authenticate through it. `actorOfClaims`, the reading of claims of `JwtAuthenticator`, is now
exported by `@ddd-ts-kit/auth` without `jose`. The identity preset accepts `--authn passport`.
The option verifies bearer tokens, as `--authn jwt`, with the strategy in the code of the project:
a strategy that reads a cookie or a session is wired by hand with `passportPrincipal`.

**A controller answers response headers.** `response` of `@Controller` (and of `@KitRoute` on a Nest controller) takes `headers`, a map of the header name to what it holds: the contract lists them under `responses.<status>.headers`, and `handle` returns `{ body, headers }` (`{ headers }` with no body), typed from the declaration so a declared header left out does not compile. Express, Fastify, Hono and Nest write them. A response that declares none keeps returning the body alone. A `Location` on a `201`, an `ETag`, a `Content-Disposition` on an export or a `Retry-After` on a `202` no longer need a function route.

**The guard lets `generate module` through on the trunk, and the skills name modules, the authorization model and the preset's glossary.**
`generate module` writes the config and the `CONTEXT.md` of the context, not code, so the guard no longer refuses it on the main checkout
under `"worktrees": "required"`, as it already did for `generate context`. The `bootstrap` skill declares each module of a context
right after its `generate context`, with its `--term`. `plan-slices` gives every row of a context with modules a `--module`, and leaves
`--grant` out on a `rebac` or `abac` project, where the generator refuses it. `glossary` takes the terms of a preset (today `identity`,
`packages/cli/src/presets/identity-terms.ts`) as the draft of a context the preset writes, and adds only the business terms beyond them.

**`ddd-ts-kit acceptance <story> --lock` writes the lock in the layout the formatter of the project prints.**
The lock was written with `JSON.stringify` in two spaces, which the Biome of the project then refused at the commit (the format hook asked for `biome format --write` on every lock and every relock). It is written through the JSON layout the kit uses for its other generated files, the one `biome format` prints at a width of 120, so the format hook passes on it untouched.

To move: nothing; a lock already written is reformatted by the next `acceptance <story> --lock`, or by `biome format --write test/acceptance/*.acceptance.lock.json`.

**The agent denies the secret files of a project by name, and reads `.env.example` again.**
`init` denied `Read(./.env.*)` with the negation `Read(!./.env.example)` to keep the example readable. The sandbox of Claude Code ignores the negation and masks `.env.example` with `/dev/null`, which breaks git in the session. The deny list names `.env`, `.env.local`, `.env.*.local`, `.env.production`, `.env.development` and `.env.test`, and no rule carries a `!`.

To move: a project written before this change keeps the glob and its negation in `.claude/settings.json`; replace them by the six rules above (`init` adds the missing ones and says so, but does not remove the old pair).

**The `biome.json` of a project no longer ignores the worktrees of its own checkout.**
`init` wrote `"!**/.worktrees"` in `files.includes`: inside a worktree under `.worktrees/`, Biome then ignored every file, and `format` of `verify` failed in every story and worker. The entry is `"!.worktrees"`, anchored at the root of the configuration: the main checkout still skips its worktrees, and a worktree formats its own files.

To move: a project written before this change keeps `"!**/.worktrees"` in its `biome.json`; replace it with `"!.worktrees"` (or run `init --force`, which rewrites the file).

**`merge-trunk` and `verify-merge` no longer report as lost the lines the trunk itself removed or replaced.** A line of the branch in a file the branch did not touch since it left the trunk (the file is the same on the branch and at `git merge-base`) cannot be a loss of the merge: what the trunk changed there since the base is the trunk's change. It happened when the branch had taken lines from the trunk with an earlier merge and the base of the new merge was older, which stopped the merge on `the merge lost N line(s)` and taught workers to pass `--accept-lost` blind. A line of a file the branch touched, dropped by the merge, is still reported.

**A controller declares a raw body.** `@Controller({ rawBody: true })` (and `@KitRoute({ rawBody: true })` on a Nest controller) leaves the body unparsed and unvalidated: `handle` reads the bytes in `context.stream` and the headers as they arrived in `context.rawHeaders`, to verify an HMAC signed over them before parsing anything. The contract describes the body as `application/octet-stream`, and `rawBody` is refused with `body`, `upload` or `consumes`. Express, Fastify, Hono and Nest (over Express and over Fastify) serve it; a signed webhook no longer needs a function route outside the closed presentation tree.

To move: a project generated by `init` from now on has it. An existing project adds it by hand: on Express, keep the bytes of a JSON body the parser reads before the routes (`express.json({ verify })` writing `request.rawBody`), and create a Nest application with `rawBody: true`, or a JSON webhook reaches the controller empty.

**The repository contract asks for a change of state: `mutate` is optional, and a `mutate` that changes nothing fails the stale-save case with a message that says so.** The case `refuses to overwrite a change it has not seen` waited for a conflict that never came on an event-sourced adapter when `mutate` changed nothing, because an event store appends nothing for no pending event. The contract now changes the stale copy too before saving it, so a table adapter and an event store both refuse it, and a `mutate` that changes nothing fails with `mutate changed nothing: give the contract a change of state`. Without a `mutate`, the case is registered as pending (`it.todo`) with the reason `give the contract a mutate that records a change of state`, so a freshly generated repository is green and the case shows in `ddd-ts-kit todo`. The fakes and the adapters do not change: a table adapter and an event store may differ on a save without a change, which the contract does not judge.

To move: add a `mutate` that records a change to each contract spec; the case stays pending until then.

**`generate aggregate --event-sourced --birth <Event>` names the birth event after the business.**
The birth event of an event-sourced aggregate was always `<Name>Created`, and the generator refused
until `Created` was a term of the glossary, so an agent defined a word the business never says.
`--birth Triggered` writes `IncidentTriggered` (`incidents.incident.triggered`) for the event class,
its type, the codec of the stored events, the builder and the specs, checked against the glossary
and as a past fact like any event name. `Created` stays the default. `--birth` without
`--event-sourced` is refused. The `scaffold` skill says to pass it with the word of the glossary.

**`generate repository` on an event-sourced aggregate writes the adapter over `EventSourcedRepository`, not a table.**
When the class of the aggregate extends `EventSourcedAggregate`, `generate repository` (and the
first `generate command --aggregate` that needs one) writes `event-store-<name>.repository.ts`,
which delegates to `EventSourcedRepository` of the kernel over the `EventStore` and the
`PersonalDataCipher` the platform binds, with the codec of `<name>-events.mapper.ts` and its
snapshot policy left as a `TODO(domain)`; no table, no row mapper. The fake is that adapter over
the in-memory stores, and the repository contract runs on the fake and on the adapter over
`InMemoryEventStore`, its stale-save case pending until a `mutate` that records an event is added. It is bound where the project
binds its adapters (the declarations, the module of the context, or the hand-written platform).
The event store keeps no tenant, so `--tenant-scoped` changes nothing and the note says who
decides who may load an id; `--personal` is refused, the personal values being sealed in the
events. A project that deleted the table adapter and wrote this one by hand can regenerate it
and compare.

**`@ddd-ts-kit/tracing` runs on the OpenTelemetry JS SDK 3.0.** `@opentelemetry/sdk-node` 0.300 no
longer exports the `resources` and `tracing` namespaces, so `initTracing` imports the resource
from `@opentelemetry/resources` and the samplers and span processors from `@opentelemetry/sdk-trace`,
the package that replaces `@opentelemetry/sdk-trace-base`. The test harness of
`@ddd-ts-kit/tracing/testing` uses its `TracerProvider`, the former `BasicTracerProvider`. The peer
ranges ask for `@opentelemetry/sdk-node` and `@opentelemetry/exporter-trace-otlp-http` 0.300,
`@opentelemetry/auto-instrumentations-node` 0.82, `@opentelemetry/sdk-trace`,
`@opentelemetry/resources` and `@opentelemetry/context-async-hooks` 3.0, and `@opentelemetry/api`
1.10: the former ranges let a fresh install pull 0.300, which the previous `initTracing` could not
start with. `init` writes these versions.

To move: `npm i @opentelemetry/sdk-node@^0.300.0 @opentelemetry/exporter-trace-otlp-http@^0.300.0
@opentelemetry/auto-instrumentations-node@^0.82.0 @opentelemetry/resources@^3.0.0
@opentelemetry/api@^1.10.0`, then `npm uninstall @opentelemetry/sdk-trace-base` and
`npm i -D @opentelemetry/sdk-trace@^3.0.0 @opentelemetry/context-async-hooks@^3.0.0`; an import of
`@opentelemetry/sdk-trace-base` becomes `@opentelemetry/sdk-trace`, `BasicTracerProvider`
becomes `TracerProvider`, and a span processor takes its exporter as an option:
`new SimpleSpanProcessor({ exporter })`.

**RabbitMQ rejects a publication the broker does not confirm in time, as NATS and Kafka do; the Redis Streams bus no longer takes a `scope` of its own.**

`RabbitMqEventBus` gains `publishTimeoutMs` (default 30000): `publish` waited for the confirmation of the broker with no timer, so a broker stalled (a full disk, a reply lost) held the outbox relay forever; it now rejects with `PUBLISH_NOT_CONFIRMED` and the relay retries. `close()` waits as long at most for each answer of the broker (the confirmations in flight, the cancel of the consumers, the close of the channels), so that a broker that stopped answering no longer holds the stop of the application. `RedisStreamsEventBus` loses its `scope` option, which no other bus had: the consumers of the kit (`on` of `@ddd-ts-kit/events`, the consumer of `@ddd-ts-kit/di`) run a handler in the execution context of its event above any bus, and the option ran it in that context a second time when given. Found by the parity check of the brokers (`pipeline/monorepo/families.mjs`).

To move: a bus built with `scope` drops it and wraps its handler with `inEventScope(scope, { consumer }, handler)` of `@ddd-ts-kit/kernel`, which the consumers of the kit already do; nothing generated by `init` passes it.

**`ddd-ts-kit docs --stored-events` reads the codecs of the modules of a context too, and refuses a shape it cannot read instead of recording the hash of nothing.**

A context divided into modules keeps its codecs in `<context>/<module>/infrastructure/persistence/` (where `generate aggregate --module <module> --event-sourced` writes them): `docs --stored-events`, `docs --check` and the unrecorded versions it lists read only `<context>/infrastructure/persistence/`, so nothing of a module was ever recorded. They now read the folder of the context and the one of each module of its model. A codec whose data type is not declared in its file, or declares no member, was recorded as `sha256:e3b0c44298fc1c14`, the hash of empty input, so that the lock vouched for no shape: `docs --stored-events` now stops with a non-zero exit code, names the codec file, the line and the reason, and writes nothing. `docs --check` reports an entry of the lock that holds the hash of nothing (`recorded empty`, and `emptilyRecorded` in `--json`).

To move: a lock that holds `sha256:e3b0c44298fc1c14` records nothing. Declare the fields of the data type in the codec, remove the entry from `stored-events.lock.json` (the version was not stored with a guarantee yet) and run `ddd-ts-kit docs --stored-events`. The placeholder `interface <Event>Data {}` a generator writes has to get its fields before its version is recorded.

**The sandbox guide says what the deny rules of the generated contracts cost an agent session, and what to do.** `Edit(./openapi/**)` and the other deny rules `init` writes for the generated contracts become read-only mounts under the sandbox of Claude Code: a merge of a branch that regenerated them and `docs:generate` in the main checkout fail inside the sandbox. The rules stay (the Edit tool must not touch a generated contract); `docs/guides/agent-sandbox.md` says to do those two gestures outside the sandbox, or to run the session with `--setting-sources local`, the guard of the plugin still refusing a hand edit of a generated file.

**The module of a context on `--di manual` keeps each function short as the context grows: one function per role.** `<context>.module.ts` registered everything in one function, which went past the 100 lines no function may exceed (`clean/function-size`) once a few use cases were scaffolded. It now holds `registerHandlers` (the repositories and readers with the command and query handlers), `registerReactions` (the handlers of events, the publishers of integration events, the integration handlers), `registerJobs`, `declaredUseCases` and `routesOf`, called by the module; the generators insert into the right one (`ddd-ts-kit:handlers`, `reactions`, `jobs`, `authorization` and `routes` regions replace `registrations`).

To move: a module written by an earlier version keeps its `registrations` region and its one function; move the lines by hand into the function of their role if it outgrows the limit.

**`init` writes the error mapper of the platform in one file, `platform/composition/platform-error-mapper.ts`, and the test platform binds it like the platform does.** A route spec through the test application used to see the default mapper (a refusal of the authenticator answered 422 where the running application answered 401) because `platform-test.module.ts` bound no `ErrorMapper`. `platformErrorMapper()` is bound by `platform.module.ts` and by `platform-test.module.ts` on tsyringe, and read by `compose-application.ts` on manual DI and Nest. Nothing is written without HTTP.

To move: a project that maps its own errors in `platform.module.ts` moves the mapping into `platformErrorMapper()` and binds it in `platform-test.module.ts`.

**The event store keeps the tenant of each stream, so an event-sourced aggregate is isolated under shared-table tenancy.** Given the execution scope (`InMemoryEventStore(scope)`, or `scope` in the options of `createKnexEventSourcing`, `createDrizzleEventSourcing`, `createPrismaEventSourcing` and `createTypeOrmEventSourcing`), the store records the tenant of the work at the first append of a stream in a nullable `tenant_id` column of the events, gives it on each `StoredEvent.tenantId`, and refuses a read or an append of a stream of another tenant with an `EventStreamTenantError` (platform staff elevated by `acrossTenants` may read, never append). Work that names no tenant is not scoped, and a store given no scope neither reads nor writes the column. `CatchUpSubscription` and `EventStoreProjectionRebuild` take the same `scope` and apply each event in the tenant of its stream. `eventStoreContract` gains `createTenantStore`, held by the in-memory store and the four ORM. `eventStoreTablesSql`, `eventStoreTables` (Drizzle), `eventStoreEntities` (TypeORM) and the Prisma model carry the column. Under a tenancy, `init` hands the execution scope to the event store: `persistence.eventSourcing` becomes a function of the scope, and `createEventSourcing(persistence, scope)` (or with the audit source) calls it.

To move: a generated project edits its `persistence-over` and `createEventSourcing` the same way (`eventSourcing: (scope) => createKnexEventSourcing(unitOfWork, { schema, scope })`), and a project under shared-table tenancy passes `scope` to its event store, and a project whose event store already exists adds the column in a migration: `addEventStoreTenantColumn(knex, { schema, tenantOfExistingStreams: '<tenant>' })` on Knex (or `eventStoreTenantColumnSql`), and the migration of the tooling of the ORM on Drizzle, Prisma and TypeORM (`tenant_id text`, nullable) followed by `update stored_events set tenant_id = '<tenant>'` for the streams already there; a stream without a tenant is refused to every tenant. A Prisma project copies the new `tenantId String? @map("tenant_id")` line into its `StoredEvent` model.

**A `context-builder` agent returns its report as its final message, and a `SubagentStop` hook of the plugin writes it to `.ddd-ts-kit/report.md` of its worktree.**

Claude Code refuses a sub-agent the write of a report file ("Subagents should return findings as text, not write report files."), so the report that `worker-scope --resume` and the guard read was never there. The agent is no longer asked to write it; the guard takes its last message (from the hook input, else from the transcript the input names) and writes the file in the worktree of the worker, failing open. The briefing of `worker-scope` and its resume message say the same. The `parallel-work` and `story` skills tell the conductor to write the file from the worker's final message when it is missing after the worker returns.

The guard no longer asks an agent that stops to rewrite a report older than its last commit; it still keeps it going once when a slice that passed `verify-slice` is left uncommitted.

## 0.91.0

**The background jobs and the process instances go to the database by default on every ORM of
the kit and with every container: `TypeOrmJobStore` and `TypeOrmProcessStore`, and one rule for
`init --queue`.** `@ddd-ts-kit/typeorm` gains the job store and the process store, with their
tables `jobEntity()` and `processEntity()`, held to `jobStoreContract` and `processStoreContract`
on PGlite and on PostgreSQL: a job enqueued by a command is written by its transaction, a claim
takes the due rows `FOR UPDATE SKIP LOCKED`, an idempotency key is unique per job name and tenant,
a step of a process manager saves its instance in its unit of work. `init --orm typeorm` now
accepts `--queue database` and writes the two entities in the `messaging` schema. And the default
of `--queue` no longer depends on the container: `database` on Knex, Drizzle, Prisma and TypeORM
with tsyringe, Nest or a platform wired by hand, `memory` with a custom persistence or none. Until
now a project under Nest or wired by hand kept its jobs in memory unless it asked otherwise.

To move: nothing for an existing project, whose `stack.queue` is kept. A new project under Nest or
wired by hand that wants its jobs in memory passes `--queue memory`.

**The identity preset is written on Prisma: `init --orm prisma --preset identity`.** The context
comes with its Prisma adapters (the repositories of the five aggregates, the search reader of the
members, their mappers over the generated client, the declarations of the personal fields), and
its models and enums laid out in `prisma/schema.prisma` in place of the ones the generators start:
the closed vocabularies (the role of a member, the status of an account and of an invitation) are
enums of the schema, the token of an invitation is unique, and one current membership per account
and organisation is a partial unique index, `where: { removedAt: null }`, for which the preset
turns on the `partialIndexes` preview feature of the client generator: a preview feature, which
Prisma may change without a major version, so after an upgrade of Prisma check that
`generated/schema.sql` still ends `members_current_idx` with `WHERE ("removed_at" IS NULL)`. The tables belong to no
tenant, as on Knex and Drizzle. The preset is still refused on TypeORM, the explicit style and
NestJS.

To move: nothing for an existing project. A project on Prisma that wants the context runs
`ddd-ts-kit generate context identity --preset identity`, then `npm run db:client` and
`npm run db:generate identity`.

**A route is served as an oRPC procedure too, for a typed TypeScript client: `orpcRouter` of `@ddd-ts-kit/http/orpc`.**
`orpcRouter(routes, options)` turns each route into an oRPC procedure named by its `operationId`,
for `RPCHandler` of `@orpc/server` (1.15 or later, a new optional peer of `@ddd-ts-kit/http`),
mounted next to the routes under a prefix such as `/rpc`. Each call runs through `executeRoute`
with the options of the HTTP adapter: the same guards, principal, tenant, validation,
permissions, `onError` and `around`. A refusal is an `ORPCError` with the code and the status of
its problem document, which it carries as its data, and a code the route declares (its own, its
guards', `VALIDATION_FAILED`, the preconditions) is a defined error for the client. What only HTTP
carries stays with the routes: an answer has no headers (no `ETag`, no cache policy), JSON is the
only representation, a route that receives a file or a raw body is not a procedure, and a file or
a list streamed as it is read is refused with 406 and closed.

A list read as it comes and closed before its end now closes its cursor: the pipeline read its
first item in advance, and stopping the list, as a client that goes away does, left the cursor
open until it was collected.

**`init --rpc orpc` serves the routes of the contexts under `/rpc` as oRPC procedures, and `ddd-ts-kit sdk` gives each client its oRPC contract at `./orpc`.**
The new key `stack.rpc` (`none`, `orpc`) has `start-http-server.ts` mount `orpcRouter` of
`@ddd-ts-kit/http/orpc` under `/rpc` on Express, Fastify, Hono and NestJS, with the options of the
HTTP boundary, and adds `@orpc/server`; it needs an HTTP framework. `ddd-ts-kit sdk` then writes
`src/orpc.ts` in each client: the oRPC contract of its document (`contract`, `createRpcClient`),
each procedure named by its `operationId`, its input and answer the types of the HTTP client, its
refusals the codes of `x-error-codes` with their status, so that `isDefinedError` narrows them.
`@orpc/client` and `@orpc/contract` become the only dependencies of the client, whose root entry
still has none; setting the key back to `none` takes them and `src/orpc.ts` away. The kit no longer
documents oRPC as set aside: it is a second door to the routes, not a pair of the contract.

To move: a project that wants the procedures runs `init --force --rpc orpc` on a clean tree (it
records the key, rewrites `start-http-server.ts` and adds `@orpc/server`), then
`npx ddd-ts-kit sdk` when it has clients.

**The identity preset is written in the explicit style and under NestJS: `init --di manual --preset
identity` and `init --http nest --di nest --preset identity`.** The classes of the context are written
without the declarations of the kernel, a policy carrying its name and its permission, and the preset
lays out `identity.module.ts` whole once the generators ran: its adapters, its use cases with the
permission each requires, the publishers of its facts, the consumers that keep the identity provider
in line (each with its consumer name, the processed-event store and the unit of work), and its
routes, in short functions named after what they wire, the regions of the generators kept. Its
policies join `access-policies.ts` of the platform, and the world of its specs wires the fakes the
way the module wires the adapters; `test/unit/identity.module.spec.ts` holds the module itself to its
use cases, on the platform: each command and query has its handler and its permission, and each
route is mounted. Under NestJS the routes are mounted with those of the other
contexts by the app module of the platform. The explicit style stays refused on tsyringe, which
reads the declarations, and `--dependencies signature` is asked of the declared style only.

To move: nothing for an existing project.

**A project generated on Jest is green from its first minute, and the kit now runs it: Jest is
installed in the workspace and one Jest stack joins the stacks its end-to-end suite runs.** Running
it found what a type check could not: a Jest project listed `@vitest/coverage-v8`, which knip
refused as unused; knip entered its fakes and worlds through top-level patterns, reported as
matching nothing before the first context, instead of a `jest` section beside the `vitest` one of
a Vitest project; the extractability spec of `test/architecture/` gave `it.each` an empty table,
which Jest refuses, before the first context (it now waits with an `it.todo`); an import of a
directory (`@/contexts/<context>/published-language`) did not resolve, each alias now mapping to the
source then to the barrel of the directory; the modules of the Prisma client, written with `.js`,
did not resolve, now mapped back to their sources; and a hook opening the test database outlasted
the 5 seconds of Jest, now 60 as on Vitest. The identity preset is held green on NestJS,
class-validator, Prisma, shared tables and Jest, the stack of the spend management example.

To move: in `jest.config.js`, write each alias of `moduleNameMapper` as
`['<rootDir>/src/$1.ts', '<rootDir>/src/$1/index.ts']` (the check asks for it), add
`testTimeout: 60_000`, and on Prisma `'^(\\.{1,2}/.*)\\.js$': '$1'`; in `knip.json`, move the
entries of the fakes and the worlds into a `jest` section with `"config": ["jest.config.js",
"jest.e2e.config.js", "jest.mutation.config.js"]`; drop `@vitest/coverage-v8` from the dev
dependencies.

**A route is served as a tRPC procedure too: `trpcRouter` of `@ddd-ts-kit/http/trpc`.**
`trpcRouter(routes, options)` turns each route into a tRPC procedure named by its `operationId`, a
query for a `GET` route and a mutation for the other methods, for the adapters of `@trpc/server`
(11.10 or later, a new optional peer of `@ddd-ts-kit/http`), mounted next to the routes under an
endpoint such as `/trpc`. Each call runs through `executeRoute` with the options of the HTTP
adapter, as a call of `orpcRouter` does. A refusal is a `TRPCError` of the code tRPC has for its
status (`UNAUTHORIZED` for 401, `CONFLICT` for 409), with the problem document of the route in
`data.problem`, whose `code` is the one of the kit: tRPC has a fixed set of codes of its own. What
only HTTP carries stays with the routes, as over oRPC, and a binary body is refused with 406 too,
as tRPC answers JSON only.

Over oRPC, a file or a streamed list refused with 406 now carries its problem document as `data`,
as every other refusal does.

**`init --rpc trpc` serves the routes of the contexts under `/trpc` as tRPC procedures, and `ddd-ts-kit sdk` gives each client the type of their router at `./trpc`.**
`stack.rpc` takes a third value, `trpc`: `start-http-server.ts` mounts `trpcRouter` of
`@ddd-ts-kit/http/trpc` under `/trpc` on Express, Fastify, Hono and NestJS, with the options of
the HTTP boundary, and adds `@trpc/server`; it needs an HTTP framework, as `orpc` does. `ddd-ts-kit
sdk` then writes `src/trpc.ts` in each client: `AppRouter`, the type of the router written from
its document, a query for each `GET` operation and a mutation for the others, their input and
answer the types of the HTTP client, a refusal carrying its problem document in `data.problem`;
`createRpcClient` and `isRpcRefusal` call it. A front end imports the client, never the code of
the server. `@trpc/client` and `@trpc/server` become the only dependencies of the client; moving
to another value takes them and `src/trpc.ts` away.

To move: a project that wants the procedures runs `init --force --rpc trpc` on a clean tree (it
records the key, rewrites `start-http-server.ts` and adds `@trpc/server`), then
`npx ddd-ts-kit sdk` when it has clients. A project that served oRPC removes `@orpc/server` from
its `package.json`: `init` adds the dependencies of a stack, it does not take back those of the
previous one.

**`init` on an existing project names each dependency of its `package.json` the stack about to be written contradicts.** The first `init` of a project that already has a `package.json`, a dry run included, adds a note per key its direct dependencies answer otherwise than the flags (`package.json depends on fastify, and the project is written for --http express: pass --http fastify to keep it.`), for the HTTP framework, the validation library, the injection, the test runner, the ORM, the database, the broker, the authentication, the logger, the error reporter and the storage. Two dependencies that answer one key differently are left to the owner, and said; the rights model is never read from a dependency. Nothing is written by these notes, and an initialised project is not read again. The `bootstrap` skill puts them to the owner.

**The instances of the process managers are kept in the tenant of the work on Knex, Drizzle, Prisma and TypeORM alike, under a key that includes the tenant.**

`KnexProcessStore`, `DrizzleProcessStore`, `PrismaProcessStore` and `TypeOrmProcessStore` take `tenant` (the `ExecutionScope`): a step loads and changes the instances of its own tenant only, and work that names no tenant is refused with `NoCurrentTenantError`. The table of each package (`createProcessTable`, `processesTable`, the `ProcessInstance` model, `processEntity`) always has `tenant_id`, the empty text outside any tenant, and its primary key is `(tenant_id, name, id)`: two tenants may run an instance under the same correlation key, a month or an invoice number, where the first save of the second was refused before. `processStoreContract` proves it with `storeInTenant`, on the four packages. A project generated with `--tenancy` gives the scope to its process store: `Persistence.processes` is now `(scope) => ProcessStore`.

To move: drop `tenant: true` from `createProcessTable` (the option is gone, the column always there); `DrizzleProcessStore` takes its table as `{ table }`. A database created before needs a migration that adds `tenant_id` (`''` for the rows of no tenant, `addTenantColumn` of `@ddd-ts-kit/knex` for those of a tenant) and makes `(tenant_id, name, id)` the primary key; on Prisma, `prisma migrate dev` writes it from the model. In a generated project, `persistence.processes` is called with the execution scope (`persistence.processes(scope)`), as `init` now writes it.

**A renamed `operationId` is a breaking change of the API when the routes are served as procedures, and the architecture reviewer says so.**
With `stack.rpc` set to `orpc` or `trpc`, a procedure is named by the `operationId` of its route
and called at that name: renaming it, giving a `GET` route another method (a tRPC query becomes a
mutation) or having a route receive a file breaks a front end already deployed, which answers
404 or calls it the wrong way. The table "Breaking or not" of the `document` skill lists these
three changes, the client SDK guide says it, and the `architecture-reviewer` agent reports them
from the diff of `openapi/`, blocking unless the change says its consumers move with it.

**`generate property <context> <ValueObject>` writes the laws of a value object as a spec on generated values.** The spec lands beside the spec of the value object (`test/unit/<name>.vo.properties.spec.ts`), with an arbitrary built on its factory (`any<Name>()`), a first law (the value is equal to the one created again from its own value) and one planned rule per kind of law (an invariant after each operation, a symmetry, a round trip), under Vitest and Jest, for value objects that throw or return a `Result`. `fast-check` joins the development dependencies when the project does not have it yet; that write is a shared one, so a worker confined to its context runs the kind with `--local-only` once fast-check is there. The value object must exist: the refusal names the command that creates it.

**`ddd-ts-kit check --baseline write` records the errors an existing codebase already has, and `check` then reports only new ones.** The errors of the checker are counted by file and by rule in `ddd-ts-kit-baseline.json`, the shape of `eslint-suppressions.json`. While a file has no more errors of a rule than the baseline records, `check` and `check-file` (the hook of the agent) leave them quiet; once it has more, all of them are reported. A recorded count the project no longer reaches fails `check` until `check --baseline prune` lowers it, so the baseline only shrinks. Warnings are not recorded. Writing it is a decision of the project owner, who runs the command in a terminal: the guard of the plugin refuses `check --baseline write` and any direct edit of the file to an agent, under Claude Code, Codex and Copilot alike, and the permissions `init` writes ask before both for an agent without the plugin. `check --baseline prune` is free.

To move: in a project initialised before this version, run `npx ddd-ts-kit init` again: it adds the two permissions to `.claude/settings.json` and names them.

**`ddd-ts-kit check` refuses in a context the tools of Nest that the kit does its own way, and says which tool of the kit to use instead (`nest/no-parallel-pipeline`).**
The routes of the kit are mounted under Nest, not through its pipeline: a Nest guard, pipe,
exception filter or interceptor never sees them, and a Nest controller written in a context was
a route the checker let through, with no declared security, no problem codes and no place in the
contract (`authz/declared` judged the controllers of the kit only). The new rule, an error,
reports in `presentation/`, `infrastructure/` and the module file of a context, tests apart: a
controller and its decorators, a guard, a pipe, an exception filter or an `HttpException`, an
interceptor or the `Logger` of `@nestjs/common`, and `@nestjs/core`, `@nestjs/swagger`,
`@nestjs/cqrs`, `@nestjs/passport`, `@nestjs/jwt`, `@nestjs/schedule`, `@nestjs/bull(mq)`,
`@nestjs/config`, `@nestjs/throttler`, `@nestjs/cache-manager`, `@nestjs/event-emitter`, the ORM
modules of Nest and `@nestjs/terminus`. Each finding names the tool of the kit in its place. The
container of Nest (`@Injectable()`, `@Inject()` on an adapter bound as a provider), its WebSocket,
GraphQL, microservice and testing packages, and everything in the platform are left alone. The
HTTP frameworks guide gains "Where each tool of Nest goes", and the `wiring` skill `nest.md`.

To move: a project with Nest code in a context runs `npx ddd-ts-kit check` and replaces each
finding by the tool its message names (a Nest controller by `generate route`, a role guard by the
permission of the use case, an `HttpException` by a refusal of the code list), or moves what is
not a use case to the platform.

**A file that moves keeps the errors `ddd-ts-kit-baseline.json` records for it.** Adopting the kit is made of moving code into the canonical tree: `move-to-module`, `context-layout` and `platform-folders` now carry the entry of each file they move to its new path, and `check --baseline prune`, which an agent may run, follows the renames git sees since the baseline was committed (a `git mv`) before it lowers the counts. A count follows its file and is never raised, so a move silences nothing new. A file moved otherwise (a plain `mv` git does not see as a rename) still reports its errors at its new path, and its old entry fails until the owner writes the baseline again.

**A Nest controller is a route of the kit: `@KitRoute` on its method, `createControllersModule` of `@ddd-ts-kit/http/nest` to serve it.**
A project on NestJS writes its controllers as Nest does (`@Controller`, `@Get`, `@Post`,
`@Param`, `@Query`, `@Headers`, `@Body` with a DTO class, `@HttpCode`, injection by constructor),
and adds `@KitRoute({ operationId, summary, guards, errors, response })` to each method,
`@KitRoutes({ guards, tags, errors })` to the class for what its routes share. The kit, not Nest's
router, serves the method, through the pipeline of every route: guards, validation of the DTO
(`schemaOfClass: classSchema`), problem documents, tracing, the contract, and a procedure over
`/rpc` and `/trpc`. `@CurrentActor()` hands the method the caller the authentication resolved;
`@RouteContext()` the context of the request. `nestControllerRoutes` gives the same routes without
Nest's container, for the contract and the procedures. What the kit's pipeline would not run is
refused when the routes are built: `@UseGuards`, `@UsePipes`, `@UseInterceptors`, `@UseFilters`,
`@Header`, `@Redirect`, `@Render`, `@Sse`, `@Version`, pipes on a parameter, `@Req`, `@Res`; a
route with no guard is refused; a controller also among the `controllers` of a Nest module stops
the start. The metadata Nest's decorators record is read in one place, checked on each read, and
held by a test on the Nest the kit is released with.

**`nest/no-parallel-pipeline` lets a Nest controller the kit serves declare its routes with Nest's decorators, and refuses anywhere a controller Nest serves that reaches a use case.**
In a context, a file that imports `KitRoute` of `@ddd-ts-kit/http/nest` may use `@Controller`,
`@Get`, `@Post` and the other methods, `@Param`, `@Query`, `@Headers`, `@Body` and `@HttpCode` of
Nest: the kit reads them and serves the route through its own pipeline. The raw request and answer
(`@Req`, `@Res`, `@Header`, `@Redirect`, `@Render`, `@Sse`, uploads), guards, pipes, filters and
interceptors of Nest stay refused there. Outside the contexts, under the source root and outside
the tests, a file that imports `Controller` of `@nestjs/common`, not `KitRoute`, and names
`CommandBus` or `QueryBus` or imports a file of a context is reported: a controller Nest serves
that reaches a use case has no declared security, no problem codes and no place in the contract,
and moving it to the platform no longer hides it. A controller of the platform that reaches no
use case (health, metrics) is left alone.

To move: a Nest controller of the platform that sends commands or queries gets `@KitRoute` on each
method and moves to `createControllersModule`, or becomes a route of the context.

**A method of a Nest controller the kit serves that returns a value without `response.body` is refused, instead of answering an empty body.**
In Nest, what a method returns is the body of the answer; under `@KitRoute` the kit answers the
body its `response.body` declares, as the contract does, and dropped what an undeclared method
returned without a word. The routes are now refused when they are built if TypeScript recorded
that the method returns a value (`design:returntype`, under `emitDecoratorMetadata`), and an
`async` method, whose recorded type is only `Promise`, is refused at the call: a 500, the reason
told to `onError`.

To move: give `response: { body }` to each `@KitRoute` whose method returns what the caller reads,
or return nothing.

**The guard of the plugin finds the CLI a workspace hoisted to a parent directory.** It looked for `node_modules/.bin/ddd-ts-kit` in the project only, so in a project of an npm or pnpm workspace, whose install lands at the root of the monorepo, it found none and skipped, without a word, every check that needs the CLI: the check of each written file, the refusal to stop while errors remain, the gates of a story. It now looks where Node would, from the project up to the root of the filesystem.

To move: in a project of a workspace, the guard now runs those checks. Run `npx ddd-ts-kit check` before updating the plugin: an error it reports would otherwise first appear as a refusal to end a session.

**A project generated on an ORM holds the stores of the kit, as its platform wires them, to their contracts; and the test database of a Drizzle project has its unique indexes.**

`init` writes `src/platform/database/persistence.contract.spec.ts` on Knex, Drizzle, Prisma and TypeORM: the outbox, processed-event, job and process stores of `Persistence`, on the database of `open-test-database.ts`, run the contracts of `@ddd-ts-kit/testing` with what the stack turns on (`carriesTenant` and `storeInTenant` under `--tenancy`, the unit of work of a step with `--queue database`), and the event store with its snapshots, checkpoints and keys under `--event-sourcing on`. A store bound without the tenant the stack asks for now fails a spec of the project. On Drizzle, `table-statements.ts` creates the unique indexes and constraints of `schema.ts` too: the in-process database of the tests lacked the one of `background_jobs`, so a job enqueued in a spec failed with `there is no unique or exclusion constraint matching the ON CONFLICT specification`.

Run for real at night on Prisma (NestJS, Jest, Kafka, shared tables, the jobs in the database) and on TypeORM, installed from the packed kit, three more things came out, now fixed: under Jest, a port that a module file wiring by hand never loads counted as uncovered code and dropped the domain under its floor from the first use case, so the ports (abstract members only, `ports/abstract-class`) are no longer measured, under Vitest or Jest; knip reported `prisma/schema.prisma` as outside the project on Prisma, and `data-source.ts`, which only the TypeORM CLI loads, as unused on TypeORM.

To move: on a project generated before, `init --force` writes the spec and the new `table-statements.ts`; a Drizzle project that copied `table-statements.ts` by hand adds `uniqueIndexStatements` from the new template; `knip.json` gets `"prisma/**/*.prisma"` in `project` on Prisma, and the data source in `entry` on TypeORM.

**`init --routes nest` makes a Nest controller what `generate route` writes: Nest builds it with the bus it injects, the kit serves it.**
A new form of `stack.routes`, `nest`, for a project on `--http nest` with class-validator. `generate
route` writes `<use-case>.controller.ts` with Nest's `@Controller()`, `@Post` or `@Get`, `@Param`,
`@Body` typed by the DTO classes beside it, `@CurrentActor()` for the caller, the bus injected by
Nest (`@Inject(CommandBus)`), and `@KitRoute` and `@KitRoutes({ group })` of
`@ddd-ts-kit/http/nest`; the module of the context lists it under `controllers`, the application
composes its routes with the others (`nestControllers`), and the Nest module of the platform builds
it with the buses of the platform (`provideControllers`). The routes keep the guarantees of every
route: the guards of the group, validation, problem documents, the contract, and the procedures
over `/rpc` and `/trpc`. A search stays a controller of the kit (`generate controller`), and
`--mapper` and `--serializer` are left out: the method maps its input and its answer itself.

`@ddd-ts-kit/http/nest` gains `nestControllers`, `provideControllers` and `nestControllerRoute`,
and `@KitRoutes` a `group`, a route group of the kit whose prefix, tags, guards and codes come first.

To move: a new Nest project passes `--routes nest`; an existing one keeps its routes, and a context
that gets Nest controllers needs the `controllers` list of the module file and the composition of
the platform that `init --force --routes nest` writes.

**On trial, `"dependenciesBeforeWrite": true` has the guard of the plugin refuse, before the write, a new import that breaks a dependency rule.** The lines a session is about to add to a TypeScript file (the content of a `Write`, the replacements of an `Edit`, the added lines of a Codex patch), less those the file already held, are judged by `layer/domain-purity`, `layer/application-inward`, `layer/infrastructure-no-presentation`, `layer/presentation-no-infrastructure` and `context/published-language-only`, and the write is refused with the message of the checker, under Claude Code, Codex and Copilot; the file never reaches the disk with the import. The other rules stay after the write. The key is off by default. `ddd-ts-kit check-file` gains `--content-from <file>`, which judges a given text as the content of the path, and `--rule <id>`. Each judged write is recorded, on the machine only, in `.git/ddd-ts-kit/before-write.jsonl` of the repository (the file, the rules refused, the time the check took), so that the trial can be decided on what it did; the example application runs it.

**`@KitRoute` is optional: each method of a Nest controller the kit serves that carries a route decorator of Nest is a route, named after the method.**
`@Post`, `@Get` and the other route decorators of Nest are enough: the route is named by the
method (`issueInvoice`), summed up by its name as a sentence (`Issue invoice`), behind the guards
of `@KitRoutes` on the class. `@KitRoute` says only what Nest does not: another name, guards of its
own, the refusals it answers, the body it answers (a method that returns a value without it is
still refused, never answered empty). `generate route` under `"stack.routes": "nest"` no longer
writes the name and the summary, and `nest/no-parallel-pipeline` takes a file that imports
`KitRoutes` alone for a controller the kit serves. The docs say that a generated controller
injects the buses only, the providers the platform gives Nest.

**A project without a database (`--orm custom` or `none`) and with `--cache redis` compiles again: its outbox relay is woken by its own store alone.**

`main.ts` (and the `main.ts` of each extracted service) gave the relay two `wakeOn` keys, the signal of the in-memory persistence and the Redis signal, which TypeScript refuses (`An object literal cannot have multiple properties with the same name`). An outbox kept in the memory of the process is relayed by that process alone, so the Redis signal, which wakes the relay of another process, is no longer created there; with a database it stays. Found by the stacks that now meet every pair of capability values, generated and type-checked at night and before a release.

To move: on such a project, `init --force` writes `main.ts` and the Redis services again; by hand, remove `wakeOn: redis.relaySignal` from `main.ts`.

**A criterion of a story that states a law over every value of a value object becomes a property.** In the design review of the `story` skill, such a criterion ("never negative", "the total equals the sum of its lines", "overlaps the other in both directions or in none") gets a `Laws: <ValueObject>: <law>` line in the section of its row, and the build of the row states it with `generate property`, the law its title; the criterion keeps its scenarios in the acceptance. Measured on the example before its specs were hardened: the property of symmetry of `Range.overlaps` kills a mutant of a bound (`<` to `<=`) that its examples let through.

**What a method of a Nest controller answers is its signature: the kit reads it into a generated `<context>.controllers.ts`, and `@KitRoute` no longer says it.**
Under `"stack.routes": "nest"`, `ddd-ts-kit generate`, `docs` and the `dev` script write
`<context>.controllers.ts` at the root of each context: its Nest controllers, each with what its
route methods answer as their signatures say it (`Promise<IssuedInvoice>` a DTO class,
`Promise<Accepted>` an identifier, `Promise<void>` nothing), through `withAnswers` of
`@ddd-ts-kit/http/nest`. The module of the context lists them from that file, so `generate route`
no longer touches it, and the generated controller declares in `@KitRoute` its validation and its
refusal codes only, its status through `@HttpCode` of Nest when Nest would answer another. The
check `nest/controllers-current` keeps the file current and reports a route method whose answer
the kit cannot read into a schema (an array, an inline type, an interface, no type) and whose
`@KitRoute` declares no `response`. A DTO without a decorated field accepts the empty object
alone, as `whitelist` and `forbidNonWhitelisted` refuse any field.

To move: a project on `--routes nest` runs `npx ddd-ts-kit docs` once, and its context modules
list `<context>Controllers` from the generated file in place of their `controllers` list.

## 0.90.0

**A generated project forces qs `^6.16.0`, and multer `^2.5.0` on Nest, where its stack still pins the vulnerable versions; one on Fastify asks for `fastify` `^5.12.7`.** Stryker 10.1 asks for `typed-rest-client` 2.3, which asks for qs 6.15.1 exactly (three denials of service, moderate), and `@nestjs/platform-express`, up to 12.2.0, asks for multer 2.4.0 exactly (a denial of service through a pending `fileFilter`, high). `init` forces the fixed versions in `overrides` of `package.json` under npm, and of `pnpm-workspace.yaml` under pnpm, which reads nothing of `package.json`. An override the project already sets for one of them is kept, and said, unless `--force`. Fastify 5.12.2 to 5.12.5 let a request header go around the validation of a schema whose `propertyNames` reads it by case (low).

To move: `npx ddd-ts-kit init` adds the overrides (or write them by hand: `"overrides": { "qs": "^6.16.0", "multer": "^2.5.0" }` in `package.json` under npm, the same entries under `overrides:` of `pnpm-workspace.yaml` under pnpm, multer on Nest alone), then `npm install` (`pnpm install`). Check that `npm ls qs multer` (`pnpm why qs multer`) shows no qs below 6.16 and no multer below 2.5; a copy left older moves with `npm update qs multer`. In a project on Fastify, install `fastify@^5.12.7`.

**The background jobs and the process instances live in the database on Prisma too:
`PrismaJobStore` and `PrismaProcessStore`, and `init --orm prisma --queue database`.** The two
stores of `@ddd-ts-kit/prisma` are held to `jobStoreContract` and `processStoreContract`, on PGlite
and on PostgreSQL. A job enqueued by a command is written by the transaction of that command, so it
exists if and only if the command committed; a claim selects the due rows `FOR UPDATE SKIP LOCKED`,
the one raw statement of the store, and leases them in a short transaction; an idempotency key is
unique per job name and tenant. A step of a process manager saves its instance in the transaction
of its unit of work, refused with `ConcurrencyError` at a stale version. Their models ship in
`prisma/jobs-and-processes.postgresql.prisma`; the checkpoint of a job and the state of an
instance are JSON in a text field, since Prisma Client writes a SQL `NULL` to a `Json` field only
through the sentinel of the generated client. `init` writes the `BackgroundJob` and
`ProcessInstance` models in the `messaging` schema of `prisma/schema.prisma` and binds the stores in
`persistence-over.ts`; on Prisma with tsyringe `--queue` now defaults to `database`, as on Knex and
Drizzle, and with `--queue redis` the process instances stay in the database.

To move: a project on Prisma that keeps its jobs in memory and wants them in the database runs
`init --force --queue database` on a clean tree, then `npm run db:generate <name>` for the two new
tables.

**The four rules that read what a test says are errors: `test/title-states-a-rule`, `test/no-logic`, `test/assertion-present` and `test/refusal-by-code`.** They were warnings in 0.89, listed by `ddd-ts-kit lint` after its report without failing it; `recommended` of the ESLint plugin and `ddd-ts-kit rules` now give them `error`, as `strict` did, and the lint fails on them.

To move: before upgrading, run `npm run lint` on 0.89 and take up what it lists under these four rules: rename a title that says `should` or names a method, move a loop to an `it.each` and a decision to a builder or a fake, replace a `toThrow('message')` by the code of the refusal, and write `it.todo` where a test has no body. A project that keeps one of them a warning sets `"rules": { "test/no-logic": "warn" }` in `ddd-ts-kit.config.json`, rule by rule.

**`ddd-ts-kit doctor` says when an override `init` writes is missing, or no longer needed.** `init` forces qs `^6.16.0`, and multer `^2.5.0` on Nest, under a dependency that pins them below a security fix; nothing removed such an override from a project once that dependency was fixed, and it would hold the package back when a later major is asked for. `doctor` now reads, on what is installed, the range the parent asks for (`typed-rest-client` under `@stryker-mutator/core`, `@nestjs/platform-express`), found from the real place of each package under npm and under pnpm, against the overrides of `package.json` or of `pnpm-workspace.yaml`: `override <name>: missing` while the parent still pins the package below the fix and the project does not force it, which fails `--strict`; `override <name>: no longer needed` once the parent asks for the fixed version itself, said without failing it.

To move: run `npx ddd-ts-kit doctor` after an install; remove an override it says is no longer needed from the file it names, then install again.

## 0.89.0

**`clean/one-export-per-file` runs under the JS plugin API of Oxlint.** The rule walked the
tree of a file through a node a parser may leave null (the body of a declaration without one),
which the parser of ESLint never does and the one of Oxlint does: under Oxlint the rule stopped
on 2,494 of the files of the kit with `Cannot convert undefined or null to object`. The walker
now walks nothing for what is not a node. The plugin as a whole runs under
`oxlint --type-aware` with `jsPlugins` set to `@ddd-ts-kit/eslint-plugin`, which stays a trial:
the API is alpha, and `no-redeclare` of Oxlint contradicts the compiler on a class and an
interface of one name.

**`clean/stepdown` reports on a JavaScript file too.** The rule kept the references of a function
that the scope manager of typescript-eslint marks as values; the scope manager of the default
parser of ESLint, which lints a `.mjs`, `.cjs` or `.js` file, marks nothing, so on such a file the
rule found no caller and reported nothing. A reference the parser does not qualify is a value
now. The preset of the kit applies the rule to TypeScript sources only; a project that applies it
to its scripts as well sees what it reports there from this version on.

**`ddd-ts-kit lint` keeps the cache of ESLint, and the pipeline of a project restores it.** The
command lints with the cache of ESLint keyed by the content of each file (`.eslintcache/`, ignored
by git): a second run on a tree that did not change lints the files that changed since, in a
second or two instead of the whole project. The cache keys on the files and the config, not on the
rules as installed, so the command drops it when the lockfile, `eslint.config.mjs` or
`ddd-ts-kit.config.json` changed since it was written. The lint job of the pipeline `init` writes
restores, on a pull request or a merge request, the cache the default branch wrote last for the
same lockfile and config, and the default branch and the night lint everything and write it: a
type changed in another file is seen there. `ddd-ts-kit lint --no-cache` lints every file again.

To move, by hand, not with `init --force`, which rewrites far more than the pipeline: add
`.eslintcache/` to `.gitignore`; in `.github/workflows/ci.yml`, give the lint job the two steps of
the template (`actions/cache/restore` of `.eslintcache/` before the lint, on a pull request only,
keyed by the lockfile, `eslint.config.mjs` and `ddd-ts-kit.config.json` with a prefix fallback;
`actions/cache/save` after it, on the default branch and the night only), as
`node_modules/ddd-ts-kit/templates/pipeline/github/workflows/ci.yml.tpl` writes them; in
`.gitlab-ci.yml`, add the second `cache:` entry of the lint job (`.eslintcache/`, keyed by the
lockfile and `eslint.config.mjs`, `policy: $LINT_CACHE_POLICY`) and the `LINT_CACHE_POLICY` variable
of each workflow rule (`pull` on a merge request, `pull-push` on the default branch and the night),
as `templates/pipeline/gitlab/gitlab-ci.yml.tpl` writes them.

**A proposal page says what privacy by design asks of the kit beyond event sourcing, and the
pull requests that build it.** `docs/proposals/privacy-by-design.md` verifies what the kit
erases today (the personal values of stored events, by crypto-shredding, with a dated audit
entry) and what nothing of the kit erases, exports, retains or inventories: the aggregates kept
as rows on the four ORMs, the read models, the copies a person leaves in the contexts that
consumed its events, the masks of the audit trail. It designs one declaration of the personal
fields, read by ports with an adapter per ORM, by generators, by a generated register and by
`privacy/*` rules, nothing of it mandatory for a project without personal data; cuts the work
into pull requests in merge order, the example first; and says what a tool can never guarantee,
with the wording that follows for the README. The glossary of the translations gains the terms
of the page. Nothing of the code changes.

**The scheduling example erases a person from every copy the contexts keep, not from the sealed
words alone.** `npm run erase:patient` destroyed the key the words of a patient were sealed with
and rebuilt the projections, and left the person named and reachable in the tables: the person of
`identity` (name and address), the contact of `notification`, the notes the staff wrote on their
appointments, the reasons of their cancellations, the documents attached to those appointments and
the name the practitioner directory of `scheduling` copied. The erasure now reaches each of them,
network by network (`NETWORKS`), after the key and before the rebuilds: `identity` forgets the
person (`PersonRepository.erase`), `notification` deletes the contact, `scheduling` replaces the
notes and the reasons by `[erased]` and deletes the documents from the file storage
(`KnexPatientErasure`). The report of the script counts the rows each copy reached; a copy that
fails does not stop the others and running the script again completes the erasure; a run again
once nothing is left is refused and recorded. The README of the example says what an erasure does
not reach: the events published before it, the backups, the opaque ids of the audit trail. The
first part of the proposal [privacy by design](../docs/proposals/privacy-by-design.md) built; the
hand-written steps are the specification of the erasure port the next parts bring to the kit.

**A proposal specifies a second example, spend management on the most popular stack.** `docs/proposals/spend-management-example.md` runs the stack NestJS, class-validator, Jest, Prisma, Kafka, Redis, S3, shared-table tenancy, Keycloak, ABAC, Winston, Scalar through `init --dry-run` and lists what the kit refuses today on it: the queue and the processes on `--di nest`, the shared-table tenancy, the jobs table and the SQL audit trail on Prisma, the identity preset on Nest, Prisma and the explicit style. It specifies those fixes first, then the example (seven bounded contexts on expense reports, corporate cards, approvals, budgets, reimbursements and the ledger), then what the repository gains; MySQL is left out with the list of what it would take. Nothing is built by this change.

**The kernel declares the personal fields of a table and erases a data subject end to end: the
key, every copy in every tenant, the rebuilds.** `personalFields(table, { subject, fields,
erasure, files? })` says, next to the mapper, which columns of a table are personal, whose they
are and how the rows of a subject are erased, `row` deleted or `pseudonymise` read as `[erased]`,
the files they name deleted from the storage. Two ports a context extends and names, as it extends
`Repository`: `PersonalDataErasure` (`erase(subject)` answers the rows reached, none the second
time) and `PersonalDataExport` (`exportOf(subject)` answers one `PersonalDataRecord` per row,
each personal column as plain data). `eraseDataSubject`, lifted from the scheduling example,
destroys the key, erases every copy in every tenant (`inEachTenant` runs a copy in the context of
the work given each tenant, since a write of tenant data is never widened), rebuilds the
projections fed by the store, and reports `{ erased, copies, rebuilt }`; a copy that fails does
not stop the others, and running the erasure again completes it; a subject that is not an opaque
identifier is refused before any key is touched, and an id nothing is left of is refused before
the rebuilds; `keys` may be left out, as in a project whose aggregates are rows and seal nothing:
the copies alone are erased, and the report says no key was destroyed. `InMemoryPersonalData` implements both ports over one declaration, and
`personalDataErasureContract` and `personalDataExportContract` of `@ddd-ts-kit/testing` hold it
and every adapter to the same behaviour. The adapters of the persistence packages, the platform
folder `init` writes and the register come with the next parts of
[privacy by design](../docs/proposals/privacy-by-design.md). The persistence skill says it.

**The audit trail masks a personal value under the key of the person it belongs to, so that
erasing the person makes its masks meaningless.** `subjectMasker(keys)` of `@ddd-ts-kit/audit` is
an `AuditMasker` over the `SubjectKeyStore` of the kernel, the same keys that seal the personal
values of the stored events: each mask is an HMAC under a key derived from the key of the data
subject (HKDF, labelled for the trail), written `<keyId>:<hex>`; `SubjectKeyStore.erase` destroys
the key, and the masks made with it become tokens nobody can recompute while the entries and the
chain stay as they are. A masked field says whose its value is, `masked('patientEmail', { subject:
'patientId' })` or `subjectOf: (command) => ...`; `auditMiddleware` refuses, at wiring time, a
masked field that names none when the masker is keyed per data subject
(`MissingDataSubjectError`), and the masker refuses a subject that is not an opaque identifier
before any key is created (`MaskingSubjectNotAnIdError`): a name or an email named as the subject
would be written into the key store in clear. `hmacMasker` under one secret stays as it was.

What a masker or a declaration written by hand sees: `MaskingSubject` gains `dataSubject`, set
only for a masked field declared with `subject` or `subjectOf`; `AuditProjection` gains
`subjects`, the data subject of each masked value by field, which `auditedFields` fills and a
projection of your own may fill; `AuditedMessage` gains `subjectless`, optional, the masked fields
that name no subject, which `auditedFields` lists and a declaration of your own may leave out;
`AuditMasker` gains `requiresDataSubject`, optional, which a masker keyed per person sets so that
the middleware checks the declarations at wiring time. Nothing existing changes shape or meaning.
Part 2 of [privacy by design](../docs/proposals/privacy-by-design.md).

**`init` writes `src/platform/privacy/` with `--privacy on`, the default with an ORM, and wires the
event store with `--event-sourcing on`: a generated project erases and exports a data subject from
its first minute, and pays no table it did not ask for.** Two choices of the stack, recorded as
`stack.privacy` and `stack.eventSourcing`, each changed later by `init --force`.

`--privacy on` writes `src/platform/privacy/`: a context that erases or exports what it keeps of a
person lists its port in `data-subject-copies.ts` or `data-subject-exports.ts`; `run-erasure.ts`
opens an execution context of origin `cli` with the operator as actor and runs `eraseDataSubject`
of the kernel over the copies, in every tenant with `--tenancy shared-table` (`inEachTenant`);
`run-export.ts` gathers every record. Two scripts answer the requests: `npm run privacy:erase --
<subject-id> [--operator <who-asks>]` and `npm run privacy:export -- <subject-id>`, on the sources
with the variables of `.env`, the tenants named by `TENANTS`. What they cannot reach is said where
they are written: backups, logs, exports and a copy no context declared. No HTTP command erases yet.
A project without personal data takes `--privacy off` and gets none of it.

`--event-sourcing on`, off unless asked, since keeping an aggregate as its events is a choice made
per aggregate: `Persistence` gains `eventSourcing` (`create<Orm>EventSourcing` in the `event_store`
schema, whose five tables the schema file of Knex, Drizzle, Prisma and TypeORM then declares; the
in-memory stores without a database), and `src/platform/event-sourcing/` holds the `SubjectKeyStore`
of that store, wrapped by `auditedSubjectKeys` of `@ddd-ts-kit/audit` when the audit trail is on, so
that every erasure leaves a dated entry, and the `PersonalDataCipher` over it; `event-sourcing.module.ts`
binds `EventStore`, `SnapshotStore`, `CheckpointStore`, `SubjectKeyStore` and `PersonalDataCipher`
on tsyringe, the hand-wired `Platform` carries them as `platform.eventSourcing`, and
`platform-test.module.ts` binds the in-memory stores, so a handler spec of an event-sourced
aggregate needs no fake. With both choices on, the erasure destroys the key first. The event store
of the kit runs on PostgreSQL through the four ORM packages: `--event-sourcing on` is refused with
`--orm custom`, with what to bind instead, and `generate aggregate --event-sourced` is refused
while the project has no event store, with the `init --force --event-sourcing on` to run. The
architecture reference (section 2), the CLI README, the config reference, the event sourcing page,
the persistence skill and the stack criteria say it.

To move: a project generated before this version keeps its platform as it is; `npx ddd-ts-kit init
--force --privacy on` writes the privacy folder and the two scripts, `npx ddd-ts-kit init --force
--event-sourcing on` the event store, then a migration creates the tables of the `event_store`
schema (`npm run db:generate event-store`).

**The erasure of a data subject from the tables of a context exists on the four ORMs, from the
`personalFields` declarations.** `KnexPersonalDataErasure`, `DrizzlePersonalDataErasure`,
`PrismaPersonalDataErasure` and `TypeOrmPersonalDataErasure` implement the `PersonalDataErasure`
port of the kernel over the unit of work of their package: the files the rows name are deleted
from the storage first, then the rows of the subject are deleted (`row`) or pseudonymised
(`pseudonymise`: a text column reads `[erased]`, a column of any other type nothing, a file column
nothing), and the rows reached are counted, none the second time. With the `tenant` option every
statement is confined to the tenant of the work and never widened by an elevation. A subject that
is not an opaque identifier is refused before any statement; a declaration that names file columns
without a file storage is refused when the adapter is built, and one that names a column or a
property the table does not have is refused before any file or row is touched. The types of the columns decide how a
column is pseudonymised (`pseudonymisedValueOf` of the kernel, the one rule the four follow), read
from the database on Knex and Prisma, from the table definition on Drizzle, from the entity on
TypeORM: a personal column that is not a text has to accept null, and a declaration that would
pseudonymise one that does not is refused before any file or row is touched
(`NotNullablePersonalColumnError`), so that an erasure never deletes the files of a person and
leaves their rows in clear. The four pass
`personalDataErasureContract` of `@ddd-ts-kit/testing`, on PGlite and PostgreSQL. Part 3 of
[privacy by design](../docs/proposals/privacy-by-design.md); the generator writes the declarations
in part 5, and the example adopts the adapter in part 11.

**The background jobs and the process managers run on a platform wired by hand: NestJS and `--di manual` gain `--queue database|redis`, `generate background-job` and `generate process`.** The platform of a project whose contexts are wired in a module file gains `src/platform/jobs/create-background-work.ts`, which builds the queue a use case enqueues through (`platform.jobQueue`), the worker that consumes it (`platform.backgroundJobs`) and the runner of the process managers (`platform.processes`) on the store `stack.queue` names: the jobs table of Knex or Drizzle, the server of the cache with Redis, the memory of the process otherwise, each job traced and its failures reported as on tsyringe. `init --queue database` and `--queue redis` are accepted with every container (the default stays `database` on Knex or Drizzle with tsyringe, `memory` otherwise), the application starts and stops the worker with its jobs, and `generate background-job` and `generate process` register the job in `<context>.module.ts` (`platform.backgroundJobs.register(..)`) with a spec built on the test buses of `@ddd-ts-kit/testing`, where they were refused before. The generated matrix runs background work on every stack, Nest with the jobs in the database and on Redis among them.

To move: a project on Nest or wired by hand that initialised before this version keeps its queue in memory; `init --force --queue database` (Knex or Drizzle) or `--queue redis` (with `--cache redis`) writes `create-background-work.ts` and the stores, then `generate background-job` works as on tsyringe. `PlatformOptions` gains `queues` (concurrency per queue, polling interval, grace period of the worker).

**The shared-table tenancy reaches Prisma and TypeORM: `init --tenancy shared-table` and `generate repository --tenant-scoped` work on the four ORMs, and `tenancy/scoped-statement` judges their adapters.** `@ddd-ts-kit/prisma` and `@ddd-ts-kit/typeorm` gain `tenantWhere(scope)`, spread into the where of every read (the tenant of the work, or the tenants an elevation of platform staff reaches), and `ownTenantWhere(scope)`, spread into the where of every update and delete (the one tenant of the work, which an elevation never widens); an inserted row spreads `tenantScopeOf`. Their outbox keeps the tenant of each event so that its consumers run in that tenant: `tenant: true` on `PrismaOutboxStore`, with the `tenantId` field the shipped fragment leaves commented out, and `outboxEntity({ tenant: true })` on TypeORM. Their read model stores take the `tenant` option of the Knex and Drizzle ones: every row written in the tenant of the work, every read, search and write confined to it, the copy of a rebuild included. Both repositories pass `tenantIsolationContract` of `@ddd-ts-kit/testing`, both outboxes the outbox contract with the tenant. `init` accepts `--tenancy shared-table` with `--orm prisma` and `--orm typeorm`: the generated repositories read with `findFirst` or `findOneBy` and `tenantWhere`, write with `ownTenantWhere`, name the tenant on the insert, declare `tenant_id` and an index that starts with it (the Prisma model, `tenantColumn()` on TypeORM), and the generated outbox keeps the tenant. The rule `tenancy/scoped-statement` reads a Prisma statement on the client (a read without `tenantWhere`, a write without `ownTenantWhere`, a create without `tenantScopeOf`, `findUnique` and `upsert`, raw SQL, the client held in a variable) and a TypeORM statement on the manager (the same, `save` and `upsert`, a query builder without the condition, a row handed to `insertIgnoringConflict` that names no tenant, `query`), and a read model store of the four ORMs built without its `tenant`. The generated matrix gains a Prisma and a TypeORM stack on shared tables.

To move: a Prisma or TypeORM project that confined its statements by hand with `tenantScopeOf` keeps working; `tenantWhere` in the where of its reads lets an elevation of platform staff read across tenants, and the rule asks for it once the project records `"stack.tenancy": "shared-table"`. A multi-tenant project on Prisma adds `tenantId String? @map("tenant_id")` to its outbox model, migrates, and gives `PrismaOutboxStore` `tenant: true`; on TypeORM it builds its outbox with `outboxEntity({ schema, tenant: true })` and generates the migration that adds the column.

**`generate repository --personal <column>,...` declares what a table keeps of a person, and writes the
erasure of its context: one command, and `npm run privacy:erase` reaches the new copy.** The named
columns join the storage and the row type of the aggregate as nullable text (the mapper writes them
empty until the aggregate carries them), and `<aggregate>.personal-fields.ts` declares them next to
the mapper with `personalFields` of the kernel: the subject column, `id` unless `--subject` names the
column that holds the id of the person, the fields, and `pseudonymise` unless `--erasure row` asks for
the row to be deleted; the declaration is spelled as the erasure of the ORM reads it, SQL names on
Knex and Prisma, properties on Drizzle and TypeORM. The first table of a context that declares
personal data brings the erasure of the context: the port
`application/ports/<context>-personal-data-erasure.port.ts` (`extends PersonalDataErasure`), the
adapter `<orm>-<context>-personal-data-erasure.repository.ts` over `<Orm>PersonalDataErasure` of the
ORM package (confined to the tenant of the work on a tenant-scoped repository), its fake, a spec that
saves two people through the repository and proves the erasure on the test database, the binding
where the context binds its adapters (the decorator in the declared style, the module file otherwise,
the factory of the hand-wired platform wrapped like any other adapter) and its line in
`src/platform/privacy/data-subject-copies.ts`. A second table of the same context joins the
declarations of that adapter. `*.personal-fields.ts` is a file of `infrastructure/persistence/` the
`naming/suffix` rule knows. Refused before anything is written: a project whose `stack.privacy` is
off (`init --force --privacy on`), `--orm none` or `custom` (no erasure adapter of the kit reads the
declaration), a column that is not one, a column the table keeps for itself, a subject listed as
personal, a mode that does not exist, `--subject` or `--erasure` without `--personal`. The CLI README,
the scaffold and persistence skills, the architecture reference and the proposal say it; a projection
keeps its rows in a read model store, not in a table of its own, so its declaration waits for the
register.

Proven end to end on generated projects: through the composed application (the container of
tsyringe, the platform wired by hand under Nest), two contexts and three tables, one person erased
from all of them in one run, in every tenant of a multi-tenant project or in the tenants given, the
key of the event store first when the project has one. That run uncovered a fault of the Knex erasure
adapter the direct tests could not see: bound in an application, every method of an adapter is
wrapped by tracing and by the aspects, and a helper that answered a query builder was awaited and its
chain broken; the helper is a function now, and the Knex spec runs the adapter wrapped the way the
platform binds it. `init --force`, which rewrites `data-subject-copies.ts`, lists the erasure of each
context again, as the port or as the factory of the hand-wired platform. The new concept page
[Personal data in a generated project](../docs/concepts/personal-data.md) draws the erasure end to
end, what stays out of reach and what the tool does not decide, in both languages.

**Mutation testing runs on a project of the kit, with Stryker 10.1.1 and its Vitest runner.** The
documentation said it did not: Stryker 10.0 executed no test per mutant under Vitest 5. Measured
on 2026-10-24 on the example application, 10.1.1 runs the tests per mutant and kills 1347 of the
1441 mutants of the domain layer of its four contexts in 8 minutes, a score of 94.5%; the
pipeline README holds the measure, the configuration to run it by hand (no checker, the unit
specs alone, the domain layer as `mutate`) and what shipping it as a scheduled job with a floor
per context would take. The kit ships no gate yet.

**The right of access and to portability comes built in: `KnexPersonalDataExport`,
`DrizzlePersonalDataExport`, `PrismaPersonalDataExport` and `TypeOrmPersonalDataExport` read the same
`personalFields` declarations as the erasure, `exportDataSubject` of the kernel gathers every export
into one dated document, `auditedPersonalDataExport` of the audit package leaves the entry of each
handover, and `generate repository --personal` writes the export of a context beside its erasure.**
Each adapter answers one `PersonalDataRecord` per row about the subject in every declared table, under
`<name>.<table>`, with the personal columns and the keys of the files as plain data, no other column
and nothing of anyone else; the same `tenant` option confines every statement to the tenant of the
work, a subject that is not an opaque identifier is refused before any statement, and each passes
`personalDataExportContract`, whose `source` now reads the name of the exporter alone or followed by
the table. `exportDataSubject(subject, { exports, inEveryTenant, clock, isKnown })` answers a
`PersonalDataExportDocument`: `format` (`ddd-ts-kit/personal-data-export@1`), `subject`, `exportedAt`,
`records`; the exports run in the order listed and one that fails stops the gathering, a mistyped id
is refused when `isKnown` denies it rather than answered with an empty document, and
`recordsInEachTenant(scope, tenants)` reaches every tenant as `inEachTenant` does for an erasure
(both over `eachTenant`). `auditedPersonalDataExport(port, trail, { scope, clock, ids })` wraps a
port so that every `exportOf` writes an entry of category `data-access` and action
`personal-data:export` (`PERSONAL_DATA_EXPORT_ACTION`), with the subject as resource, the context,
the number of records and never the values, before the records are handed over: when the entry
cannot be written, nothing is handed over. In a generated project, `src/platform/privacy/run-export.ts`
runs `exportDataSubject` over the exports, each wrapped when the trail is on, and
`scripts/privacy-export.ts` prints the document as JSON; `generate repository <ctx> <Aggregate>
--personal <column>,...` writes, once per context, the export port (`extends PersonalDataExport`),
the adapter over `<Orm>PersonalDataExport`, its fake and its line in `data-subject-exports.ts`, bound
where the context binds its adapters, and one spec `test/integration/<context>-personal-data.spec.ts`
proves the erasure and the export; a second table joins the declarations of both adapters, and
`init --force` lists the exports again. The concept page draws the export end to end with its
diagram, in both languages, and the kernel, audit, ORM and CLI READMEs, the audit trail page, the
proposal and the skills say it.

**Mutation testing of the domain layer runs every night, each context held to a floor.** `init`
writes `stryker.config.mjs`, which spreads `governedMutation()` of `@ddd-ts-kit/testing/mutation`:
the domain layer of every context mutated, at its level and in the modules of its model, the
texts of refusals left out by an ignorer the kit ships, since a refusal is asserted by its code and
never by its text, every other string measured, the static mutants ignored, those of code that runs
once when the module loads, the floor as
`thresholds`; and `vitest.mutation.config.ts`, the unit specs alone. `npm run test:mutation` runs
Stryker, then `ddd-ts-kit mutation`, a new command that reads `reports/mutation/mutation.json` and
holds the domain of each context to the `mutation` floor of `ddd-ts-kit.config.json`, 80 by the
reference (a lower floor is a recorded deviation, `"what": "mutation.domain"`), and exits 1 under
it; the ignored mutants of each context are shown beside its score, since a rule written as a
declaration is never mutated and its test is its only proof. The pipelines of GitHub and GitLab get a
`mutation` job that runs it when the schedule fires, never on a pull or merge request, and keeps
the report as an artifact. A new rule, `test/mutation-governed`, refuses a `mutate`,
`mutator`, `ignorers`, `ignoreStatic` or `thresholds` written by hand in a Stryker config, and a
Stryker config that does not read the kit. The example application and the pipeline of the kit run
the same job. On both runners: a project on Jest gets `jest.mutation.config.js` in place of the
Vitest one, and its Stryker config passes the ES modules flag to the processes that run the specs.

To move: `npm i -D @stryker-mutator/core @stryker-mutator/vitest-runner` (`jest-runner` on Jest),
copy `stryker.config.mjs` and `vitest.mutation.config.ts` or `jest.mutation.config.js` from a
freshly initialised project (or run `init --force` on a copy and take the two files and the
`test:mutation` script), add the
`mutation` job to your pipeline from `pipeline/github/workflows/ci.yml` or
`pipeline/gitlab/.gitlab-ci.yml`, list `vitest.mutation.config.ts` under `vitest.config` of
`knip.json`, and add `.stryker-tmp/` and `/reports/mutation/` to `.gitignore`. Run
`npm run test:mutation` once: a context under 80 names the rules its tests do not state.

**Six rules of `@ddd-ts-kit/eslint-plugin` hold the shape of a test.** The testing skill asked
for it and nothing checked it: a test is named after the rule it proves, holds no logic, asserts an
outcome, asserts a refusal by its code, never by a snapshot, and every test runs. Each is a rule
of the architecture reference now, on every test file of the project (`*.spec.ts`, `*.test.ts`,
the `test/` of a context), read by ESLint alone: `test/no-only-no-skip` (no `.only`, `.skip`, `fit`,
`xit`, `xdescribe`, no `.skipIf` or `.runIf` on a constant), `test/title-states-a-rule` (the title of an `it`
in lower case, what the subject does, after the rows and the criterion it cites, never `should`,
`test`, `works` nor a method or a class; a `describe` named after the unit),
`test/no-logic` (no `if`, `switch`, ternary, loop or `try` in a test), `test/assertion-present`
(an `expect`, an `expect...` or `assert...` helper, or `thenEvents`, `thenError`, `thenState` in
every test; `it('title')` without a body written `it.todo`), `test/refusal-by-code` (`toThrow`
with a message, a regular expression, a class or nothing reported in the specs of the model and of
the application, not in those of the adapters and of the platform; `thenError`, `expectRefusal`,
`rejects.toMatchObject({ code })` and `expectProblem` instead, and `rejects.toBe(outage)` for a
failure the test injected) and
`test/no-snapshot`. `ddd-ts-kit rules` lists them as checked by the plugin, `ddd-ts-kit explain`
explains each, the config sets their severity under `rules`. The `it.todo` left in a spec was
already a marker `ddd-ts-kit todo` lists and `story --gate close` refuses while it belongs to the
story: the testing strategy and the skill now say so. The example application and the templates
follow the six rules; the rules of the agents on tests (`.claude/rules/tests.md`,
`.github/instructions/tests.instructions.md`) name them.

To move: run `npm run lint`. `test/no-only-no-skip` and `test/no-snapshot` are errors, as nothing
legitimate trips them; the four rules that read what a test says, `test/title-states-a-rule`,
`test/no-logic`, `test/assertion-present` and `test/refusal-by-code`, are warnings until 0.90.0,
listed by `ddd-ts-kit lint` after its report without failing it. Rename a title that says
`should` or names a method, move a loop to an `it.each` and a decision to a builder or a fake,
replace a `toThrow('message')` by the code of the refusal, and write `it.todo` where a test has
no body. A project that wants none of a rule sets it to `off` under `rules` of
`ddd-ts-kit.config.json`.

**A pull request gets a reading of its mutation score, the night keeps the whole measure.** The
pipelines of GitHub and GitLab get a `mutation-changed` job on a pull or merge request: it reuses
the report of the last night for what the change leaves alone (Stryker's incremental mode, turned
on by `governedMutation()` when `DDD_TS_KIT_MUTATION_SINCE` names the merge base of the change,
the results kept in `reports/mutation/incremental.json` beside the report), runs everything again
when the change touches code the tests lean on and Stryker does not diff (a fake, a builder, a
world, the platform, a dependency), and lists the survivors of the files the change touched:
`ddd-ts-kit mutation` reads the same variable (`--changed <ref>` says it by hand) and exits 0
whatever the scores, a reading and never a gate, so that `npm run test:mutation` is the one script
of the night and of a pull request. `ddd-ts-kit mutation --survivors` lists every survivor of the
report, where, what mutator and what the code became. `test/mutation-governed` also refuses `incremental` and `force` written by
hand.

To move: add the `mutation-changed` job to your pipeline from `pipeline/github/workflows/ci.yml` or
`pipeline/gitlab/.gitlab-ci.yml`; nothing else changes, the Stryker config spreads
`governedMutation()` already.

**The invariants of a value object are stated as properties, with fast-check.** `fast-check` joins
the development dependencies with the first property (`npm i -D fast-check`, under Vitest as under
Jest: a project without a property carries no dead dependency); `fc.assert(fc.property(..))` is an
assertion for `test/assertion-present`; and the spec `generate value-object` writes ends with a
planned rule, `keeps its invariants for any value a generator can produce, as a property`, to remind
of it. A property states a law of the model once and checks it on generated values, the failing one
printed with its seed and shrunk to the smallest: two ranges overlap in both directions or in none,
a slot is held at least until it ends, a parse then a format gives the value back. The example
states four on its ranges and slots. A property is for a law, an invariant, a symmetry, a round trip,
an idempotence; the orchestration of a use case is stated by its scenarios. The testing skill and
the testing strategy say when and how.

To move: `npm i -D fast-check`, then state the first law a value object of yours holds for every
value.

**An erasure now reaches beyond the database the platform holds: `privacy:erase` announces
`privacy.data-subject.erased` through the outbox once every copy is erased, `generate
erasure-handler <context>` writes the idempotent handler of a context that erases its own copy, and
an integration event says which fields of its payload are personal, and whose.** The event is
`dataSubjectErasedV1` of `@ddd-ts-kit/kernel`, version 1, `{ subjectId, erasedAt }`:
the id of the person and nobody else, the operator staying in the audit trail that the correlation id
of the event leads to, a name or an email refused at `create` (`InvalidDataSubjectErasedError`). It lives
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

**The mutation score holds the application layer too, at a floor of its own.** `governedMutation()`
mutates the application layer of every context beside its domain, at its level and in the modules
of its model, and `ddd-ts-kit mutation` scores each layer of each context against its floor: the
`mutation` key of `ddd-ts-kit.config.json` takes `"application"` beside `"domain"`, 75 by the
reference, five below the domain as the coverage reference steps down from one layer to the next,
and lowering it is a recorded deviation (`"what": "mutation.application"`). The use cases hold
rules the domain does not: the permission a command requires, the idempotence of a handler, the
event it publishes, the refusal it relays; a survivor there is a rule no test states as much as in
an aggregate. On the example the application layer scores 95.7, its lowest context 93.5, and the
run grows by twenty seconds: the initial test run is what the night pays for, not the mutants.

To move: nothing, unless a context sits under 75 on its application layer: `npm run test:mutation`
names the survivors to read, a test to write for each rule, or a deviation to record.

**The audit trail of a generated project on Prisma or TypeORM is kept in its database, no longer in
the memory of the process: `@ddd-ts-kit/audit/prisma` and `@ddd-ts-kit/audit/typeorm` give
`PrismaAuditTrail` and `TypeOrmAuditTrail`, held to the same contract as the Knex and Drizzle
stores.** Until now `--orm prisma` and `--orm typeorm` started on an `InMemoryAuditTrail` behind a
`TODO(platform)`, so the proof of every command, decision, erasure, export and purge was lost when
the process stopped. The four stores share one PostgreSQL implementation (the hash chain, the head
locked per chain, the entries written at the commit of the unit of work). `auditPrismaModels(schema)`
gives the two Prisma models and `auditEntities({ schema })` the two TypeORM entities; their specs
prove that, created by the migrations of a project, they give the columns, the keys and the
indexes of `createAuditTables`. On Prisma the statements are raw ones on the client of the unit of
work, an append inside a transaction takes a savepoint, a failure of the database comes back with
its SQLSTATE as `code`, and the reader asks PostgreSQL for the instant in UTC, since the adapter of
pg reads a `timestamptz` without the offset of the session (the shared reader does so for every
store). `init --audit on` with Prisma or TypeORM writes the models in `prisma/schema.prisma` (the
`audit` schema added to the datasource) or the entities in `schema.ts`, binds the store in
`create-audit.ts`, adds `npm run db:audit-guard` for the append-only guard to paste in a
migration, and the test databases install that guard and leave the trail out of `reset()`.

To move: a project on Prisma or TypeORM with `--audit on` runs `init --force` to get the store, then
generates a migration for the two tables and adds one holding what `npm run db:audit-guard`
prints.

**Each spec file is held to the time budget of its level.** The reporter of the test runner the kit
ships, `@ddd-ts-kit/testing/budget/vitest` and `@ddd-ts-kit/testing/budget/jest`, named in the runner
config `init` writes and passed with `--reporter` where the pipeline names its reporters, reads the
`budget` key of `ddd-ts-kit.config.json`, five seconds for a unit spec file and thirty for an
integration spec file by the reference, names the slowest spec of each level at the end of every run,
and warns when a spec file took more than its budget, its tests and hooks timed, the loading of its modules left out; `"enforce": true` under `budget` makes it fail the run, once the measures of a project are stable, since a duration depends on the load of the machine as much as on the spec. A unit
spec of a context runs the model and the use cases on fakes; an integration spec of a context, and a
spec of the platform, opens a database or reaches a server; the specs of the application outside the
contexts (end to end, acceptance, architecture) are not held. A slow spec hides a world rebuilt per
test, I/O behind a fake, or a wait: lowering a budget is free, raising one above the reference is a
recorded deviation (`"what": "budget.unit"`), and a budget that is no duration is reported by
`config/valid`. On the example, the slowest unit spec takes 1.6 seconds and the slowest integration
spec 11, under load.

To move: name the reporter in your runner config, `reporters: ['default', '@ddd-ts-kit/testing/budget/vitest']`
(or `budget/jest`), and in the commands of your pipeline that pass `--reporter`.

**The oldest entries of the audit trail leave the database for the file storage, verified and
anchored: `archiveBefore(date, { files, clock })` on the four SQL stores and on
`InMemoryAuditTrail`, and a generated project archives every month what is older than the twelve
whole months it keeps online.** Each entry keeps the identifiers of a person, and a trail grows
for as long as the system lives (GDPR article 5(1)(e)). For each chain, in one transaction
holding its head, the entries after the last archive and older than the date are verified from
the anchor of the archive before them, written to one file (`audit-archives/<chain>/<from>-<to>.ndjson`,
one canonical JSON per line), recorded in the new `audit_archives` table with their last hash
and the SHA-256 of the file, then deleted: the guard of the trail lets a `DELETE` through only
for entries an archive covers, and refuses any change to the archives. A chain that does not
verify is refused (`AuditArchiveRefusedError`) and keeps every entry. `archivesOf(chain)` lists
the archives, `verifyArchive(text, archive, previous)` checks a file again, and `verifyChain`
takes `after`, the anchor the entries left in the database start from. `ArchiveAuditEntries` is
the scheduled job; `init` registers it as `audit.archive` (first day of the month, 04:00 UTC,
`JOB_AUDIT_ARCHIVE_ENABLED=false` switches it off) when the trail is in a database and the
project keeps files in a storage, and declares the archives with the rest of the trail on the
four ORMs. Archiving moves, it does not erase: how long the files are kept is the controller's
decision.

To move: a trail created before this version adds the archives once, in a migration:
`addAuditArchives(knex, { schema: 'audit' })` on Knex; on Drizzle, Prisma and TypeORM, `init
--force` declares the table, the migration of the ORM creates it, and a migration of your own
runs the statements of `auditArchiveUpgradeStatements('audit')` (the guard that lets archived
entries go, and the guard of the archives). Until then, `archiveBefore` fails on the missing
table and the job reports the failed run.

**In a context wired by hand (`--di manual`, `--di nest`), `generate repository` no longer creates
the repository in the module file: the first `generate command --aggregate` that needs it does, and
the next one finds it there.** Until now the module file of a context with a repository and no
command yet held a constant nothing read, and its import, which the lint of the project refused
(`no-unused-vars`). `declarations/port-adapter-wired` agrees: an adapter whose port no class needs
yet (no file outside the infrastructure and the tests names it, but the one that declares it) is not
reported, since nothing misses it at run time.

To move: nothing. A module file written by an earlier version keeps its constant; the next command
on the same aggregate finds it and adds nothing.

**What a table keeps of a person can now be kept for a set time: `personalFields` takes a
`retention`, the erasure adapters of the four ORMs purge what outlived it, and a generated project
runs that purge every night, audited.** `retention: { after, days | months | years }` counts the
period from a date column of the row that is not personal data, one positive unit (refused
otherwise); a row whose date is empty never expires. The kernel adds the port
`PersonalDataRetention` (`purgeExpired(now)`), `purgeExpiredPersonalData(now, retentions)`, which
runs every copy at one instant and answers the rows each reached, `expiredBefore` and
`isPersonalDataRetention`; `InMemoryPersonalData` implements it, and
`personalDataRetentionContract` of `@ddd-ts-kit/testing` holds every adapter to it. The erasure
adapters of Knex, Drizzle, Prisma and TypeORM implement `purgeExpired` from the same declarations,
as the declaration says, files first, in the tenant of the work or in every tenant when the work
names none: the one write of the kit across tenants, chosen because a tenant left out of a list
would keep what it should not, bounded to an erasure by the date of the row, and written in the
multitenancy page. `auditedPersonalDataRetention` of `@ddd-ts-kit/audit` records each purge (`data-access`,
`personal-data:purge`, the context, `changes: { rows }`, no person). `generate repository ...
--personal ... --retention <column>:<n><d|m|y>` writes the retention in the declaration, adds a
column that dates the end of the relation to the storage as a nullable timestamp, empty while it
lasts (it refuses `registered_at` and the other columns the table keeps for itself: counted from the
registration, the purge would erase people who are still customers), and proves the purge in the
generated spec. `init --privacy on` writes `src/platform/privacy/run-purge.ts`, schedules
`privacy.purge-expired` every night at 03:00 UTC (the privacy module on tsyringe, the platform wired
by hand), switched off by `JOB_PRIVACY_PURGE_EXPIRED_ENABLED=false`, and the script `privacy:purge`.
The concept page, the kernel, audit, ORM and CLI READMEs, the proposal and the skills say it, in
English and in French.

To move: `init --force` on a project with `--privacy on` writes the purge runner, the job and the
script; a declaration without `retention` purges nothing.

**`ddd-ts-kit docs` writes the register of personal data from the code: a Personal data section in
each `CONTEXT.md`, and with `--privacy on` the file `docs/privacy/register.md`, held to the code by
`docs --check`.** It reads every `personalFields` call of `infrastructure/persistence/*.personal-fields.ts`,
the one `generate repository --personal` writes or one written by hand (several per file), and the
`personal` option of the integration events. Each table is one row: the column that names the
person, the personal columns and files, what an erasure does (`pseudonymised`, `row deleted`), how
long the rows are kept (`36 months after ended_at`, or `until erased`); the columns are named as the
database names them on the four ORMs, a Drizzle or TypeORM declaration read back through the table it
names. The register adds the integration events that carry personal data and the contexts
downstream of their producer. It is not the record of processing activities of GDPR article 30:
the purposes, the lawful basis, the recipients outside the system and what the code does not purge
are sections around the markers that the controller writes and `docs` keeps.

To move: nothing to do. The next `npx ddd-ts-kit docs` (or `generate`) of a project with
`stack.privacy: "on"` creates `docs/privacy/register.md`, and adds the Personal data section to the
`CONTEXT.md` of each context that declares personal data; commit both, `docs --check` holds them
from then on.

**`ddd-ts-kit check` holds a project whose `stack.privacy` is `on` to its declarations of personal
data, with five new rules, all warnings: `privacy/declared-field`, `privacy/event-payload-declared`,
`privacy/erasure-reaches-copies`, `privacy/subject-is-opaque` and `privacy/no-personal-data-in-logs`.**
The erasure, the export, the retention and the register read the `personalFields` declarations and
the `personal` option of the integration events, never the columns: a copy of a person nobody
declared is a copy nobody erases, and nothing failed until now.

- `privacy/declared-field`: a column of a table of a context (Knex, Drizzle, TypeORM, and the Prisma
  models in the schema of the context) whose name holds a word of the personal vocabulary and that
  no declaration of its context names.
- `privacy/event-payload-declared`: a field of the payload of an integration event named like
  personal data that its `personal` option does not list.
- `privacy/erasure-reaches-copies`: a context that consumes an event carrying personal data (a
  handler, a projection, a process manager) and declares no `PersonalDataErasure` and handles no
  `privacy.data-subject.erased`.
- `privacy/subject-is-opaque`: the subject of a declaration or of an event that is personal data
  itself, or one of its personal fields.
- `privacy/no-personal-data-in-logs`: a call to the logger or to the metrics that names a declared
  personal field.

The identity preset declares what it keeps of people when `stack.privacy` is `on`: the address and
the name of an account (pseudonymised when the person is erased) and the address an invitation was
sent to (the row deleted thirty days after the invitation expired, by the nightly purge), with the
erasure and the export of the context written and listed in the platform, not confined to a tenant
since its tables belong to none.

The vocabulary is the one of the kit (`email`, `phone`, `first_name`, `birth_date`, `address`,
`iban`, `ip_address` and the others listed in the configuration reference); the new config key
`privacy`, `{ "vocabulary": [...], "allow": [...] }`, adds the words of the business and removes a
word that never names a person in the project. A project with `stack.privacy` off, or whose config
predates the choice, is not judged.

To move: nothing blocks. `npx ddd-ts-kit check --rule privacy/declared-field` (and the four others)
lists what to take up: declare the column (`generate repository ... --personal`), list the field in
`personal: { subject, fields }`, erase the copy (`generate erasure-handler` for a service of its own),
or record a column that holds nothing of a person, `// ddd-ts-kit-disable-next-line
privacy/declared-field -- ADR-NNNN: <why>` or a word of `privacy.allow`. The rules stay warnings:
they read names, never contents, so a column `address` of a warehouse is reported as well as the
address of a person; no later version turns them into errors. A team that wants them blocking sets
`"rules": { "privacy/declared-field": "error" }` in ddd-ts-kit.config.json, rule by rule.

**The monthly archive of the audit trail runs by default only when the files of the project are in
an object store, and no entry leaves the database before its file reads back from the storage as it
was written.** An archive removes the entries from the database; with `--storage local`, the default
of `init`, the files are on the disk of the server, which a redeployment may wipe and a backup may
not reach, and the proof of who did what would be lost a year after going live. A generated project
with `--storage s3` keeps the job on (`JOB_AUDIT_ARCHIVE_ENABLED=false` switches it off); one with
`--storage local` writes it off, and `JOB_AUDIT_ARCHIVE_ENABLED=true` switches it on once that disk
is durable and backed up, which `job-settings.ts` says next to the line. `archiveBefore` of the
four SQL stores and of `InMemoryAuditTrail` reads each file back and checks its digest before the
entries are removed: a storage that did not keep it is refused with the new
`AuditArchiveNotStoredError`, and the trail keeps every entry.

To move: a project generated with `--storage local` by the previous version has the job on; change
its line of `src/platform/jobs/job-settings.ts` to
`'audit.archive': { enabled: environment['JOB_AUDIT_ARCHIVE_ENABLED'] === 'true' }`, or keep it on
where the files already land on a durable, backed-up disk.

**The scheduling example declares what it keeps of people and erases and exports it through the
ports of the kit: `personalFields` in each context, a `PersonalDataErasure` and a
`PersonalDataExport` per context over the adapters of `@ddd-ts-kit/knex`, `eraseDataSubject` and
`exportDataSubject` of the kernel, and the register and the privacy rules on.** The persons of
identity and the contacts of notification are deleted, the notes, the cancellation reasons, the
documents and the copied names of scheduling pseudonymised; notification keeps its own erasure,
which deletes a contact under a stamp so that a redelivered announcement does not bring the address
back. The hand-written erasure engine of the example is gone, its platform folder is
`src/platform/privacy/`, `npm run erase:patient` becomes `npm run privacy:erase`, and `npm run
privacy:export` hands over one dated document of what every context keeps of a person, every
handover audited. `identity.person.registered` and `identity.practice.member-added` declare their
personal fields, so the event catalog and AsyncAPI say so; `docs/privacy/register.md` is generated,
with the sections a controller writes filled in as an illustration.

To move: nothing for a project. For a reader of the example: run `npm run privacy:erase` where
`npm run erase:patient` was run; the report names each copy by its context (`identity`,
`notification`, `scheduling`) and counts the rows reached.

**The tests are read back as a document: `ddd-ts-kit docs` writes `docs/behaviour/`, one page per
context of what its tests state.** Each page lists, in the words of the test titles, the rules of
the context grouped as the specs group them (`describe` and `it`, a table of cases as one rule), with
the role of each spec (`slot (value object), in calendars`), a planned rule (`it.todo`) and a spec
put aside said so, and the counts; `docs/behaviour/application.md` does the same for the specs
outside the contexts (end to end, acceptance, architecture) and `docs/behaviour/README.md` indexes
them. `npm run docs:generate` writes them with the other generated documents, the pre-commit hook `init` writes regenerates and adds them when a spec is staged, with `ddd-ts-kit docs --behaviour`, which writes those pages alone, and `docs --check` holds them
current, so a spec whose title changed never reaches the trunk without its page. This
is the reading the business asks of Gherkin, without a second language to keep in step: the title of
a test, which `test/title-states-a-rule` makes a rule, is the sentence. Under `generate --local-only`
the pages are left to the trunk, as every shared file is.

To move: run `npm run docs:generate` once and commit `docs/behaviour/`; add the `behaviour pages`
job to the `pre-commit` of your `lefthook.yml` from `pipeline/lefthook.yml`.

## 0.88.0

**The code list and the permission set of a context sit at its root: `<context>.codes.ts` and `<context>.permissions.ts`.** They are one per context, whatever its modules, so they now sit next to `CONTEXT.md` and `<context>.declarations.ts` instead of `domain/errors/codes.ts` and `application/authorization/<context>.permissions.ts`. `domain/errors/` holds the refusal classes, `application/authorization/` the policies, and a folder that held the code list or the permission set alone is gone. In a context divided into modules, `domain/` and `application/` now hold nothing but their modules. Every rule reads the two files as it read them in their role folder: `<context>.codes.ts` is the code list of the domain for `errors/*`, `naming/suffix` and the layer rules, `<context>.permissions.ts` the permission set of the application for `authz/*`. `ddd-ts-kit check`, the ESLint plugin and the generated `.dependency-cruiser.cjs` follow (the domain may import the code list of its context, the application both files). The generators, the templates, the identity preset and `error-factories` write them at the root, and knip is told of the code types as `src/contexts/*/*.codes.ts`, and also where 0.86 and 0.87 kept them as long as one context still holds its list there (`init`, `generate` and `context-layout` keep the two patterns in step with the tree). `ddd-ts-kit context-layout [<context>...] [--dry-run]` is new: it moves the two files of every context, or of the ones named, from where 0.86 and 0.87 wrote them to the root, rewrites every import of them under the source root, `test/` and `scripts/`, removes a role folder the move leaves empty, writes again what derives from the tree (`.dependency-cruiser.cjs`, the generated declarations) and tells knip of the code lists where they now are; it says each file it wrote, `--dry-run` included.

To move: run `npx ddd-ts-kit context-layout`, then the formatter, the checks and the tests, and commit the result. The generated `.dependency-cruiser.cjs` changes with this version, and `npm run depcruise` checks it first: `npx ddd-ts-kit depcruise-config --write`, `context-layout` or any `generate` writes it again. Beyond that file, upgrading alone fails nothing: for one minor version, a code list or a permission set still where 0.86 and 0.87 wrote it is accepted. `ddd-ts-kit check` reports it as a warning of `tree/closed` (exit 0) that names the command, and the generators and `init --force` keep writing it where it is, the imports they write included. A file both at the root and in its earlier place is an error. A later minor version reports the earlier places as errors.

**A module of the model holds its own layers: `<module>/domain/`, `<module>/application/`, `<module>/infrastructure/`, `<module>/presentation/`, and its specs sit in `test/unit/<module>/`.** In a context divided into modules, everything about one part of the model, its model, its use cases, its adapters and its routes, is now under one folder, instead of `domain/<module>/` and `application/<module>/` with the adapters, routes and specs left organised by technique. What every module shares stays at the level of the context: `CONTEXT.md`, `<context>.codes.ts`, `<context>.permissions.ts`, the generated declarations, `published-language/`, the schema, tables and migrations of its database (the `*.schema.ts` of `infrastructure/persistence/` that are no row schema), its route groups with `guards/` and `shared/`, and `test/fakes/`, `test/builders/` and `test/worlds/`. `ddd-ts-kit check`, the ESLint plugin (its layer rules and the globs of its preset), the generated `.dependency-cruiser.cjs`, the coverage of `@ddd-ts-kit/testing` (each layer of each module held to its threshold), `discoverContext` of `@ddd-ts-kit/di`, the generated declarations (`<module>/<layer>/<layer>.declarations.ts`) and the guard of the plugin read the new layout; every rule reads a file of a module as the same file outside one. `generate ... --module <module>` writes the files of every layer into the module and each spec into the module of the file it is named after, and refuses a file of a layer without `--module` in a context that declares modules. `move-to-module` takes files of any layer and specs, and the specs named after a moved file follow it. `module/complete` reports a file of a layer outside every module and a spec left at the level of the context while its subject sits in a module. A folder at the root of a context that the config does not declare is reported by `tree/closed`, whose fix names `generate module`.

The coverage of `@ddd-ts-kit/testing` now holds each layer of each module to its floor on its own (`calendars/domain/`, `waitlist/domain/`), where 0.86 and 0.87 measured `domain/` of the context as one, so a module with few specs no longer hides behind a well tested one: a project whose pipeline passed may fail the coverage of one module right after `context-layout`. Run the coverage once after the move and write the specs of the layer it names; the floors themselves stay those of the `coverage` key of `ddd-ts-kit.config.json`, the same for every context and module (Jest sums a threshold over one folder, so a layer of a module cannot be summed with the same layer of the context).

To move: run `npx ddd-ts-kit context-layout`, then the formatter, the checks and the tests, and commit the result. The command moves each module from `domain/<module>/` and `application/<module>/` to its folder, and each adapter, route and spec left at the level of the context to the module of what it imports (a spec to the module of the file it is named after, a file that imports nothing of a module to the module of the files that import it), every import of them under the source root, `test/` and `scripts/` following; a file whose imports name two modules, or none, is listed and stays where it is. For one minor version, a module still where 0.86 and 0.87 put it is read and reported as a warning of `module/complete` that names the command, but the generators refuse to write in such a context until it is moved: a file written in the layout of today would sit apart from the rest of its module.

**A study of the velocity of the build, the checks and the tests, with its measures and its plan.**
The proposal page `docs/proposals/build-and-test-velocity.md` (and its French page) measures
where the time and the memory of this repository go, on a workstation and in the pipeline, tests
the levers of Vitest, ESLint, Oxlint, the native compiler and the package managers on this tree,
summarizes what other teams published about orchestrators, package managers, test selection and
GitHub Actions, and ends with a plan in order of gain per cost: fewer jobs per pipeline run and
the heavy families narrowed on a pull request, the compile matrix of five spec files in
parallel, half the cores and `related` tests before a push, the ESLint content cache, the type
check of the specs in parallel; Oxlint and arm64 runners to try; pnpm not now; no orchestrator.
Nothing of the pipeline or of the templates changes in this pull request.

## 0.87.0

**`S3FileStorage.put` stores a file larger than one part.** The SDK read the `size` of the
inspection the content streams through, the bytes counted so far, as the length of the whole
content: once every part was sent, a file larger than `partSize` (8 MiB by default) was refused
with `Expected 0 part(s) but uploaded 3 part(s)` and its upload aborted. A smaller file, sent in
one request, was not affected.

**The flush of `PinoLogger` resolves with the pretty format, in a process with nothing else pending.**
Pino does not let the worker thread of a transport (`pino-pretty`) keep a process alive, so its
answer to a flush did not either: at shutdown, once everything else had closed, the process exited
before `flush()` resolved, and what came after it never ran. `app.stop()` flushes the logger last,
so it never resolved, and a program that awaited it at the top level ended with exit code 13. A
flush now keeps the process alive while it runs, ten seconds at most. The JSON format was not
affected.

**In the declared style, the declarations of a context are written per layer: a role folder holds its role files and nothing else.** With `"stack.assembly": "barrel"`, `generate`, `docs` and `npm run dev` write one `<layer>.declarations.ts` directly in each layer of a context that holds a declared role file, `application/application.declarations.ts`, `infrastructure/infrastructure.declarations.ts` and `presentation/presentation.declarations.ts`, and the same in each module of the model (`application/<module>/application.declarations.ts`), instead of one `<folder>.declarations.ts` in every role folder. A folder that held one job, one adapter or two use cases no longer holds a generated file beside them, and a context reads as its role files. `<context>.declarations.ts` still re-exports these files, so the composition root, `contextModule(...)` and the worlds of the tests import it as before. Each file keeps the same content, for its whole layer: the imports, one `export *` per role file sorted by path, then the `injected(Class, [Tokens])` of the classes that take something. `declarations/barrel-current` compares the files of the layers and reports the `<folder>.declarations.ts` of a role folder left next to them; the guard of the plugin, `tree/closed`, `clean/one-export-per-file`, `clean/file-size` (of `ddd-ts-kit check` and of the ESLint plugin, which now leaves out every generated declarations file of a context), the commit size and `merge-trunk` treat the layer files as generated, like the others. Under `"stack.assembly": "discovery"` nothing changes.

To move: run `npx ddd-ts-kit docs` (or any `generate` without `--local-only`, or `npm run dev`), which writes the declarations of each layer, deletes the files of the role folders and rewrites `<context>.declarations.ts` as their summary, and commit the result. Upgrading alone fails nothing: for one minor version, a context still declared in one file per role folder, exactly as 0.85 and 0.86 would write them for the current role files and constructors, is accepted. `ddd-ts-kit check` reports it as a warning of `declarations/barrel-current` (exit 0) that says how to move, `docs --check` passes and prints the same warning, and `generate --local-only` keeps it in that layout, declaring there a role file it writes as 0.86 would, and says so in a note. The single `<context>.declarations.ts` of 0.84 is still accepted in the same way, and `generate --local-only` now keeps it as well when it writes a role file in its context, where it moved the context before. A later minor version reports both as errors.

## 0.86.0

**An erasure of a data subject leaves a dated entry in the audit trail.** `auditedSubjectKeys(keys, trail, { scope, clock, ids })` of `@ddd-ts-kit/audit` wraps a `SubjectKeyStore`: every `erase`, from a script, a command or a job, writes an entry with category `data-access`, action `personal-data:erase` (`SUBJECT_ERASURE_ACTION`), the subject as a `data-subject` resource, `keyDestroyed: true` or `false` in `changes`, and the actor and date of the execution scope; `keyFor` and `find` pass through. The key is destroyed first and the entry written after: an entry never states an erasure that did not happen, and when it cannot be written the erasure fails and is run again, which records that no key was left at a later date. An erasure outside an execution context is refused before any key is touched; a failure of the store is recorded as `failed`, with the `code` of a `DomainError` or `UNEXPECTED_ERROR`, and `onLostRecord` is told when that entry is lost too. The example binds the wrapped store and `npm run erase:patient -- <patientId> <operatorId>` writes the entry, with the operator as actor and the origin `cli`; the operator is required, so that the proof names a person, and an id that destroys no key and that no person of any network has is a mistyped one, refused before the rebuilds after a lookup under an elevation the trail records; the key comes first, the record after; a value that is not an opaque identifier (a name, an email) is refused before any key is touched or any entry written.

To move: bind the key store wrapped by `auditedSubjectKeys` where the platform binds `SubjectKeyStore`, and run a script that erases inside `ExecutionScope.run`, with the operator as actor.

**`generate module <context> <module>` declares a module of the model, and `--module <module>` makes every `generate` write into it.** `generate module` writes the module in `contexts.<context>.modules` of the config, its row in the `## Modules` section of `CONTEXT.md` (the section is created when absent) with `--purpose "<one sentence>"`, the `--term` rows of the glossary, and `--classification` when the subdomain it holds differs from its context; run again, it adds what is missing. With `--module`, the files a kind writes under `domain/` and `application/` land in the module, the files it reads (an existing aggregate, an event, a port) are found in whatever module holds them, a file of a use case already in a module is written with it, and the imports it writes name where they are; a `--module` that would split a use case between two modules is refused; the code list and the permission set stay at the level of the context. In a context that declares modules, a kind that would write a file of `domain/` or `application/` without `--module` writes nothing and answers with the list of the modules and the same command with `--module`.

To move: nothing for a context without modules. In a context that declares some, add `--module <module>` to the `generate` commands of scripts and slice plans.

**Two guides: a handler with many dependencies, and a cycle between two contexts.** `docs/guides/many-dependencies.md` reads constructor over-injection as a smell, not a rule (Seemann): an order of diagnosis where each remedy has its place in the tree (a bus middleware or a decorator, a domain event handler, a projection, a process manager, one port named in the language, a domain service, or two use cases), and why the kit adds neither a maximum of dependencies nor an `application/services/` role. `docs/guides/cycle-between-contexts.md` asks three questions before merging two contexts that need each other: one language (then one context divided into modules of the model), one direction as an integration event, a missing concept; it says that refusing the cycle is a choice of the kit and that Partnership is a relationship between teams. The `architecture-reviewer` agent walks both: for a constructor with many dependencies it names the remedy that applies, never a count, and in a context with modules it checks that each module is named in the language and holds no second one. The skills `bounded-contexts`, `context-map`, `scaffold`, `use-case` and `wiring` say when to divide a context into modules and how to generate into them.

**A bounded context can be divided into modules of the model: one folder directly under `domain/` and `application/`, declared in `contexts.<name>.modules`.** A context too large to read whose language stays one is divided into parts of one model (Evans, Modules), never into sub-contexts, which no reference publication defines. A module holds the role folders of the canonical tree, unchanged: `domain/<module>/aggregates/`, `application/<module>/commands/<use-case>/`; `infrastructure/`, `presentation/`, `test/` and `published-language/` keep their layout, and `domain/errors/codes.ts`, `application/authorization/<context>.permissions.ts`, the generated `<context>.declarations.ts` and `CONTEXT.md` stay at the level of the context. The config may give a module the classification of the subdomain it holds (`"modules": { "waitlist": { "classification": "supporting" } }`). `ddd-ts-kit check` and the ESLint plugin read a file of a declared module as the same file outside one, so every rule keeps its meaning; `tree/closed` still reports a folder that is neither a role folder nor a declared module, and its fix names `generate module`. Three rules join: `module/declared` (error: a module is named with terms of the glossary of its context, never a technical word, and has a row in a new `## Modules` section of `CONTEXT.md`), `module/complete` (warning: a file of `domain/` or `application/` left outside every module once a context declares some) and `module/no-cycle` (warning: the imports between the modules of one context form no cycle). `ddd-ts-kit docs`, `describe` and `error-factories` read the role folders of every declared module, as `check` does, the generated declarations get one `<folder>.declarations.ts` per role folder of a module, and `discoverContext` of `@ddd-ts-kit/di` reads the modules in the generated `<context>.dependencies.ts`, which names them under discovery. A context that declares no module sees no change. See `docs/concepts/modules.md`.

To move: nothing for a context without modules. To divide one, follow "Adopting modules, step by step" of `docs/concepts/modules.md`: `generate module`, then `move-to-module` one cluster per commit, and `npm run verify` after each.

**`ddd-ts-kit move-to-module <context> <module> <path>...` moves files of a context into a module of the model, with every import of them.** The paths are relative to the context, files or folders under `domain/` or `application/` (an aggregate, a use case folder); the module must be declared first (`generate module`, which the command names when it is not). Every import of a moved file is rewritten under the source root, `test/` and `scripts/`, by alias or relative path, the extension kept as written. `--dry-run` prints the plan, `--json` gives it as data, both with the generated files the move derived or deleted. The text of a moved file is carried as it is. The generated declarations are rewritten in the same run, every file of a folder moves (not only its sources), a path already in a module moves to the other one, and the folders the move empties go. Nothing is moved when a file of the same name is in the module already, when two files would land on one path, when another module holds a file of the same role and name, or when a file is not text. The checks and the tests come next.

To move: nothing; use it to divide a context into modules one cluster per commit, until `module/complete` warns no more.

**A guide closes the loop from a metric out of its band to the next story, and an incident
record becomes the origin of a fix.** `docs/guides/closing-the-loop.md` applies the last stage
of the AI-native SDLC playbook to a ddd-ts-kit project: the detection stays the team's
(deterministic, tested, outside the kit); the page gives the queries on the metrics the kit emits
for three breaches (the failure ratio of a use case per message from `use_case_total`, the age
of the oldest pending outbox record read from the `outbox` table, the absence of a successful run
of a job for two intervals from `scheduled_job_runs_total`), a `bands.yaml` on them with three
tiers (log; diagnose read-only with named tools; propose through an intent pull request or a
pre-approved runbook), what a stateless run needs, how a request from a chat channel enters the
loop, and what the kit does not do. A new template of the story skill, `incident-template.md`,
is written to `docs/architecture/incidents/<id>.md` (what was observed, the evidence, the cause
by business name, what was done, what is next); `story-scope <code> --kind fix --from` accepts
it as it is, and the locked regression spec of the fix story is the permanent test of the
incident.

**A story can write its specification without an owner, from an accepted intent, and a workflow
template runs it on the merge of the intent.** `/ddd-ts-kit:story <code> --headless <intent>`
runs phases 1 to 4 alone: every question that changes an artefact is written under
`## Open questions` of the story file with its recommended option taken provisionally and marked
`(provisional, headless)`, the rows, the design review and the acceptance are written and locked,
the build gate stays closed, and the pull request whose body is the list of questions is opened;
the owner answers in the review, and the build phase starts from the merged answers. A new
template, `pipeline/github/workflows/intent-to-spec.yml`, runs it on GitHub when a pull request
merged into the default branch turns an intent to `Status: accepted`: it installs the project,
Claude Code and the plugin, and runs `claude -p` with the `ANTHROPIC_API_KEY` secret, one story
per accepted intent. `init --ci-extras intent-to-spec` writes it (GitHub only, `ci.extras` of the config); the
team adds the secret. It was parsed, not executed on GitHub; opt-in and paid.

**An idea enters the kit as an intent, before any story.** A new skill, `/ddd-ts-kit:intent`,
brainstorms with whoever has the idea until it is concrete (the problem, the outcome, who and
what it touches, the constraints, what the author would observe), maps the affected systems on
`npx ddd-ts-kit list` when it runs inside the project, and writes
`docs/architecture/intents/<slug>.md` from a new template of the story skill
(`intent-template.md`) with `Status: draft`. It runs from Claude Code, Cowork or claude.ai with a
git connector, and the template is also filled by hand. The product owner accepts the intent by
setting `Status: accepted` in a pull request. The story skill reads it:
`story-scope <code> --from <intent>` records the origin, the `## Problem` and `## Proposed
outcome` of the intent seed `## Statement`, each constraint is listed as a question answered "by
the intent", the open questions join the owner's batch, and the acceptance lines are the first
draft of the criteria. The story workflow guide says where a story comes from, and the
methodology says it at step 7.

**A pull request is taken to green by `/ddd-ts-kit:pull-request <number>`.** From the worktree of
the story, the new skill sweeps the unresolved review comments and the failing checks of the
pull request, addresses each under the rules of the story (a change the design review did not
foresee becomes a `D<n>` decision, a request to weaken a check goes through the `deviation`
skill, a failing check is fixed in the code and never in the check, no force-push), replies to
each thread, pushes, waits for the checks, and repeats until the pull request is green and waits
only on the code owner; it then reports what was changed and what was declined and why. The
story skill names it as the step after `gh pr create`, when the owner asks for it.

**A review finding made twice becomes a line of `AGENTS.md`, at the close of a story.** The close
phase of the story skill applies the rule of two: a finding of the review of the branch that
repeats one already recorded for the project (the same rule id or the same remark in an earlier
file of `docs/architecture/reviews/`, or a `TODO(review)` marker) is written in the same branch as a
line under `## Mistakes seen here` of `AGENTS.md`, or as a rule of `ddd-ts-kit.config.json` when
the kit has one for it, so that the next session does not make it a third time.

**The findings of the review of a story are kept in its design review, and a commit made by an
agent can say so.** At the close of a story, the review of the branch is appended to
`docs/architecture/reviews/<code>.md` under `## Findings`, each finding with its pass, its
`file:line` and its outcome: fixed in `<commit>`, written as `TODO(review)`, or dismissed by
`ADR-<n>`. The record survives the pull request and a move between GitHub and GitLab, and the
rule of two reads it. A new key of the config, `commit.agentTrailer` (`false` by default): when
`true`, the story skill, the `context-builder` agent it briefs and the fix skill end each commit
they make with the trailer `Agent: <host> ddd-ts-kit@<plugin version> <agent name>`, and the
report of a story counts the commits made by an agent against those made by hand. Off by
default because many teams refuse attribution lines in commits; `config/valid` reports a value
that is not a boolean.

**A story records where it comes from and what built it, in `## Origin` of its file.** The story
template gains the block, three lines: `From:` (the intent, the ticket or the incident the story
comes from), `Built with:` (the version of the kit and of the plugin, the base and its commit) and
`Policies in force:` (the skills loaded at the design phase). The story skill fills it at phase 1
and repeats it at the top of the body of the pull request, so that the trunk links back to the
origin of each story. `npx ddd-ts-kit story <code> --gate close` has a new phase, `origin
recorded`: it exits 1 until the block holds its `From:` and `Built with:` lines.

To move: a story opened before this version adds `## Origin` to `docs/architecture/stories/<code>.md`
before its pull request; `npx ddd-ts-kit story <code>` says what the block lacks.

**The policies a story was designed under are named in its record.** At the design phase, the
story skill lists the policy skills it loaded (those of the plugin and the project's own under
`.claude/skills/`) on the `Policies in force:` line of `## Origin`, and writes in the section of a
row of the design review a line `Policies: <skill>: <what it imposed here>` when a policy changed
the design; two policies that contradict each other become a decision for the owner. The
`architecture-reviewer` agent reads those lines as part of its design review. Nothing new runs:
the skills already load; the record now says which ones did.

**The report of a story carries the evidence of its verification.** The story template gains
`### Verification` under `## Report`: the story skill pastes there the last lines of
`npm run verify`, of the acceptance run and of `story-check`, and writes `not verified:` for what
it could not run (a broker, a provider, a platform), so that the pull request shows what the
toolchain said and not only that it was run. `npx ddd-ts-kit story <code> --gate close` reads it:
the `report` phase is met only when the block names `npm run verify`.

To move: a story opened before this version adds `### Verification` under `## Report` before its
pull request; `npx ddd-ts-kit story <code>` says when it is missing.

**`story-scope` records what a story is and where it comes from.** `npx ddd-ts-kit story-scope
<code> --kind story|fix --from <file>`: `--kind` is `story` by default, or `fix` for a story built
behind the regression specs listed under `## Regression` of its file (the `fix` skill); `--from`
names an intent, `docs/architecture/intents/<slug>.md`, refused unless its header says
`Status: accepted`, or an incident record, `docs/architecture/incidents/<id>.md`, accepted as it
is. `.ddd-ts-kit/story.json` gains `kind` and, when given, `from` (relative to the project root),
both kept when the story resumes without them; while the story file does not exist, the `Next:`
line says that the story skill seeds its statement from the origin. `npx ddd-ts-kit story <code>`
reads a fix as one: its rows and their design are optional, its acceptance phase reads
`## Regression` (each spec listed must exist) instead of `test/acceptance/`, and no passing phase
is read.

**A fresh context verifies the behaviour of a story at its close.** A sixth agent,
`story-verifier`, read-only, is launched by the story skill at its close phase, after the
`architecture-reviewer`: it reads the design review and the report of the story, starts the
application the way the end-to-end tests do (the acceptance of the story, then the end-to-end
specs of the two nearest flows), calls the routes the specs leave unexercised when the project
starts without a service, and reports what it ran, what it saw, and every behaviour that does not
match the design or a `D<n>` decision. It fixes nothing: the session settles each mismatch before
the report. A host without the agents of the plugin skips it, and the report says so.

**`AGENTS.md` gains `## Verifying your work` and `## Mistakes seen here`, and the reviewer applies the rule of two.** The first section gives each verification command of the project with the lines it prints when it passes (`npm run verify` prints no line of its own; `0 errors, 0 warnings, 0 suppressions in N files.`; `Test Files N passed (N)`; `gate passing: met`; what prints nothing and exits 0), to run before reporting a task done, their last lines pasted, a failing check fixed in the code and never in the check, the threshold or the test. The second is the team's: a review finding or a `TODO(review)` made twice becomes one line there, or a rule of `ddd-ts-kit.config.json` when the kit has one. The `architecture-reviewer` agent reports a finding already recorded for the project (the same rule id, or the same remark on the same layer, in an earlier design review or as a marker) with the exact line to add there, or the config change; the `quality-gate` skill says the same. After the AI-native SDLC playbook of Anthropic.

To move: `npx ddd-ts-kit init --force` rewrites `AGENTS.md` from its template; or copy the two sections from a new project.

**An agent asks before editing a migration, the `Dockerfile`, `docker-compose.yml` or `docker/`.** The `ask` list `init` writes in `.claude/settings.json` gains the migrations of the ORM of the project (`Edit(./migrations/**)` with drizzle, knex and typeorm, `Edit(./prisma/migrations/**)` with prisma, nothing with a custom persistence or without one), `Edit(./Dockerfile)`, `Edit(./docker-compose.yml)` and `Edit(./docker/**)`: what reaches production otherwise than through the code is a decision of the project owner, the weak form of the change ticket the AI-native SDLC playbook of Anthropic asks for on a migration. The compose file reads `.env` at the root, which the deny list already covers, so no rule on `docker/.env*` is written. `ddd-ts-kit doctor` reports the missing ones as it does the others.

To move: `npx ddd-ts-kit init` adds them to an existing `.claude/settings.json`.

**`ddd-ts-kit docs` writes `CODEOWNERS` from the owners of the config.** `contexts.<name>.owners` names the owners of a context and `owners.platform` the platform owners in `ddd-ts-kit.config.json`; once one is set, `docs` writes `CODEOWNERS` at the root of the project (GitHub and GitLab both read it there) between `# ddd-ts-kit:code-owners` markers, from the ownership table of the team workflow guide: each context's tree and its `published-language/` to its owners, the consumers of that language named in a comment to ask as reviewers, `src/shared-kernel/` to the owners of every context that imports it, `src/platform/`, `src/main.ts`, the config, the pipeline files, `REVIEW.md`, `AGENTS.md` and `docs/adr/` to the platform owners. `docs --check` reports a stale file; a file the team wrote keeps its lines, the block appended after them; without any owner nothing is written. The separation of duties of the AI-native SDLC playbook of Anthropic, with the branch protection the pipeline documents.

To move: add the owners to the config, then `npx ddd-ts-kit docs` and commit `CODEOWNERS`.

**The regulated profile writes two hooks: a production gate and a change reference.** With `init --agent-profile regulated`, two small Node scripts under `.claude/hooks/`, registered under `hooks.PreToolUse` of `.claude/settings.json` and owned by the team: `production-gate.mjs` blocks, before it runs, a shell command that names the production environment of the project (`production`, a list at the top of the file) with a release action (`deploy`, `migrate`, `rollback`), exit code 2 with the reason to the agent, unless `RELEASE_APPROVAL="<approver> <change id>"` names who approved the release and the change it belongs to; `change-reference.mjs` asks, without blocking, before an edit of a migration (`migrations/`, `prisma/migrations/`) or of the containers (`docker/`, `Dockerfile`, `docker-compose.yml`), for a change reference the session then records as the trailer `Change: <id>` of the commit. Both explain themselves; `doctor` reports a missing file or registration. The trailer is read by people in the history; no command of the kit reads it yet. The two gates the AI-native SDLC playbook of Anthropic names for a regulated build, following the hooks reference of Claude Code read on 2026-10-23.

To move: `npx ddd-ts-kit init --agent-profile regulated` writes and registers them; edit the lists at the top of each file to your environments.

**`ddd-ts-kit init --agent-profile regulated` writes the permission profile of a regulated organisation.** Recorded as `agents.profile` in `ddd-ts-kit.config.json` (with or without `--force`; `--agent-profile none` removes it), the profile adds to `.claude/settings.json` the `sandbox` block of Claude Code: enabled, failing when the sandbox is unavailable, no unsandboxed retry, the npm registry and the git host of the project (read from `repository` of `package.json`, else from the `origin` remote) as the only hosts, the credential files (`~/.ssh`, `~/.aws`, `~/.config/gcloud`, `~/.azure`) and the usual secret variables denied to every sandboxed command; a key the project set is kept. `init` prints the block of managed settings a project file cannot set (`allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`, `permissions.disableBypassPermissionsMode`, `strictKnownMarketplaces` with the marketplace of the kit, `requiredMinimumVersion`), for the platform team to paste, and `ddd-ts-kit doctor` reports a line of the block the settings lack. The key names were verified against the Claude Code documentation on 2026-10-23; the sandbox guide says what each line buys, in control terms, after the worked example of the AI-native SDLC playbook of Anthropic, and which lines Codex and Copilot have an equivalent for.

To move: `npx ddd-ts-kit init --agent-profile regulated`, then paste the printed block in the managed settings of Claude Code.

**`ddd-ts-kit init` writes `REVIEW.md`, the review policy every reviewer reads.** At the root of the project: the passes of a review (bugs, security with the kit's own list, compliance against the design review of the row, the acceptance of the story, the records of `docs/adr/` and the rules), what Important means, at most five nits (a recurring one becomes a line of `AGENTS.md` or a rule of the config), what is not reported (generated files, what `npm run verify` refuses). Written once, for the team to edit: `init --force` leaves it alone, `Edit(./REVIEW.md)` joins the `ask` list of `.claude/settings.json`, and `ddd-ts-kit doctor` reports a project without it (`guidance REVIEW.md: missing`, which `--strict` fails on). The `architecture-reviewer` agent reads it on top of its method and tags each finding with its pass. The file is the review policy of the AI-native SDLC playbook of Anthropic, with the kit's lists.

To move: `npx ddd-ts-kit init` writes `REVIEW.md` and adds the permission; edit the file to your policy.

**The pre-commit hook scans the staged changes for a secret.** The `lefthook.yml` of a project gains a `secrets` job: `gitleaks git --pre-commit --staged --redact --no-banner` when the `gitleaks` binary is on the path (`gitleaks protect --staged` before 8.19), so a credential is refused before the commit exists; without the binary the job prints one line saying the staged changes are not scanned here, and passes, the `secrets` job of the pipeline scanning the whole history anyway. `ddd-ts-kit doctor` reports a `lefthook.yml` without the job (`hook lefthook.yml secrets: missing`, which `--strict` fails on). The kit's own hooks run the same job. After the AI-native SDLC playbook of Anthropic.

To move: add the job to the pre-commit jobs of `lefthook.yml`, or `npx ddd-ts-kit init --force` writes the kit's file; install gitleaks on the machines that commit.

**The relationship schema reads as sentences, and a decision explains itself.** A type declares its stored `relations` and its `derived` relations: one way (`'owner'`, `via('parent', 'edit')`) or several (`anyOf`, `allOf`, `butNot`), the words of the modelling language of OpenFGA, without nesting. A derived relation named after a permission id (`[docsPermissions['document.edit'].id]: 'edit'`) grants that permission on its type: the permission mapping is gone, from `RelationBasedAuthorizer`, from `OpenFgaAuthorizer` and from the platform of a generated project. A tuple names its subject alone (`group:eng`): the relation that accepts `'group#member'` says what a group stands for, and `OpenFgaRelationTupleStore` adds the userset on the server. `explain` replaces `expand`: the decision and a trace in words, one line per question asked, laid out by `traceText`, for a refusal as for an allowed decision. The evaluator reads the same way: one class, `Question`, whose methods are named after what they ask.

To move: in `defineSchema`, rename `permissions` to `derived`; write `union(a, b)` as `{ anyOf: [a, b] }`, `intersection(a, b)` as `{ allOf: [a, b] }`, `exclusion(base, subtract)` as `{ anyOf: [base], butNot: [subtract] }` and `from(relation, name)` as `via(relation, name)`; move each entry of the mapping into the `derived` of its type, keyed by the permission id (`[docsPermissions['document.edit'].id]: 'edit'`), delete `permission-mapping.ts` of the platform and drop the `mapping` option of `RelationBasedAuthorizer` and `OpenFgaAuthorizer`, which takes `schema` instead. Write `group:eng` where a tuple said `group:eng#member`, in the adapters and in the stored tuples (`UPDATE relation_tuples SET subject = split_part(subject, '#', 1) WHERE subject LIKE '%#%'`); the tuples of an OpenFGA store stay as they are. Replace `expand` by `explain` and `ExpandNode` by `TraceStep`; `parseSubject` and `SubjectRef` are gone, a subject is parsed by `parseObject`. In the model of an OpenFGA store, a derived relation named after a permission is called `docs_document_edit` (`relationNameOf`): `ensureAuthorizationModel` writes the new model, and a `Check` or `Expand` run by hand names the relation that way.

**A defect is repaired with its proof first: `/ddd-ts-kit:fix <code>` writes the spec that reproduces it, locks it with `ddd-ts-kit acceptance <code> --lock`, and the guard holds that spec while the fix is built.** A fix is a story file whose `## Regression` section lists the spec files that prove it, one path per item (`- test/unit/appointment.aggregate.spec.ts`, or the spec next to the code): `ddd-ts-kit acceptance <code>` reads them, fingerprints each `it` or `test` of them as it fingerprints the scenarios of an acceptance, holds `--gate written` to each listed file existing with at least one test, `--lock` records them in `test/acceptance/<code>.acceptance.lock.json` under `regression`, a locked test changed or removed is a drift that only a verdict of the `acceptance-judge` agent lets through (subject `test "<title>" of <file>`, the `## Statement` of the fix being the criterion), and `--gate passing` holds each locked test present, unchanged and no longer pending; the command still runs no test. In a worktree whose `.ddd-ts-kit/story.json` says `"kind": "fix"`, the guard opens the code of the contexts once the lock exists (no row, no design review), lets the specs of a context be written before it, and refuses every edit of a locked spec, by the editor tools and by the shell (a runner may run it, git may version it), to the session and to its sub-agents, saying that the spec is the proof of the fix and that a wrong spec goes to the judge. The new skill `fix` runs the four phases, reproduce, lock, fix, close; the `testing` skill points at it. From the AI-native SDLC playbook of Anthropic (the failing test first, committed, and a hook that stops the agent editing it).

To move: nothing; a story without a `## Regression` section is read as before.

**The guard of the plugin lays out each written file with the Biome of the project before it checks it, when the config says `"formatOnWrite": true`.** The `PostToolUse` hook runs `node_modules/.bin/biome format --write <file>` on the file a session just wrote (TypeScript, JavaScript, JSON; the binary of the project only, never `npx biome` nor another formatter), then the per-file check as before, so that the layout is settled at the write and the lint findings that follow a wrapped line come back in the same hook output. A Biome that is not installed, or that fails, changes nothing. The key is read as `true` only; absent, the hook formats nothing, as before (`docs/CONFIG.md`, "Working agreements"); `init` writes it as `true` in the config of a new project. From the AI-native SDLC playbook of Anthropic (hooks as build-time guardrails).

To move: nothing for a project `init` creates from this version; set `"formatOnWrite": true` in `ddd-ts-kit.config.json` of an existing project whose `format` script runs Biome.

**`ddd-ts-kit story-check <code>` holds each done row to its design review: a name its section cites that the code does not have blocks, unless the report lists it as a compromise.** For each row `done`, every name the `## #<id>` section of `docs/architecture/reviews/<code>.md` cites as inline code, read as `cited` reads them (a path under the source root or relative to the context, a PascalCase name, a `Class.member`; a name whose sentence records its removal is history), must exist in the tree: the path exists, the class or type is declared by a source under the source root or imported by one, the member is named in a file declaring the class. A name that does not is listed under `### Compromises` of `## Report` in `docs/architecture/stories/<code>.md`, as inline code, with why; a name neither there nor listed is a blocker with its `file:line` in the review, under "Departed from its design" of the output and `design` of `--json`, and `canClose` is false while one remains. `--strict` is unchanged, and the tree is read only when a section of a done row cites a name. In the worktree of a story, the guard of the plugin says it once at the stop of a session, without blocking: "a row departed from its design: update its review section or list the compromise". From the AI-native SDLC playbook of Anthropic (the merged diff checked against the committed plan).

To move: nothing; a story whose review file has no section for a done row, or whose sections cite nothing, closes as before.

**`init --ci-extras claude-review` and `claude-triage` put Claude Code in the pipeline, on request.**
Two opt-in extras, on both platforms and never installed by default, as the AI-native SDLC
playbook of Anthropic places them: `claude-review` writes `.github/workflows/claude-review.yml`
(`anthropics/claude-code-action` on `pull_request`, pinned to a commit) or a `claude-review` job
of `.gitlab/claude-review.gitlab-ci.yml` (`claude -p`, a note posted through the API), which reads
`REVIEW.md` at the root when it exists and the story file the branch `story/<code>` names, and
posts its findings as one comment that neither approves nor blocks; `claude-triage` writes
`.github/workflows/claude-triage.yml` (on `workflow_run` of `CI` ended in failure) or a
`claude-triage` job `when: on_failure`, which reads the logs of the failed jobs with read-only
tools and writes a three-line triage (the most likely cause, flaky or real, what to do) to the job
summary and on the pull or merge request. Both spend API tokens on every run, through
`ANTHROPIC_API_KEY` or Amazon Bedrock, Google Vertex AI or Microsoft Foundry, and the `gate` job
never needs them: a person still approves. The list is recorded in `ci.extras`; the workflows
were parsed, not executed on the platforms (`pipeline/README.md`).

**A guide says how a ddd-ts-kit project is deployed and rolled back.** `docs/guides/deploy-and-rollback.md`
names what a project ships beyond the image the pipeline builds (the migrations, the API with its
outbox relay, the worker, a context as a service, the readiness route written with `--cache redis`
only, the OpenTelemetry export), the order of a release (migrate forward compatibly, deploy, relay),
what a rollback of each piece means, the three tiers of autonomy of an agent mapped on the
environments with the production gate of the regulated profile, deploy, status and rollback as one
script each reached through an MCP server of the platform team or through the `allow` list and
never both, the rollback rehearsed in staging, and what the kit does not do: no deployment tool, no
MCP server. Indexed in `docs/README.md`.

**The plugin has an eval suite, off by default.** `plugin/evals/` holds twelve cases for
`claude plugin eval`, one per promise of the skills, the agents and the guard (the generator rather
than the hand, the glossary before a name, a deviation refused, a worker that stays in its context,
the reviewer that finds planted violations with `file:line`, wiring without a token, cross-cutting
out of the handler, `describe` instead of a tree walk, no code before the design review and the
lock of a story, an acceptance scenario never rewritten, commits split by context, a violation
fixed at the root cause): each a prompt on the scheduling example and graders that read what the
session did, as the AI-native SDLC playbook of Anthropic asks of agent configuration. Nothing runs
by default: each case is a full Claude Code session in two arms (24 sessions for a run of the
suite with `--runs 1`, 72 with the default of 3). A maintainer runs it by hand from the Actions tab
(`agent-evals.yml`, `workflow_dispatch` only, green and idle until the secret `ANTHROPIC_API_KEY`
exists, a ceiling of 10 USD, threshold 0.8), or one case locally on their own credential with
`claude plugin eval plugin --runs 1 --no-publish --max-cost-usd <n> --case <name>`. `CONTRIBUTING.md`
says how a case is written, that every reported regression becomes a case before its fix, and what
a run costs; the coding-agents guide says a project can hold its own skills to the same test.

**`ddd-ts-kit measures` reads what the loop of each story cost and left.** From the git history of
the current branch and the files of `docs/architecture/` and `test/acceptance/`, per story and as
medians over the period: design time (the first commit of the story file to its acceptance lock),
build time (the lock to the report), lead time (to the commit that carries the branch of the story,
else open), the requirements changed after the build started and the amendments and refusals of the
lock, the provisional decisions, the compromises, the `TODO(review)` markers settled and the
findings of the review file by pass with the repeats across stories, the verification block of the
report, the stories built at the same time, the origin (an intent, a ticket, an incident) and the
incidents repeated: the indicators of the AI-native SDLC playbook of Anthropic in the terms of the
kit. `--since <date>`, `--story <code>`, `--format text|json`; `--by-author` is off by default and
the README says why. Nothing is sent anywhere, and the measures that come from the platform (time to
first review, first-run CI status) are named as not computed.

**The guide of the plugin says what holds each skill.** A new section of
`docs/guides/coding-agents.md`, "What holds each skill", names for each of the twenty-three skills
the deterministic control behind it (the rule ids of `ddd-ts-kit rules`, the gates of the guard,
the checks of the pipeline) and the gap where there is one, as the AI-native SDLC playbook of
Anthropic asks of advisory skills. A test of the plugin, `node --test plugin/skills/controls.test.mjs`
(run by `npm run ci:arch`), fails when a rule id of the table is unknown to the CLI or when a skill
has no row, so the table cannot drift.

**`ddd-ts-kit init --ci-extras intent-to-spec` writes the workflow that runs the headless design pass of the story skill on each intent a merge accepts.** GitHub only (`.github/workflows/intent-to-spec.yml`, recorded in `ci.extras` of the config): on a pull request merged into the default branch that turns an intent of `docs/architecture/intents/` to `Status: accepted`, it installs the project, Claude Code and the plugin, and runs `/ddd-ts-kit:story <code> --headless` with the `ANTHROPIC_API_KEY` secret, one story per accepted intent, whose specification is opened as a pull request. Opt-in and paid: API tokens per accepted intent; nothing runs without the secret. The template was parsed and not executed on GitHub.

To move: nothing; add `intent-to-spec` to `--ci-extras` (or to `ci.extras` of the config, then `init --force`) and the secret to turn it on.

**`ddd-ts-kit story-check <code>` lists each commit of the story that changes a migration or a container file without a `Change: <id>` trailer, and blocks on it under the regulated profile or with `--strict`.** A commit of the current branch belongs to the story as a marker does (its `Slice: <row id>` trailer, else its message naming a row of it, else its subject naming the story); one that changes a file the `change-reference` hook of the regulated profile watches (`migrations/`, `prisma/migrations/`, `docker/`, `Dockerfile`, `docker-compose.yml`, the same list, kept aligned in the kit) without the trailer is listed with its short sha, its subject and the files, under "Without a change reference" of the output and `unreferenced` of `--json` (`{ sha, subject, files, rows, fix }`, with `regulated` saying whether the config holds the story to it). It blocks the story when `agents.profile` is `regulated` or with `--strict`, and is listed without blocking otherwise, like an unattributed marker. The fix: add the trailer before the pull request, `git commit --amend` for the last commit, an interactive rebase of the branch for an earlier one, with the id the change process of the team gives. Three git calls at most, on the commits that touch such a file.

To move: nothing; a project without the regulated profile sees the list and closes as before.

**Every authorizer of the kit explains its decision.** `explain`, which the relationship model answered alone, is now a method of the `Authorizer` port, optional like `listAccessible`, and `RoleBasedAuthorizer`, `PolicyBasedAuthorizer` and `SignedInGrantsAuthorizer` answer it: the same decision as `check`, with a trace in words, one line per question the model asked. Roles: the roles of the actor, what each one grants and through which included role, then where the request may act when tenants are checked. Attribute policies: what is known of the element (by attribute name, never by value), then each policy that bears on the permission and whether it held. Signed-in grants: the grant that covers the permission, or the lines of the model one level deeper. `traceText`, `Explanation`, `TraceStep` and the `Trace` writer are exported from `@ddd-ts-kit/auth` (`@ddd-ts-kit/auth/rebac` still exports the first three), so an authorizer of a project explains itself the same way: the custom authorizer `init` writes does, and so does the combined authorizer of the example. The authorizer contract suite checks that an authorizer that explains decides as it checks. Inside `RoleBasedAuthorizer`, the resolved hierarchy of roles is a class of its own, `RoleGrants`, and the tenant check a function of its own, each answering in one sentence.

To move: nothing. An authorizer of your own may add `explain`; the port does not require it.

**The configured scheduler of a platform wired by hand reads as its two steps.** `jobs/configured-job-scheduler.ts` registers a job in two named moves: the run is wrapped in what observes it (`ObserveRun`, the span named after the job and its context, `contextOf`), and the settings of `job-settings.ts` are laid over what the context registered (`overridesOf`, with the sentence of the runtime: a key the configuration left undefined does not erase what the job declared). `jobSettings` says what filtering by context prevents, in the words of the wiring (`UNKNOWN_JOB`), instead of describing it backwards.

To move: nothing; a project that keeps its `configured-job-scheduler.ts` behaves the same.

**The French reference and CLI README hold again what three pull requests had added.** `docs/ARCHITECTURE.fr.md` lost the modules of the model (#213) and `packages/cli/README.fr.md` the regulated profile, `REVIEW.md` and the verification sections (#215) when later merges resolved their translation stamp by taking one whole side of the page; both pages translate their English page in full again.

**The events folder of a platform says why it does what it does.** With Kafka, `events/aggregate-key-of.ts` reads as two steps: the field that names the aggregate (`aggregateIdFieldOf`, `scheduling.time-slot.booked` names it in `timeSlotId`) and the id read from the payload, and its comment keeps the two reasons, the order of the events of one aggregate and the relay given the same key. The hook of a broker provider says why it writes a JSON line by hand: the provider is built before the application has a logger. In the example, the erasure of a data subject moves to `platform/erasure/` and the catch-up of the projections fed by the event store to `platform/event-store/`: `platform/events/` keeps the provider, the in-process events and the relay, what a reader opens to change the broker.

To move: nothing in a generated project. In the example, the imports follow the files; a project that copied `erase-data-subject.ts` or `start-catch-up.ts` keeps them where they are.

**The configuration of a generated project reads as sentences.** `platform/config/environment.ts` is new: `Environment`, the reader of the variables of the process, `env.url('DATABASE_URL')`, `env.text('KEYCLOAK_REALM')`, `env.integer('PORT', { fallback: 3000, min: 0, max: 65535 })`, `env.flag('RUN_JOBS', true)`, `env.oneOf('LOG_LEVEL', LOG_LEVELS, 'info')`, `env.optional`, `env.optionalUrl`. It keeps every problem by variable name and `env.assertValid()` reports them at once, as `loadConfig` always did; the `problems` array that every reader took as a parameter is gone, and so are the private `readInteger`, `readFlag`, `readUrl` and `readText` of `load-config.ts`. `readTracing`, `readFiles` and `tracing.ts` read through it; a reader of the project (`readNetworks` of the example) takes the `Environment` and says its problem with `env.problem(...)`. A blank variable counts as left out everywhere, and a value is trimmed.

To move: nothing for a project that keeps its `config/`. To adopt the reader, write `environment.ts` from a fresh `init` (the file has no marker and no variant), replace `(env: Variables, problems: string[])` by `(env: Environment)` in the readers of the project, `problems.push(text)` by `env.problem(text)`, and the readers of `load-config.ts` by the methods of `Environment`.

**The platform wired by hand has the same map as the one on tsyringe.** With `--di manual` or `nest`, `composition/create-platform.ts` held everything in one file: the foundations, the chains of both buses, the event ports, the purges and what wraps every adapter, through eight helpers and five local types. It is now the assembly alone, and each part lives where the tsyringe family keeps it: `composition/lay-foundations.ts` (`layFoundations`, one execution scope, clock and generator, the logger, the metrics, the cache, the lock, the scheduler, the instrumentation, and the log of the decisions or the audit sources), `buses/create-command-bus.ts` and `buses/create-query-bus.ts` (each chain written as the list of what it puts around a handler, outermost first, given the guard and the storage), `events/platform-events.ts` (the publisher, the subscribers, the event bus and, behind Varnish, the purges), and `composition/platform-options.ts` (`PlatformOptions`, which `compose-application.ts` extends). A helper that returned an empty list when nothing applied is no longer written.

To move: nothing for a project that keeps its `create-platform.ts`. To adopt the map, generate the five files from a fresh `init` of the same stack and move into them what your `create-platform.ts` had added to `lay`, `observing`, `beforeTheTransaction` and `eventsOn`; `createPlatform(persistence, options)` and `Platform` do not change, nor does `compose-application.ts` beyond importing `PlatformOptions` from `platform-options.ts`.

**The observability files of a generated project keep their reasons and drop their narration.** `tracing.ts` and `errors.ts` said in which order they were evaluated, which `main.ts` already states where it decides it; they now say why they do what they do: `tracing.ts` cannot use `loadConfig` without loading modules an instrumentation patches, so it reads `OTEL_SERVICE_NAME` and `NODE_ENV` itself with the same defaults; `errors.ts` loads the configuration before `main.ts` does, so an invalid one fails there first, reported nowhere but stderr. The winston logger says once that its final flush drops what is logged after `stop()`.

To move: nothing.

**The database folder of a generated project tells the same story in every ORM.** `persistenceOver` takes one argument in every variant, the handle that knows how to close itself (`DatabaseConnection` with knex and drizzle, as the client of Prisma and the data source of TypeORM already were), so `openPersistence` reads `persistenceOver(connectToDatabase(url))`. `schema.ts` names its schema `MESSAGING_SCHEMA` and says what it holds, with drizzle and TypeORM as with knex; the test database empties its tables with `emptyTables` and starts the in-process cluster with `inProcessPostgres`, with the same words in the four variants; `inertPersistence` names its address `NO_DATABASE` and says who composes the application without serving it; the `Persistence` interface says that the composition root binds its members. With drizzle, the SQL the in-process database of the tests runs lives in `database/table-statements.ts` (`TableStatements`, `creating()` and `emptying()`), out of `open-test-database.ts`, which now reads like the other three. The example follows, and its migration `keep-the-network-of-every-row` reads as four named steps.

To move: nothing for a project that keeps its `database/`. To adopt the vocabulary, rename `MESSAGING` to `MESSAGING_SCHEMA` in `schema.ts` and its importers, and give `persistenceOver` of knex or drizzle the connection (`persistenceOver(connection)`, `persistenceOver({ db, close })`) instead of `(db, close)`.

**The HTTP server of a generated project says what it serves, in which order, and the Hono server serves the signed file links.** `startHttpServer` opens with the order it serves in: the readiness probe and the limit of each caller, the signed file links before any body parser, the routes of the contexts, then the pages of the contract. What guarded the door under a metaphor is two functions named after what they do, `answerReadiness` and `limitEachCaller` (`answeringReadiness` and `limitingEachCaller` on NestJS, which return the middleware, so its `Door` and `Exchange` are gone), in the four frameworks alike. The refusal of a caller over the limit is `http/too-many-requests-for.ts`, `tooManyRequestsFor`, since the kit already says refusal of a business rule, of a guard and of the audit trail: it answers the status, the headers and the body the server writes as they are. On NestJS the routes are named once before the module is created. With Hono and a storage the application serves itself (`--storage local`), the server mounts `fileRoutes`, which Express, Fastify and NestJS already did: the signed links of the files answered 404 there.

To move: a project that keeps its `start-http-server.ts` behaves the same, Hono with local files apart: mount `served.fileRoutes` before the routes, as the new template does. `refusal-for.ts` keeps working; to adopt the name, rename it and its import.

**The endpoint of the audit trail starts with the endpoint.** `search-audit-entries.controller.ts` and `search-audit-entries.route.ts` held, before the endpoint, a hundred lines of schema: the query string, the view of an entry written four times (its interface, the required fields, the properties, the mapping), and the same lines in both variants. What the endpoint receives and answers now lives next to it, in files named after it: `audit-entries-parameters.ts` (the query string and the page limits), `audit-entries-filter-of.ts` (the filter of the query, from what a reader wrote), `audit-entry-view.ts` (the view and its schema, which says why its check is partial), `audit-entry-view-of.ts` (an entry as the endpoint answers it) and `audit-outcomes.ts` (the outcomes, held to the `AuditOutcome` of the kit). The controller and the route are thirty lines each and read as the endpoint; the example, which adds the network of practices to the filter and the impersonator to the view, follows. On tsyringe, `compose-application.ts` no longer rebuilds the hook that writes the refusals of the guards to the trail: `running` receives what the application is assembled from (`Composed`: the container, the foundations, the options, the contexts) and gives the HTTP boundary `foundations.audit.refusals`, the hook `create-audit.ts` already built.

To move: nothing; a project that keeps its endpoint in one file behaves the same.

**The resilience folder of a generated project speaks of the default policy and the own policy.** `resilience/default-policy.ts` (`defaultPolicy`, once `adapter-aspects.ts`) is what goes around every adapter that leaves the process and states no policy of its own; `default-resilience-settings.ts` holds its settings; `own-policy.ts` keeps its name; and the set the default policy leaves alone is `adapters-with-own-policy.ts` (`adaptersWithOwnPolicy`, once `self-governed.ts`), whose comment says who fills it, who reads it and why the order of the two policies makes it work. The composition root and the example call them by these names.

To move: nothing for a project that keeps its files. To adopt the names, rename the three files and their imports: `adapterAspects` to `defaultPolicy`, `defaultResilience` to `defaultResilienceSettings`, `selfGoverned` to `adaptersWithOwnPolicy`.

**The Jest configuration of a generated project passes its own lint.** `jest.config.js` read `process.env.CI` without importing `process`, which the lint of the project (`no-undef`, since a JavaScript file has no type information) reported as soon as the file was linted; `knexfile.js` already imported it from `node:process`. The configuration now imports it the same way.

To move: add `import process from 'node:process';` at the top of `jest.config.js`, or run `ddd-ts-kit init --force`.

**An import names a directory as itself: `@/contexts/billing/published-language`, no `/index`.** Under `importExtension: "none"` the generators write the alias of a published language without `/index`, `ddd-ts-kit check` (`imports/extension`) no longer reports an alias that names a directory, and `ddd-ts-kit build-aliases` completes it with `/index.js` in the compiled output (a file `x.ts` next to a directory `x/` still wins, as for the compiler). Under `js` the import still ends with `/index.js`. The sources of the kit itself import files without `.js` and folders without `/index`: the packages are compiled with `moduleResolution: Bundler`, then `pipeline/monorepo/add-extensions.mjs` writes the extension the emitted `.js` and `.d.ts` files need, so a published package still runs on Node and resolves its types under `NodeNext`.

To move: nothing is required, an import written with `/index` keeps compiling. Drop the `/index` of the aliases that end with `published-language/index` to match what the generators write now.

## 0.85.0

**The `biome.json` that `init` writes leaves out `.ddd-ts-kit/`, so `npm run format:check` and `verify` pass while the guard keeps its state there.** The guard and the workers write their state in `.ddd-ts-kit/` (git-ignored) as JSON on one line, and the formatter, which formats every `.json` file, reported each of them: `verify` failed in a project where an agent had run. The template now has `"!**/.ddd-ts-kit"` in `files.includes`, as the kit has.

To move: add `"!**/.ddd-ts-kit"` to `files.includes` of `biome.json`, next to `"!**/.worktrees"`. `doctor` does not judge `biome.json`: the line is added by hand.

**`plan-waves` gives the status of every row a row waits for, and lists apart the rows of another story that the plan waits for.** A row of the waves names what it waits for with its status, `after #US1.02 (todo)`, and with its context and its story when that row belongs to another story or to a context not shown: `after #US1.04 (todo, billing, story US1)`. After the waves, `Rows another story waits for, not done` lists each row of one story that a row of another story depends on, with its owner, its status, the batch that holds it (or the `plan-waves <context>` that shows it) and the rows that wait for it, so that a conductor sees before launching a wave that it waits on work of another story, and whether anyone carries it. `--json` adds `story` and `waitingForRows` (`{ id, context, story, status }`) to each row, and `otherStories` to the plan; `waitingFor` is unchanged.

**`InMemoryEventBus` can rethrow the failure of a single handler as it is, and new projects ask for it.** `new InMemoryEventBus({ failures: 'as-thrown' })` still runs every handler of an event when one fails; when exactly one failed, `publish` rejects with that error itself instead of an `AggregateError` holding it, so its class and its `code` reach the caller; several failures still come together in an `AggregateError`. The default, `failures: 'aggregated'`, keeps the behaviour of the previous version: nothing changes until a project opts in. The same choice is given to the buses the kit builds: `eventBusFailures` of `kernelModule()`, of `createTestApplication()` (`@ddd-ts-kit/di`) and of `createTestBuses()` (`@ddd-ts-kit/testing`).

What `as-thrown` changes where events are delivered in the process: a refusal (`DomainError`) or a lost update raised in a handler reaches the caller with its own class and code. An HTTP request whose events are handled in the process is answered with the status mapped to that code (409 for `CONCURRENCY_CONFLICT`) instead of 500; a refusal is no longer reported to the error reporter as an unexpected failure, and the dead-letter reports give it the severity `warning` instead of `error`; the outbox relay records its code as `lastErrorCode` instead of `AggregateError`, and the logs describe the error of the handler. A spec that asserted the `AggregateError` of a single failure receives the error of the handler.

A project created by `ddd-ts-kit init` gets it: `src/platform/events/in-process-events.ts` and the stub `custom-event-bus.ts` build the bus with `{ failures: 'as-thrown' }`, and the worlds written by `generate test-world` (and the worlds of the identity preset) pass `eventBusFailures: 'as-thrown'`.

To move: nothing is required in this version. To opt in, build the bus with `new InMemoryEventBus({ failures: 'as-thrown' })` (in `src/platform/events/in-process-events.ts`, and in a custom bus that delivers through one), give `kernelModule({ eventBusFailures: 'as-thrown' })` when it builds the default bus, and add `eventBusFailures: 'as-thrown'` to the options of `createTestApplication(...)` and `createTestBuses(...)` in the worlds and specs. Then update the assertions on a single failure: `rejects.toThrow(AggregateError)`, `rejects.toBeInstanceOf(AggregateError)` and `rejects.toThrow('1 event handler(s) failed')` become an assertion on the error of the handler (`rejects.toThrow('the message')`, `rejects.toBeInstanceOf(ItsClass)`), and `rejects.toMatchObject({ errors: [{ code: 'X' }] })` becomes `rejects.toMatchObject({ code: 'X' })`. The default becomes `as-thrown` in a later minor version.

**`generate e2e` writes the end-to-end spec of a use case no route reaches, started by an integration event of an upstream.** Until now it refused a use case without a route. When an integration event handler of the context sends the command of the use case, the spec publishes the event of the upstream, built from its declaration in the published language, through the running application (`await application.publish([event])`), awaits `application.settled()`, and leaves `it.todo` entries for what a client or another context observes: the `GET` routes of the context, or the integration events it publishes (`collectEvents(application.events, [...])`). `--event <eventType>` names the event when handlers of several events send the command, or when the handler does not send it yet; without a route or such a handler, the refusal names both. `RunningApplication` of `test/e2e/support/start-application.ts` gains `publish(events)`, which hands the events to the handlers of the application as the relay of the upstream would. `describe` also names the event a handler receives when the module file of its context subscribes it with `consume(...)` behind a broker, where it named none.

To move (when a spec publishes an event): `generate e2e` notes a `start-application.ts` without `publish`. Add `import type { IntegrationEvent } from '@ddd-ts-kit/kernel';` (or add `type IntegrationEvent` to the import of `@ddd-ts-kit/kernel` already there), then `publish(events: readonly IntegrationEvent[]): Promise<void>;` to the interface `RunningApplication` (and to `Started`, when the file has it), `publish: (events) => application.eventBus.publish(events),` to the object `start` returns next to `events: application.eventSubscriber`, and `publish: (events) => current.publish(events),` (`started.publish(events)` in the database variant) to the object `startApplication` returns. Do not run `init --force` for this: it writes every file of the platform again from the templates, losing what the generators and the team added there.

**The guard lets a long end-to-end spec be split into parts named after it, and a context worker keep the support of its end-to-end specs in `test/e2e/support/<context>/`.** `clean/file-size` asks to split a spec past 350 lines by behaviour, but the guard refused every new `*.e2e.spec.ts` but a journey, and `generate e2e` writes one name per use case: the split could not be written. The guard now accepts `test/e2e/<use-case>-<behaviour>.e2e.spec.ts` when `test/e2e/<use-case>.e2e.spec.ts` exists, beside `test/e2e/journey-<name>.e2e.spec.ts` as before, and its refusal of any other new end-to-end spec names both forms; the fix of `clean/file-size` on an end-to-end spec says the same. A `context-builder` worker may now write `test/e2e/support/<its context>/`, the helpers and worlds its own end-to-end specs share, instead of copying them into each spec; the rest of `test/e2e/support/` stays the conductor's. The briefing `worker-scope` prints, the `context-builder` agent and the `parallel-work` and `testing` skills say so.

**`merge-trunk` keeps the higher version of a generated client when both sides changed its `package.json`.** Everything under `clients/` is derived, so on a conflict `merge-trunk` took the trunk's side, and `npm run regenerate` keeps the version it finds: a branch that raised the version of `clients/<document>/package.json` lost it, without a word, whenever the trunk changed that file too. A conflict on that file now keeps the trunk's file at the higher of the two versions, by the precedence of Semantic Versioning, and the report of `merge-trunk` says which version it kept and why (`client package.json: trunk side, version 1.3.0 kept, the higher of 1.3.0 on this branch and 1.2.1 on the trunk`). When the version of either side is not a semantic version, the file is left to you as a conflict to resolve.

**In the declared style, the declarations of a context are written per role folder: `<context>.declarations.ts` only re-exports them.** With `"stack.assembly": "barrel"`, `generate`, `docs` and `npm run dev` write a `<folder>.declarations.ts` in every role folder of a context that holds a declared role file, next to the classes it registers: `application/commands/commands.declarations.ts`, `application/queries/queries.declarations.ts`, `infrastructure/persistence/persistence.declarations.ts`, `presentation/http/http.declarations.ts`. A role folder is the folder at `<layer>/<folder>/` under the context: the files of a use case or of a route roll up to it, and a role file sitting directly in its layer goes to `<layer>/<layer>.declarations.ts`. Each file holds the imports it needs, one `export *` per role file of its folder, then the `injected(Class, [Tokens])` of the classes of that folder. `<context>.declarations.ts` stays at the root of the context and holds one `export *` per folder file, nothing else, so the composition root, `contextModule(...)` and the worlds of the tests import it as before. Following one handler no longer means reading three distant places of one long file, and two use cases of different folders no longer touch the same generated file. The declarations of a folder that holds no role file any more are deleted by the next `generate`, `docs` or `npm run dev`, and listed under `deleted` in their output. `declarations/barrel-current` compares every generated file and reports one that is missing, stale or left in an emptied folder; `tree/closed`, `naming/suffix`, `clean/one-export-per-file`, `clean/file-size`, the commit size, `merge-trunk` and the guard of the plugin treat the folder files as generated, like the root one. The coverage of `governedCoverage()` and `governedJestCoverage()` (`@ddd-ts-kit/testing/coverage`) leaves them out of the measure (`exclude`, a negated `collectCoverageFrom`): they sit in the layers it measures, and a spec of an adapter does not load them. Under `"stack.assembly": "discovery"` nothing changes: `<context>.dependencies.ts` still holds the lists. There is no option: the layout is derived from the tree.

To move: run `npx ddd-ts-kit docs` (or any `generate` without `--local-only`, or `npm run dev`), which writes the folder files and rewrites `<context>.declarations.ts` as their summary, and commit the result. Upgrading alone fails nothing: for one minor version, a context still declared in the single `<context>.declarations.ts` of 0.84 is accepted, as long as that file is exactly what 0.84 would write for the current role files and constructors and no role folder holds a declarations file yet. `ddd-ts-kit check` reports it as a warning of `declarations/barrel-current` (exit 0) that says how to move, `docs --check` and `docs:check` pass and print the same warning, and `generate --local-only` leaves it as it is and says so in a note; the move removes the warning. A later minor version reports the single file as an error. A single file that is itself stale (a role file added or a constructor changed since it was written) or a context half moved (the single file next to the declarations of a role folder) is an error now, as any stale generated file. A branch open during the move regenerates them as for any derived file: `merge-trunk` takes the trunk side and `npm run regenerate` writes them again. A project that formats at another width than 120 and left `**/*.declarations.ts` out of its formatter needs nothing more: the pattern matches the folder files too.

**The GitHub pipeline `init` writes runs on the newest patch of its Node release line.** `setup-node`
used the Node the runner image already holds, which lags behind a security release of Node: on
2026-10-22 the runners still held 24.21.0, two days after 24.22.1 fixed CVE-2026-111497 (remote
code execution in the Brotli decoder) and nine other vulnerabilities. The setup action now asks for
`check-latest: true`, and each run installs the newest 22.x or 24.x. The GitLab pipeline already
followed the image tag, which carries the newest patch, and the image builds of both pipelines
read the `node` base image from the registry at each run.

An image already built keeps the Node it was built with, and `docker build` reuses the base image
the machine already holds: the guide of the commands now ships with `docker build --pull .`.

To move: in `.github/actions/setup/action.yml`, add `check-latest: true` under the `node-version`
of the `actions/setup-node` step. Rebuild with `docker build --pull .` (or
`docker compose build --pull`) every image built before 2026-10-21 that runs somewhere, and update
the Node of each machine to 22.23.4, 24.22.1 or 26.12.1.

## 0.84.1

**The GitHub workflows `init` writes run on `ubuntu-26.04`, pinned instead of `ubuntu-latest`.** GitHub moves `ubuntu-latest` from Ubuntu 24.04 to 26.04 between 2026-10-19 and 2026-11-19; the whole pipeline of the kit, generated projects on npm and pnpm included, was run on 26.04 first. With the label pinned, a new image of GitHub reaches a project when its team changes the label, not on a day GitHub chooses. The kit runs its own workflows on the same label.

To move: replace `runs-on: ubuntu-latest` by `runs-on: ubuntu-26.04` in `.github/workflows/`. Do not run `init --force` for this: it writes every file of the platform again from the templates, losing what the generators added there (a grant of a role, the settings of a job, a policy), and replaces a workflow the team changed.

## 0.84.0

**`src/platform/auth/` holds one folder per question, and `ddd-ts-kit platform-folders` moves a project there.** A new project writes its authentication in `auth/authentication/` (the authenticator, the session of a request, the HTTP boundary), what a caller may do whatever the model in `auth/authorization/` (the authorizer behind the port, the guard of the buses, the access policies, `role.ts`, `permissions.ts`, `signed-in-grants.ts`, `log-decisions.ts`), and its model in the one folder `stack.authz` names: `roles/`, `attributes/`, `relationships/` or `custom/`. The names of the files do not change. A project generated before keeps working as it is: the generators, the presets, `init --force` and the rules `authz/granted` and `authz/scope-narrows` read and write its files flat, and `ddd-ts-kit doctor` reports `folder src/platform: flat` without failing `--strict`. `ddd-ts-kit platform-folders` moves the files the kit writes and rewrites every import of them under the source root, `test/` and `scripts/`, by alias or relative path, keeping the extension as written; it names the files of the team it leaves flat, and `--place <file>=<folder>` moves those too; `--dry-run` shows the plan.

To move (when the team wants the folders): `npx ddd-ts-kit platform-folders --dry-run`, then `npx ddd-ts-kit platform-folders`, with one `--place <file>=<folder>` per file of yours it lists, then `npm run format` and `npm run verify`.

**`src/platform/` keeps no file at its root: `composition/`, `observability/` and `jobs/`, and the read side of the audit trail in `audit/search-audit-entries/`.** A new project writes `compose-application.ts`, `platform.module.ts`, `platform-test.module.ts` and `lay-foundations.ts` (or `platform.ts` and `create-platform.ts` wired by hand) in `composition/`, `tracing.ts` and `errors.ts` in `observability/` next to the logger and the metrics, `job-settings.ts` in `jobs/`, and the query, the handler and the route or controller of `GET /audit/entries` in `audit/search-audit-entries/`. The names of the files do not change; `main.ts` still imports `tracing.ts` first, and `dev` preloads it from its folder. A project generated before keeps working as it is: the generators write imports of its flat files (a handler spec imports `platform-test.module.ts` where the project keeps it), `init --force` rewrites them flat with the `dev` script, the dependency rules accept `tracing.ts` at either place, and `ddd-ts-kit doctor` reports `folder src/platform: flat` (with `auth/`) without failing `--strict`. `ddd-ts-kit platform-folders` now moves the whole platform, rewrites the paths the scripts of `package.json` name, and names the files of the team left at the root of the platform or of `auth/`; `--place` takes both paths from the platform: `--place auth/role-grants.ts=auth/roles`.

To move (when the team wants the folders): `npx ddd-ts-kit platform-folders --dry-run`, then `npx ddd-ts-kit platform-folders`, with one `--place <file>=<folder>` per file of yours it lists, then `npm run format`, `npm run regenerate` (the dependency rules) and `npm run verify`.

## 0.83.4

**`KafkaEventBus` takes the KafkaJS client it builds its clients from: `cluster`.** The bus made a `KafkaJS.Kafka` of `brokers` and `client` and built its producer, consumers and admin from it, so an application could neither instrument that client nor give the bus another one. The new option `cluster?: KafkaJS.Kafka` is that client: when it is given, the bus reads neither `brokers` nor `client`, builds its clients from it, and disconnects the clients it builds, never `cluster` itself. Without it nothing changes. The specs of `@ddd-ts-kit/kafka` use it to run every suite of the bus on a cluster held in memory, and again against a real broker in the integration job.

**The skill `access-control` and the README of `@ddd-ts-kit/auth` say how a search across many elements is authorized under relationships, and why the signed-in grants never let it past the bus.** Under ReBAC a requirement always names a resource, so a search names an enclosing one: the context the generator writes (`{ type: 'context', id: '<context>' }`), or the tenant of the actor with a `from(...)` permission when an actor who reaches no element must get 403 instead of an empty page, at the cost of a check that reads the elements of the tenant for an actor who holds none. Its handler asks `Access.scope` on the permission of one element, which the relationships answer with `ids`. A permission in the signed-in grants lists `all` whatever the model: granting it there to let the search through lets every signed-in person read every element, so the search gets a permission of its own and the scope stays on the permission of the element. The skill lists the specs that prove a search lists nothing it should not, run with the real authorizer.

To move: a search whose scope is asked on a permission of `signed-in-grants.ts` lists everything to every signed-in person; give the search its own permission there, or move the requirement to an enclosing resource, and ask the scope on the permission of the element.

**`ddd-ts-kit check` warns when a search narrows by a permission every signed-in person holds (`authz/scope-narrows`).** `SignedInGrantsAuthorizer` answers the permissions of `platform/auth/signed-in-grants.ts` before the model, and lists them `all`: a handler that asks `Access.scope` about one of them reads every element for every person who signed in, while its tests stay green. The new rule reports the `.scope(` call whose permission a signed-in grant covers (its entry, its id, the wildcard of its context or `*`), with the way out: under relationships, the requirement names an enclosing resource (the context, or the tenant) and the scope answers the ids. It reads the grants of `platform/auth/signed-in-grants.ts` and those given to any `new SignedInGrantsAuthorizer({ grants })` as an array or a constant, and the permission written in the call or held in a constant or a field of the handler; grants or a permission it cannot read are reported, never taken as safe. A permission every person holds through the model itself (a role every account has) stays for the specs of the search to prove. Default severity `warn`.

Two messages say more. `generate error <ctx> <Concept> <refusal> --code <CODE>` refused with a code that says something else now names the refusal the code would go with (`Invoice billingFailed` for `BILLING_FAILED`). `verify-slice`, when every change is left out of the slice, no longer says `nothing to commit`: it says that nothing of the slice is to commit and that the files left out are the conductor's or another worker's.

To move: run `npx ddd-ts-kit check --rule authz/scope-narrows`. For each report, take the permission out of the signed-in grants and let the model decide it; under relationships, name an enclosing resource in its `@Requires`.

**Before a push, a project runs the unit specs of the contexts its branch reaches, and its test runner takes half of the cores of a developer machine.** The pre-push hook ran every unit spec with its coverage at each push: on a project that grows, with several coding agents and their worktrees, that load stalled the machine. `ddd-ts-kit affected` takes `--run <script>`: it runs that script of the project on the selection, as the pipeline does on a pull request (`DDD_TS_KIT_AFFECTED` set to the contexts the change reaches and the ones downstream of them, `--passWithNoTests` on a partial run), runs nothing when only documents changed, everything when a shared path changed or git cannot tell, and answers the exit code of the script. The `lefthook.yml` that `init` writes runs `npx --no -- ddd-ts-kit affected --base origin/HEAD --run ci:test:unit` before a push; the pipeline still runs everything on the trunk and every night. The generated `vitest.config.ts` and `jest.config.js` give the specs `maxWorkers: '50%'` when no `CI` variable is set; `VITEST_MAX_WORKERS` sets another number. A new guide, [Sandboxing coding agents](docs/guides/agent-sandbox.md), says what loads a machine, how to cap a session, and how to run one in NVIDIA OpenShell when its security matters: the guard of the plugin fails open and is no security boundary.

To move: in `lefthook.yml`, replace `run: npm run ci:test:unit` of the job `unit tests` with `run: npx --no -- ddd-ts-kit affected --base origin/HEAD --run ci:test:unit` (`pnpm exec ddd-ts-kit ...` under pnpm); a clone without `origin/HEAD` runs everything until `git remote set-head origin --auto`. In `vitest.config.ts`, add `const WORKERS = process.env.CI ? {} : { maxWorkers: '50%' };` and `...WORKERS,` at the top of `test`; in `jest.config.js`, `...(process.env.CI ? {} : { maxWorkers: '50%' }),`.

## 0.83.3

**A guard that decides on the caller alone refuses it before the request is read: an anonymous caller of an `Authenticated` route gets 401, never the validation issues of its input, and its upload is never received.** The guards of a controller route ran inside `handle`, after the pipeline had received the upload, read the body and validated the request. A caller with no credential (`resolvePrincipal` answering the anonymous actor, as `principalResolver` does without an `Authorization` header) that sent a malformed input to a guarded route got `422 VALIDATION_FAILED` with the issues, which describe the input the route expects, instead of `401`, and its multipart upload was received and parsed before it was refused. `Guard` gains `admit?(admission: GuardAdmission)`, the part of its decision that reads the route, the raw headers, the actor and the session, and `Route` gains `admit?(admission: RouteAdmission)`, which `executeRoute` calls right after `resolvePrincipal`, before the upload, the body, the negotiation and the validation. `controllerRoutes` gives a route the admissions of its guards, in their order; their checks still run in order after validation, so a guard that reads the path reads validated parameters. `Authenticated`, `HasRole` and `HasScope` decide there (401 to the anonymous caller, 403 without the role or the scope), and `TenantMember` refuses the anonymous caller there, the tenant of the request being checked after validation as before. A refusal at the admission is reported to `onGuardRefusal`, and audited by `auditGuardRefusals`, as a refusal of a guard; `guards: 'skip'` leaves it out with the checks. A caller with a valid credential and a malformed input still gets 422. The JSON parser of a framework (`express.json()`, the body parser of Fastify or NestJS) still runs before the pipeline.

To move: nothing for the guards of the kit. A guard of the project that decides on the caller alone (a role, a claim, a header) declares `admit` with that decision to refuse before the request is read; one that reads the path keeps deciding in `check`.

## 0.83.2

**A project written with `init --preset identity` passes its whole `verify` right after the install, with no step of its own.** Two of its steps failed on a project just initialised. `test:coverage`: the branches of `identity/presentation` stood at 66.66% under their floor of 70%, as the controller of `PUT /accounts/me` was never called by a token without an address, nor without a display name in the body; its spec now covers that case. `docs:check`: `openapi/openapi.yaml`, `docs/integration/asyncapi.yaml` and `docs/integration/event-catalog.md` held none of the routes and events of the preset, as the contracts are written from the running application, which `init` cannot build. `init --preset` now marks them with `x-ddd-ts-kit-pending`, and the first check of `scripts/openapi.ts` and `scripts/events.ts` (in `verify` or `docs:check`) writes them, saying `<file> is written for the first time, ...: commit it.`; where `CI` is set, a contract still marked fails instead (`<file> was never generated: run the script docs:generate and commit it.`), so that a pipeline never passes on a contract nobody wrote. The `bootstrap` skill runs `docs:generate` after `generate context --preset` in a project that exists, whose contracts are already written.

To move: a project written from the preset by 0.83.1 or earlier runs `npm run docs:generate` once and commits the contracts; its `verify` then fails only on the coverage of `presentation`, which the case `names the person after their username when the body names nothing, and sends no address the token lacks` of `provision-account.controller.spec.ts` covers. Projects initialised with 0.83.1 or earlier keep their `scripts/openapi.ts` and `scripts/events.ts`, which know no mark and need none.

## 0.83.1

0.83.0 was set but never published: four fixes reached `main` before its version did, and 0.83.1 holds them with the rest. No version 0.83.0 is on the registry.

**`DomainRefusal` in the kernel: one class per refusal, named after it, built by static factories named after what it is about.**
`class InsufficientFunds extends DomainRefusal { readonly code = BankingCodes.InsufficientFunds; static forAccountId(..) { return InsufficientFunds.refusal(message, facts) } }`,
thrown as `InsufficientFunds.forAccountId(account.id, missing)`. The class sets the code, read from a
closed list of the codes of the context; `refusal(message, facts?)` types the facts of each factory,
`.exposing(..)` and `.causedBy(..)` work as on `ConceptError`, and `InsufficientFunds.is(error)` narrows
with those facts. `ConceptError` and `DomainRefusal` now share `FactualRefusal`, which `@ddd-ts-kit/http`
reads to write the exposed facts of either form in the problem document. `isRefusal(error, SchedulingCodes)`
takes the closed list of the codes of a context and narrows to one of them, so that a `switch` on the code
is exhaustive. Nothing changes for a project that writes `ConceptError`.

**`init` writes `"stack.refusals": "named"`: a refusal is a class of its own, named after what is refused, built by static factories named after what it is about, its code read from the closed list of its context.**
`throw SlotTaken.forCalendar(calendar.id, slot.startsAt)`, where `SlotTaken` extends `DomainRefusal` in
`domain/errors/slot-taken.error.ts` and reads `readonly code = SchedulingCodes.SlotTaken` from
`domain/errors/codes.ts`, the list `SchedulingCodes` of every code of the context and its union type
`SchedulingCode`. `ddd-ts-kit generate error <context> <Refusal> <factory> [--code CODE]`
(`generate error banking InsufficientFunds forAccountId`) writes the class, its entry in `codes.ts`, the
factory and its spec case, each when absent; run again, it changes nothing. A factory starts with `for`,
`with`, `because`, `on` or `at` (`forCalendar`, `withNotice`, `becauseOf`); the code defaults to the refusal
in constant case and is unique in the context. Under `named`, `errors/through-factory`,
`errors/constructor-not-public`, `errors/code-unique` and `errors/known-code` judge the classes of
`DomainRefusal` and the values of `codes.ts`; `errors/factory-name` refuses a class named `...Error` and a
factory without one of the five prefixes; the new `errors/code-listed` of `ddd-ts-kit check` holds the list
(each refusal class reads its code under its own name, `codes.ts` exists as soon as one does, every key is a
refusal class of the context, every value a string literal in constant case, the list is `as const`);
`language/glossary-term` judges every class of `domain/errors/` under `named` as it judges an aggregate,
each word of its name a term of the glossary of its context, a refusal class allowed the qualifiers
`invalid`, `unknown`, `already`, `too`, `no`, `missing` and `required` besides (`SlotTaken`, `BookingTooLate`
and `InvalidAppointment` pass with `Slot`, `Take`, `Booking`, `Late` and `Appointment` in the glossary);
`codes.ts` is not judged. `generate error` refuses a refusal named with a word the glossary does not define,
and `--term "<Term>=<meaning>"` adds it in the same command. `generate domain-error` is refused under
`named`, pointing to `generate error`. The two earlier
forms keep working as they are: a project that says `"factories"` (one `ConceptError` class per concept)
is judged by the rules of that form, and a config without the key is still `classes`.
`ddd-ts-kit error-factories` now moves a project to `named` (`--to named`, the default), from either form: `--plan`
proposes, per refusal, a class (the PascalCase of its code, which it keeps) and a factory (`for<Concept>`),
both editable; `--apply` writes `codes.ts` in each context, one class file per refusal and its spec,
rewrites every usage (`AppointmentError.ended(a, b)` becomes `AppointmentEnded.forAppointment(a, b)`,
`AppointmentError.is(error, 'APPOINTMENT_ENDED')` becomes `AppointmentEnded.is(error)`, imports included),
removes the concept classes left empty, sets the key, and lists what it cannot rewrite (a bare
`AppointmentError.is(error)`, `CodeOf<typeof AppointmentError>`); `--plan` and `--apply` both list each class
whose name uses words the glossary of its context does not define. `--to factories` keeps the earlier move
from one class per error to concept classes.

To move: nothing is required, a project keeps its form. To adopt named refusals, run
`npx ddd-ts-kit error-factories --plan`, edit the class and factory names in `error-factories.plan.json`,
then `npx ddd-ts-kit error-factories --apply`, run the formatter and `npx ddd-ts-kit check`, and settle
the lines it lists as left to you.

**`event-sourcing/upcaster-required` sees a change inside the type arguments of a stored shape.** The fingerprint of a stored event read a member such as `totals: Record<string, number>` as two pieces split at its comma, and sorted them with the other members: `{ a: Record<string, number>; b: Record<number, string> }` and `{ a: Record<string, string>; b: Record<number, number> }` had one fingerprint, so a stored event could change in place unseen. A member is now read whole, an arrow `=>` inside its type arguments included. A version recorded by 0.82.0 or earlier for such a type is still taken for the same shape, `docs --stored-events` records it again as the kit reads it now, and `docs --check` reports it (`formerly recorded <event> version <n> in stored-events.lock.json`, `formerlyRecorded` in JSON) until it is.

To move: in a project whose stored events hold a type argument list with a comma, a semicolon or a line break (`Record<string, number>`, `Map<K, V>`), `docs --check` fails right after the upgrade, and with it the generated pipeline (`npm run docs:check`), until the lock is recorded again: run `npx ddd-ts-kit docs --stored-events` once, with the codecs as they are, and commit `stored-events.lock.json` in the same pull request as the upgrade. It rewrites only the versions `docs --check` lists as formerly recorded. Any other shape keeps its fingerprint, and its project sees no change.

**`signedDownloadUrl` and `signedUploadUrl` of `LocalFileStorage` and `InMemoryFileStorage` reject the promise they return for a key or an expiry they refuse.** They threw at the call, before any promise, so a `.catch(...)` chained on the call missed the `FileError` (`INVALID_FILE_KEY`, `INVALID_FILE_URL_EXPIRY`). They now behave as `S3FileStorage` always did; code that awaits the call sees no difference.

**`authz/policy-asked` reads the permission of `definePolicy` from the object written as its first argument only.** It took the first `{` anywhere after `definePolicy(`: in a file holding `definePolicy(options)` and, further on, any object with a `permission` entry, that permission counted as refined by a policy, and every handler of a use case requiring it was reported as never asking it. A policy whose options are not written in the call refines no permission the rule can see, as before.

**The `decorators()` plugin of `@ddd-ts-kit/testing/vitest` compiles again a cache entry that lost its output or its map, and replaces it.** An entry whose directory was left without its emitted file or its source map failed every compile of its file with `ENOENT` until the cache directory was removed by hand.

**`config/valid` no longer says the contracts are written in YAML only.** An unknown `openapi.format` was reported with "the contracts are written in YAML" although `json` is accepted too; it now reads "a format the contracts are not written in", its fix listing `yaml` and `json`. A document of `openapi.documents` with a wrong name is told its file is `openapi/<name>.json` when the contracts are written in JSON, instead of `.yaml` whatever the format.

**`InMemoryReadModelTable` refuses to insert an entry without a `row`, as the Knex, Prisma, Drizzle and TypeORM tables do.** Its `insert` stored such an entry as the trace of a deleted row and answered `true`, where every ORM adapter answers `false` and writes nothing, so a test over the fake could pass where the real table did not. `TableReadModelStore` never inserts such an entry, so a read model written through it sees no difference. `readModelStoreContract` of `@ddd-ts-kit/testing` now holds every adapter of `ReadModelTable` to it.

**`@ddd-ts-kit/audit`: inside a unit of work, `KnexAuditTrail` and `DrizzleAuditTrail` write the entries at its commit, so an append no longer ends in a PostgreSQL deadlock (`40P01`).**
An append used to lock the head of its chain at the call to `record` and hold it until the commit. A
unit of work that recorded (an authorization decision, an entry by hand) and then locked a row could
deadlock with another unit of work of the same tenant that held the row and appended to the same chain,
the head being created or not: PostgreSQL killed one of them with `40P01`, which reached the caller as an
error 500. The same happened between two units of work that appended to two chains in opposite orders.
The records of a unit of work now wait for its commit (`atCommit` of the kernel): they are written last,
after the work and its `before-commit` handlers, each chain once, the chains in the order of their names.
The head is the last lock a transaction takes, every transaction takes the heads in one order, and a unit
of work still at its work no longer makes the other writers of its tenant wait. Outside a unit of work an
entry is written at once, as before. Nothing changes in the tables, the hashes or the chains already
written.

To move: nothing for most projects. An entry recorded inside a unit of work is no longer visible inside it
before the commit, and a refusal of the store (an `id` written twice) now fails the commit instead of the
call to `record`: a test or a handler that read the trail back inside the same unit of work reads it after
the commit.

**A deadlock or a serialization failure anywhere in the transaction of a unit of work rejects it with `TransactionConflictError`, a `ConcurrencyError`, instead of the raw error of the driver, and `@ddd-ts-kit/http` answers `CONCURRENCY_CONFLICT` with 409.**
When two transactions take the same locks in opposite orders, PostgreSQL gives up one statement of the
cycle with `40P01`, the one it chooses: an append of the event store or of the audit trail, which the
store already turned into a `ConcurrencyError`, but just as well the update of a row of the other
transaction, which reached the caller as an unexpected error (a 500 through `@ddd-ts-kit/http`). The same
went for a serialization failure (`40001`) under REPEATABLE READ or SERIALIZABLE. `withinUnitOfWork`, which
the units of work of `@ddd-ts-kit/knex`, `@ddd-ts-kit/drizzle`, `@ddd-ts-kit/prisma` and
`@ddd-ts-kit/typeorm` are built on, now rejects the outermost unit of work with `TransactionConflictError`
(code `CONCURRENCY_CONFLICT`, the error of the driver as `cause`) for `40P01` and `40001` of PostgreSQL,
the `40001` of a MySQL deadlock and `P2034` of Prisma, whatever wraps them. Nothing of the transaction
committed, so the command can run again. `ConcurrencyError` takes an optional `cause`. `DEFAULT_ERROR_MAPPING`
of `@ddd-ts-kit/http` now maps `CONCURRENCY_CONFLICT`, a lost update included, to 409 Conflict: it fell
back on 422, which a client reads as a request to correct, not to send again.

To move: a project that recognised `40P01` or `40001` itself, around a command or in its error mapping,
reads `ConcurrencyError` (or the code `CONCURRENCY_CONFLICT`) instead. A client or a test that expected 422
for `CONCURRENCY_CONFLICT` expects 409; a project that wants 422 back passes `{ CONCURRENCY_CONFLICT: 422 }`
to `createErrorMapper`.

## 0.82.0

**`drizzle-generate --replay` replays only what forks, and refuses to lose a migration edited by
hand.** The replay first reads the history on disk: when the journal lists every migration in
order, each snapshot from the one before, the branch's already follow the trunk, and nothing is
generated again (a name that changes, `working-` dropped, is renamed in place). Otherwise it
deletes the branch's migrations and generates them again on top as before, then compares each
generated one with what the branch had: when drizzle-kit now writes other statements (its SQL was
edited by hand, or the trunk changed what it changes), it puts the migrations folder back as it
found it and refuses, naming the statement that differs; the fix is to generate that migration on
top by hand and write the edit again, after which a replay, or `merge-trunk --continue`, finds
nothing forked. Several migrations of a branch that change the schema and fork are still
refused rather than joined: drizzle-kit diffs the final schema and cannot split them again, and
one migration in their place would join steps planned apart (a table, then a constraint once it
is filled, fails on a database that holds rows). Its fix said to generate them as one; it now
says to generate them again one at a time, in their order. Measured with the real drizzle-kit
0.31.11: the replayed history is applied by `drizzle-kit migrate`.

**`persistence/primary-key-order` (a warning).** Under drizzle-kit, a migration that adds the new
primary key of a table before its old one is dropped, or drops a column before the key that holds
it, is reported on the line of the statement that runs too early: PostgreSQL refuses it when it
runs. `drizzle-generate` already warned once when it wrote one; the rule keeps reporting it. Fix:
drop the old key first, in that migration while it is still unapplied, or write it with
`--custom`. `ddd-ts-kit check --rule persistence/primary-key-order` lists the migrations to take
up; the rule stays a warning in this version.

**Two migrations kept apart.** The `persistence` skill and the persistence page say how: change
the schema in two steps, with a `db:generate` after each, since one `db:generate` writes every
change since the last migration as one.

**A cron accepts the shorthands `@hourly`, `@daily`, `@weekly`, `@monthly` and `@yearly`.**
`@Scheduled` and `ddd-ts-kit generate job --cron` read `@yearly` and `@annually` as `0 0 1 1 *`,
`@monthly` as `0 0 1 * *`, `@weekly` as `0 0 * * 0`, `@daily` and `@midnight` as `0 0 * * *` and
`@hourly` as `0 * * * *`, in any case, and fire on the occurrences of those five fields (`@hourly`
keeps its rhythm when clocks change, as `0 * * * *` does). A diagnostic and `ddd-ts-kit docs` show
the shorthand as written. `@reboot` and any other `@word` are refused by both with the same
message, which lists the shorthands accepted: a scheduled job has no occurrence at start.

**A lint warning fails the lint of a generated project.** `lint` and `ci:lint` ran `eslint .`,
which exits 0 on warnings: `verify` and the pipeline passed them, a new one as well, and they
piled up. `init` now writes `ddd-ts-kit lint` for both, and the example application runs the
same: the ESLint of the project, through its API (its paths, `--format` and `--fix` as ESLint
takes them), failing on an error and on a warning alike, but on a warning of a rule of the kit in
transition. A rule a version adds, or what a rule judges more, is a warning for one minor version
and an error at the next; its documentation names that version (`transition`), and `ddd-ts-kit
lint` shows its warnings and lists them after the report, one line per rule with the version that
makes it an error, without failing on them. An upgrade of the kit therefore never turns a green
lint red, which a plain `eslint . --max-warnings 0` would. The preset keeps its warnings as warnings (`complexity`, `max-depth`,
`clean/function-size`, `clean/no-flag-argument`, ...) and `init` writes no suppressions file: a
new project has no warning, so the first one fails `npm run lint`, `verify` and the lint job on
GitHub and GitLab. The hook before a commit is unchanged: it shows a warning without stopping the
commit. The quality-gate skill says so; the workflow is in
[Quality baseline](docs/tools/quality-baseline.md#warnings-fail-the-lint).

To move: nothing changes until the project acts. `npx ddd-ts-kit init` keeps an existing `lint`
and `ci:lint` and notes what the kit expects; `doctor` lists them as written otherwise, which
`doctor --strict` does not fail on. To take the limit, run `npx eslint .` and settle each
warning: fix it, or raise its rule to `error` (its id in the `rules` key of
`ddd-ts-kit.config.json` for a rule of the kit, a block after the preset in `eslint.config.mjs`
for `complexity` or `max-depth`) and record the existing findings with
`npx eslint . --suppress-rule <rule>` (or `--suppress-all`) in `eslint-suppressions.json`,
committed; once one is fixed, `npx eslint . --prune-suppressions` removes its entry, and the lint
fails until it does. Then set the two scripts to `ddd-ts-kit lint`, or run
`npx ddd-ts-kit init --force`, which also writes every other file and script of the kit over the
project's. Update the plugin.

**`check --explain` follows the violations with the reason of each rule they report.** A reviewer
of a pull request ran `ddd-ts-kit explain <rule-id>` for each rule `check --changed-since` named.
`--explain` prints, after the violations, one block per rule reported, however many times: its
id, its description and why it exists, as `explain` gives it without the examples; for a rule
another tool decides, where it is checked. `--format json` adds an `explanations` array.
`--format github` and `--format gitlab` keep one annotation per violation and end the message of
each with `Why: <reason>`, since a pull request shows an annotation alone on its line and a Code
Quality report has no place for text beside its issues; the fingerprints do not change. It
combines with paths, `--rule`, `--changed-since` and `--clean-only`. Without it, the output is
the same as before.

**`doctor` checks the environment of a checkout.** A new worktree starts from nothing, and what
goes wrong there is its environment: `verify` failed late, on a symptom. After what an upgrade
left to do, `npx ddd-ts-kit doctor` now says what this checkout lacks to run the project, read
from its files without network: the running Node against `engines.node` (`node engines.node:
unsupported`) and the version `.nvmrc` names; `node_modules` missing or installed before the
lockfile last changed (`install node_modules: missing`, `outdated`); `ddd-ts-kit` and every
`@ddd-ts-kit/*` package installed at the version of the running CLI (`install <package>: not
installed`, `other version`), where the package findings read the ranges of `package.json`, in
the install of its workspace for a project inside one; and,
with a `.gitmodules`, every submodule initialised (`submodule <path>: not initialised`). Each comes
with its fix (`nvm use`, `npm ci` in the dialect of the project, `git submodule update --init
--recursive`). `--strict` now also exits 1 while the checkout cannot run the project: a Node
outside `engines.node`, no `node_modules`, a package of the kit not installed or at another
version, a submodule not initialised. A Node `.nvmrc` does not name and a lockfile changed since
the install are said without failing it. A project or a pipeline that runs `doctor --strict` where
no dependencies are installed fails from this version: install first. `--json` gains the areas
`node`, `install` and `submodule`. The `parallel-work` skill runs it in a worktree made otherwise.

**`init` records the version that wrote the files of the platform.** `ddd-ts-kit.config.json`
now starts with `"initVersion"`, the version of the CLI whose `init` wrote the files it owns;
`init --force` rewrites it, and `init` run again to add a context leaves it. Nothing reads it yet:
it is the first step of an `init` that tells, after an upgrade, a change of its templates from an
adaptation of the team. A config without the key stays valid.

To move: nothing; `init --force` adds the key to a project initialised before it existed.

**An adapter that nothing wires is reported.** `declarations/port-adapter-wired`
(`ddd-ts-kit check`, a warning) reports a class of `infrastructure/` that implements a port of
`domain/repositories/` or `application/ports/` and that nothing wires: in the declared style it
carries no `@Repository`, `@Gateway` or `@Adapter`, and in both styles no file of the composition
root (`<context>.module.ts`, `main.ts`, `apps/<context>/main.ts`, the platform directory) imports
it. `declarations/role-declared` reads a role file by its suffix, so such a class in a file without
one was reported by no rule and only showed at run time as a missing binding. A file that still
carries a `TODO(domain)` or `TODO(platform)` is not judged yet: an adapter the generator wrote
before the outside system is ready is listed by `ddd-ts-kit todo` until it is wired. To move, run
`ddd-ts-kit check --rule declarations/port-adapter-wired`, then declare each reported class
(`@Gateway(Port)` in a `*.gateway.ts`, for example) or bind it in the module file; one kept
unwired on purpose gets its decision record in `docs/adr/` and
`// ddd-ts-kit-disable-next-line declarations/port-adapter-wired -- ADR-NNNN: <why>` above the class.
It becomes an error in the next minor version.

**The plugin and the packages share one version: 0.82.0.** The plugin numbered itself apart
(0.81.0 while the packages were at 0.27.0), so one agent showed a version and another the other.
From this release on, the release sets the version of the plugin with the version of the
packages; the version its skills describe already was that of the packages. The packages jump
from 0.27.0 to 0.82.0, above the last version of the plugin, so that an installed plugin is still
updated; no version between them was published. The plugin now changes with each release of the
kit, and an urgent fix of it is a patch release of the kit.

To move: upgrade the packages of the kit to 0.82.0 together, as at every release, and update the
plugin; from now on its version is the version of the kit.

## 0.27.0

**The worktrees of a project live inside it, and a new project writes its code in a worktree.**
`worker-scope`, `story-scope` and the new `ddd-ts-kit worktree <name>` (any other piece of work,
on `work/<name>`, cut from `origin/main` when run from the trunk, installed) open their worktree
in `.worktrees/` of the main checkout, whichever worktree they run from, instead of a sibling
folder `../<project>-<name>`; `plan-waves` names `.worktrees/<context>-<batch>`. `init` lists
`.worktrees/` in `.gitignore`, the formatter, ESLint, the checker and the Docker context leave it
out. A new project gets `"worktrees": "required"`: the guard of the plugin refuses the code of a
context and the generators that write it (`context`, `adr` and `acceptance` aside) in the main
checkout of the trunk, and says so at session start with the command that opens a worktree; the
conductor of a parallel build writes its contracts and skeletons in a worktree of its own and
lands them as a pull request. In a worktree of `.worktrees/` without its own `node_modules`,
whose Node would resolve the packages of the main checkout above it, the guard refuses that code
until it is installed. `story-scope` and `worktree` take the remote branch of the trunk as their
base only from the trunk itself: any other branch is its own base.

To move: nothing is required. A project started before has no `worktrees` key, read as
`"advised"`: the guard only says where the code goes. Run `npx ddd-ts-kit init` once to add
`.worktrees/` to `.gitignore` (until then the commands open their worktrees next to the project,
as before, with a note), commit it, and set `"worktrees": "required"` when the team works in
worktrees. Update the plugin, and `@ddd-ts-kit/eslint-plugin` for its ignore of `.worktrees/`;
add `"!**/.worktrees"` to the `files.includes` of `biome.json`. A worktree opened before keeps its
place: `git worktree move <path> .worktrees/<name>` moves it.

**Where the open stories meet, while they are built.** The new command `ddd-ts-kit stories`
lists the stories open in the worktrees of the repository and, for each pair that meets, the
contexts the rows of both name, the files both worktrees change (committed or not, those
`merge-trunk` settles by their kind aside), and what merging the branch of one into the other
would leave to settle by hand and what `merge-trunk` settles alone, computed with
`git merge-tree` without writing anything; for each story, how far it is behind its trunk and
what bringing the trunk in would leave to a person. From the worktree of a story it names the
stories that one meets. The guard of the plugin says it at session start in the worktree of a
story, with the trunk that moved and a last fetch more than an hour old, and says once per file
when the session writes a file another open story changes. `story --gate close` now also waits
for the trunk merged in (the phase `trunk`), and `story-scope` cuts a story from the branch the
current one follows (`origin/main` for `main`) when it has one, so that a `git fetch` is enough
to see the trunk move: nothing of the kit goes to the network. The skill `story` reads
`stories` before cutting the rows and before each row, and fetches before closing.

To move: `npx ddd-ts-kit init` adds the permission of `npx ddd-ts-kit stories`; update the
plugin. A story opened before this version keeps its base: `story-scope` resumes it as it was.

**One session takes one user story to its pull request, one story per terminal.** The new skill
`/ddd-ts-kit:story <code>` (run by the owner) works in the worktree of the story: it asks every
question at once, then without stopping writes `docs/architecture/stories/<code>.md` (statement,
questions and answers, acceptance criteria, decisions), the rows of the story, a design review
section per row in `docs/architecture/reviews/<code>.md` read by `architecture-reviewer`, the
acceptance written and locked; it builds row by row with one `context-builder` agent confined to
one context, merges the trunk in, reviews, verifies, writes `## Report` (each provisional
decision, compromise and amendment) and opens the pull request. New commands:
`ddd-ts-kit story-scope <code>` opens the worktree of a story on `story/<code>` (or finds it
again), refuses a story open in another worktree and names the other open stories with the
contexts they change; `ddd-ts-kit story [<code>] [--gate build|close]` says where a story stands,
phase by phase, and its next step; `worker-scope <context> --here` briefs the next agent inside
the worktree of a story, without a worktree of its own. In the worktree of a story, the guard of
the plugin refuses any code of a context until `story --gate build` passes, says the phase at
session start, and refuses once to end the session before the report. New guide:
[story workflow](docs/guides/story-workflow.md).

To move: update the plugin; `npx ddd-ts-kit init` adds the permissions of `story` and
`story-scope`.

**A story's acceptance tests are written, locked and run before its code, and a locked scenario
changes only with its criterion.** A story states its acceptance criteria in
`docs/architecture/stories/<story>.md` (`- AC1: ...` under `## Acceptance criteria`).
`ddd-ts-kit generate acceptance <story>` writes `test/acceptance/<story>.acceptance.spec.ts`, an
`it.todo` per criterion (per slice row when the story states none), on the support of
`test/e2e/`. Each scenario names the rows that make it pass and the criterion it proves
(`'#US5.02 AC1 ...'`) and runs wrapped in the new `pending(...)` of `@ddd-ts-kit/testing/e2e`:
it passes while an assertion fails, and fails once the scenario passes (the slice removes the
wrapper) or stops on anything but an assertion (the scenario is broken). The new command
`ddd-ts-kit acceptance [<story>]` reads the scenarios against the rows of `slices.md` and the
criteria: `--gate written` before the code (every slice row and criterion covered, nothing left
to write, the acceptance locked), `--gate passing` before the story closes. `--lock` writes
`test/acceptance/<story>.acceptance.lock.json`, the fingerprint of each criterion and scenario
(the wrapper, the layout and the comments aside). Afterwards a criterion changed, or a scenario
changed or removed while its criteria were not, is reported whatever the gate, and locking again
takes a verdict `amend` on that very version from the new `acceptance-judge` agent, which compares
the locked version, the new one, the criterion and the owner's answers
(`test/acceptance/verdicts/*.md`); a refusal wins, and the verdicts become amendments the command
lists for the owner to validate. The guard of the plugin lets a sub-agent only remove
`pending(...)` in an acceptance spec, refuses it `acceptance --lock`, lets the judge alone write a
verdict and nothing else, refuses the lock and the verdicts to any hand edit or shell write, and
refuses an acceptance spec written by hand instead of generated. `verify-slice` stages the
acceptance spec with the slice. The new rule `test/acceptance-black-box` (a warning) refuses an
acceptance spec that imports from the source root anything but the builders and the published
language of a context. The skills `testing`, `use-case`, `plan-slices`, `quality-gate`,
`parallel-work` and the `context-builder` agent follow.

To move: a new project runs its acceptance specs with `npm run test:e2e`; in an existing one, add
`'test/acceptance/**/*.acceptance.spec.ts'` to the `include` of `vitest.e2e.config.ts` (the
`testMatch` of `jest.e2e.config.js`). `npx ddd-ts-kit init` adds the permission of
`npx ddd-ts-kit acceptance *` and the refusal to edit a lock; update the plugin.
`ddd-ts-kit check --rule test/acceptance-black-box` lists the acceptance specs to take up.

## 0.26.0

**The guard recognises the CLI of the kit however it is launched.** The refusal of
`worker-scope` to a sub-agent (without `--dry-run` or `--resume`) and the refusal to a worker of a
generator that writes shared files or another context read the command word by word: the
`ddd-ts-kit` binary (`npx`, `npm exec`, `pnpm exec`, `bunx`, `node_modules/.bin`), the entry file
of the CLI run by node (`node .../dist/bin.js`) and the kit script of a project
(`node scripts/kit.mjs`) are held alike; until now only `ddd-ts-kit <command>` was.

**A context-builder is warned before its turn limit, and the conductor resumes a stopped worker
from `worker-scope --resume`.** An agent cannot count its turns, and one that stopped at its limit
left the conductor to inspect the worktree by hand to write the next message. The guard of the
plugin now counts the tool calls of a `context-builder` inside the hooks that already run on its
shell commands and its writes (no hook on every tool call: an ordinary session starts no more
processes) and adds two notices, once a run: finish the slice under way, then stop changing code,
commit what passed and end with the report. It records the agent's runs in its worktree
(`.ddd-ts-kit/agent.json`), restarts the count at each launch or resume (`SubagentStart`), and,
when the agent ends on its own (`SubagentStop`), keeps it going once to commit a slice that passed
`verify-slice` or to rewrite a stale report; both hooks are filtered by the agent. In a worker's
worktree, `verify-slice` prints the exact commit command with the trailer `Slice: <row>` and keeps
its result in `.ddd-ts-kit/verification.json`. `status --workers` adds a `state:` line per worker
(`progress` in JSON), and `worker-scope <context> --resume` reads where a stopped worker stands
and prints the `SendMessage` text for its agent, or the briefing of a new agent holding the row
under way only and the files left. A session start names the workers to resume. `worker-scope`
without `--rows` now briefs the first batch `plan-waves` cuts for the context (one or two rows),
with a note naming the next, and the briefing carries the turn budget. The parallel-work skill
says what to do on each kind of stop, with a limit of two stops on one row.

To move: update the plugin; the conductor's skill may now use `SendMessage`. A worker briefed
before this version commits without the trailer: its rows are matched in order with its
`feat(<context>)` commits and shown `(by order)`.

**`story-check` says whether a story or a milestone can close.** The kit said that a slice may
merge with `TODO(review)` markers while a story closes only once none of its own is left; nothing
checked it. `npx ddd-ts-kit story-check <code>` (`M1` for the rows `M1.01`, `M1.02`: the id
without its last `.<number>`) exits 0 when every row of the story is `done` in
`docs/architecture/slices.md` and no marker of its own is left, 1 listing the rows not done with
their status and each marker that keeps it open, with why it is the story's, its `file:line` and
its fix (handle it, or dismiss it by a decision record with `generate adr`, then delete the
marker), and 2 on a code no row carries or without a slices table. Since several stories often
build one context at once, a `TODO(domain)`, `TODO(platform)`, `it.todo` or `TODO(review)` is
attributed before it blocks: to the rows its text names (`#M1.03` or `M1.03`), else to the rows
the commit that wrote its line names (`git blame`, once per file: its `Slice: <id>` trailer, else
the ids its message names), else, not committed in a worker's worktree, to the rows of
`.ddd-ts-kit/worker.json`. A marker of a context that belongs to no row blocks only when no other
open story has a row in that context, and is listed without blocking otherwise; `--strict` blocks
on every marker of the story's contexts. `status` adds a line for a story whose rows are all done
while markers of its own keep it open (`story M1: every row done, 3 markers left: npx ddd-ts-kit
story-check M1`, `slices.unclosed` in `--json`), and `init` allows `story-check` to the agent. The
plan-slices, quality-gate and parallel-work skills and the architecture-reviewer agent run it
before a story or a milestone is declared closed, and the review now writes each non-blocking
remark as `TODO(review): #<row id> <remark>`.

To move: `npx ddd-ts-kit init` adds the permission to `.claude/settings.json` (`doctor` names it
while it is missing). Name the row in the `TODO(review)` markers already written
(`TODO(review): #M1.03 <remark>`) so that each is held against its own story.

**`language/declared-vocabulary` accepts a word of another language when its type says so.**
A context that reads a published payload or an outside record meets words that spell a value of
its own vocabulary (catalog publishes a `state` of `'draft' | 'issued'`, billing declares
`InvoiceStatus` with the same strings); the checker and ESLint reported them, and the only way out
was to write `InvoiceStatus.Issued` for a word of catalog. Outside `domain/`, such a word is no
longer judged when its type says which language it belongs to: a key of a table typed
`Record<T, ..>`, a value of one typed `Record<.., T>` (by an annotation or `satisfies`), or a
literal written `'issued' satisfies T`, `T` being one type imported from a published language,
imported as a type from a package, or imported from or declared in
`infrastructure/anti-corruption/` or `infrastructure/external/`; there, the literal types of an
interface or a type alias that describe an outside record are not judged either. The compiler
holds the spelling of such a word. A key of a table typed by the vocabulary of the context, a
comparison or a `case` without `satisfies` and a value of the context in a translation table are
still reported, and in a file that reads another language the fix names the types it reads from
there and how to type the literal by one (ESLint message `rawBesideOtherLanguage`).

Nothing to move: the rule only reports less. A workaround such as
`[InvoiceStatus.Issued]: InvoiceStatus.Issued` in a table keyed by a foreign type can be written
with the foreign word again, `'issued': InvoiceStatus.Issued`.

**The git hooks run in every worktree, and fail loudly where they cannot.** The `lefthook.yml`
that `init` writes starts with `lefthook: node_modules/.bin/lefthook`. The hooks of a repository
are shared by all its worktrees; until now the hook script held the absolute path of the lefthook
of whichever checkout installed it last, then fell back to other launchers. Once that checkout was
removed, a worktree without its dependencies skipped every check silently, or had pnpm install
the project inside it. Now each checkout runs its own lefthook, and one without its dependencies
fails the commit with `node_modules/.bin/lefthook: not found`. The repository of the kit does the
same.

**`worker-scope` installs the dependencies of the worktree it creates.** It runs the clean install
of the package manager of the project there (`npm ci`, `pnpm install --frozen-lockfile`),
quietly, and its notes say how long it took. When the install fails, the note gives the end of
its output and what to run; `--no-install` leaves the install out, with the same note.
`--dry-run` and a worktree it keeps install nothing.

**`doctor` checks the git hooks.** Under a new area, `hook`: a `lefthook.yml` without the
`lefthook:` line (missing, fails `--strict`), and a pre-commit hook this clone has not installed,
or that lefthook did not write (said, never failing `--strict`: it is a state of one clone).
Outside a git repository only the file is judged.

**`status --workers` says which worktree lacks its dependencies.** `dependencies not installed`
in the line of a worker whose copy of the project has no `node_modules`; `installed` in `--json`.

**The guard holds the shell of a worker to its scope.** For a `context-builder` agent with its
`.ddd-ts-kit/worker.json`, a file the shell writes by name is judged as a write of the Edit and
Write tools: an in-place edit (`sed -i`, `perl -i`), a redirection (`>`, `>>`, `&>`) or `tee`
pass inside the scope of the worker and are refused outside it (a shared file, another context,
a generated file, another checkout) or on a path only the shell knows (`"$FILE"`); so are `cp`,
`mv`, `rm`, `touch`, `truncate`, `dd`, `install`, `ln`, `find -delete`, `git checkout -- <path>`,
`git restore`, `git rm`, `git mv` and `git clean` outside its scope, and `git apply` and `patch`
always. Inline code given to an interpreter (`node -e`, `python3 -c`, `-` or a heredoc) cannot be
read in advance: it runs, the guard notes the files outside the scope before it, and at the next
command or write of that worker a file it changed there stops the worker until it is put back,
with the `git restore` or `rm` the refusal names, allowed for those files only. Commands nested
in `bash -c`, `eval`, `$(...)`, `xargs` and `find -exec` are read the same way. Output to
`/dev/null`, a descriptor (`2>&1`) or a path out of any project (the system temp directory)
stays free, and so does a heredoc fed to git (`git commit -F - <<EOF`). The conductor and the
other agents are not held to it.

**The guard refuses a worker another formatter.** `npx prettier` in a project whose `format`
script runs Biome, and a bare `npx biome` (without `--no`: it can run an unrelated package of the
registry named biome, which formats nothing), are refused with "format with `npm run format`
only, then `npm run lint:fix`".

**The guard reads a dependency change wherever its flags stand.** `npm i -D zod`,
`npm install --save-dev zod`, `pnpm add -D zod`, `yarn add --dev zod`, `npm i zod@1 --save-exact`
are refused to a worker like `npm i zod`; `npm ci`, `npm install` and
`pnpm install --frozen-lockfile` stay free. At session start, a worktree whose `package.json`
already lists the kit but has no `node_modules` is told to run the clean install, not to install
the kit.

**Format, then lint.** The briefing of a worker, the `context-builder` agent and the `quality-gate`
and `clean-code` skills say `npm run format`, then `npm run lint:fix`: when Biome wraps a long
line, the lint then asks for a blank line around it, and that finding is expected.

**A new project has no warning on its first commit.** The `vitest.config.ts` that `init` writes
declared its two projects inside the function of `defineConfig`, 32 lines long against the limit
of 30 of `clean/function-size`. They are constants of the file now.

To move:

- add `lefthook: node_modules/.bin/lefthook` at the top of `lefthook.yml` (or
  `npx ddd-ts-kit init --force` writes the kit's file over yours), then `npm run hooks:install`
  once per clone; `npx ddd-ts-kit doctor` says whether it is done;
- `worker-scope` now installs the dependencies of a new worktree: drop an `npm ci` you ran after
  it, or pass `--no-install` to keep doing it yourself;
- optional: the `vitest.config.ts` of a project generated before can take the same shape
  (`npm run lint` warns `ddd-ts-kit/clean-function-size` on it while it is over the limit).

**`cited` reports the names of a row's design that the trunk removed or renamed.** The design of
a row is its `Slice` and `Start with` cells and its rule lines in `slices.md`, the section of a
document of `docs/architecture/` whose heading names the row, and a document that names it or that
its rule line links to (by convention a design review in `docs/architecture/reviews/<topic>.md`,
one `## #<id> <slice>` heading per row). `npx ddd-ts-kit cited [<context>] [--rows <id,...>]
[--base <ref>]` reads the names it cites as code (paths, classes, `Class.member`) against the
ref, from git, and reports only what has evidence: a name its history removed, with the commit and
what replaced it (the file it was renamed to, a file the same commit added); a place the canonical
tree refuses; a name never there when a close name of the same part (a port for a service) arrived
after the line was written. A planned name stays silent, and so does a name whose sentence says
it was removed. `--removed-since <ref>` lists instead the names a change removes that such a
design still cites. It reads only and exits 0; `init` allows `npx ddd-ts-kit cited *` to agents.

**`worker-scope` and `verify-slice` read the design of the rows.** The briefing names, under each
row, the documents of its design, then the names the base does not have (eight lines at most,
the rest in `--json` under `citations`), and the conductor gets a note naming the lines to correct
on the trunk; a local base behind its upstream and a shallow clone are noted. `verify-slice` ends
with the names the slice removes that the design of a row not done still cites, the worker's own
rows left out: informational, it never fails on them.

**`tree/documented-paths` judges paths written relative to a context.** A path of
`docs/architecture/` that starts with `domain/`, `application/`, `infrastructure/`,
`presentation/` or `published-language/` is judged in every declared context, their extra
directories considered, and reported when every one of them refuses it. The rule stays a warning.

To move: `npx ddd-ts-kit check --rule tree/documented-paths` lists the paths of
`docs/architecture/` the canonical tree refuses, the context-relative ones included: write the
place the code has now. Before building a row designed in a document, run
`npx ddd-ts-kit cited --rows <id> --base origin/main`, and correct the names it reports on the
trunk. `npx ddd-ts-kit init` (or `doctor`) adds the permission of `cited` to the agent settings.

**`verify-merge` reports the lines, rows and tests a merge lost.** `npx ddd-ts-kit verify-merge`
reads git only and checks every merge commit since the trunk (the base of
`.ddd-ts-kit/worker.json`, then `origin/HEAD`, then `origin/main`, or `--since`) and the merge in
progress, or one named commit; a squash commit takes `--theirs <branch head>`. It reports as
errors a line one side added (or both kept) that the result lacks, a file neither side deleted
gone from the result, a row of `slices.md` done on one side and no longer done, a test or spec
file of one side gone, a migration whose description the result lacks, a conflict marker. As
warnings: a line one side removed and the merge brought back; a line one side wrote where the
other side changed the same lines, inside a block it deleted or in a file it deleted (the merge
chose between them); a line the merge replaced by lines of its own. A line laid out again, moved
to another file or an import merged into one statement is not a loss; derived files, files a
tool says it wrote, migrations and lockfiles are left out of the lines. The base is `--base`,
else a `Merge-Base:` trailer, else `git merge-base`; a `Lost-Accepted: <file:line>,...` trailer
records a removal decided on purpose, listed without failing, and a loss a later commit restored
is listed as repaired. Silent and exit 0 without a merge, exit 1 on an error, `--json` for data.

**`verify-merge` reaches projects as a warning first.** It is an estimate: on 150 merges that
resolved conflicts in three public projects, one in five still reported an error, most of them a
change of one branch dropped on purpose because the other branch had replaced the feature. So in
this version `--warn` prints the same report and exits 0, the pre-push hook of `init` runs
`npx --no -- ddd-ts-kit verify-merge --warn` (lefthook shows its output), and `verify-slice`
reports the merges since `--since` in a step of their own, `merges since <since>`, without
failing the slice. A later minor version makes the hook and `verify-slice` block on an error;
`verify-merge` run alone already exits 1 on one.

**`.ddd-ts-kit/worker.json` records the commit of the base.** `worker-scope` writes `baseCommit`,
the commit the base names when it creates or keeps the worktree, next to `base`, a moving name.
Readers accept a file without it.

**The guard refuses to a sub-agent the commands that take one side of a merge.** `git merge` or
`git pull` with `-X theirs`, `-X ours` or `-s ours`, and `git checkout` or `git restore` with
`--theirs` or `--ours` on a path under the source root or the tests, are refused to a sub-agent
with the way to resolve each hunk and `verify-merge`. A derived file outside the sources
(`openapi/`, the context map) is not judged by this rule: the conductor takes either side and
regenerates, and a worker leaves it to the conductor, its scope ending at its context. The
briefing of `worker-scope`, the parallel-work skill and the `context-builder` agent say the same.

To move: `npx ddd-ts-kit init --force` writes the pre-push job into `lefthook.yml` and the agent
permissions `Bash(npx ddd-ts-kit verify-merge)` and `Bash(npx ddd-ts-kit verify-merge *)`
(`npx ddd-ts-kit doctor` lists what is missing). Read what the hook prints after a merge of the
trunk: each error is a loss to restore, or a decision to record in the merge commit with
`Lost-Accepted:`, before a later version blocks the push on it. A worktree prepared by an older
version has no `baseCommit` until `worker-scope` runs again for it; nothing reads it yet.

**`merge-trunk` brings the trunk into a branch from its own diff, settles what a kit derives and
checks that no line was lost.** `npx ddd-ts-kit merge-trunk` makes one merge commit, never a
rebase. It finds the newest commit of the branch the trunk already holds: a squash merge is
recognised by patch id (derived files, migrations, `slices.md`, `plan.md` and lockfiles left out),
on the branch, on the branch it was stacked on, or on a local branch sharing commits with it;
else the base worker-scope recorded, when its lines are on the trunk; else `git merge-base`
(`--since <commit>` overrides). From there `git merge-tree` computes the merge, so a branch reused
after its first row landed, or stacked on a branch squash-merged since, no longer conflicts on
what landed nor keeps a working migration next to the real one. Derived files, the generated
regions of `CONTEXT.md` and of the context map, conflicts inside generated registries, the rows
of `slices.md`, the drizzle-kit journal, the lockfile and the stored-events lock are settled
without a person; the rest stays a merge in progress git understands, with what each side did in
each hunk (exit 1), and `--continue` goes on. Then the drizzle migrations of both sides are
replayed, decision records renumbered, `regenerate` runs, `verify-merge` checks the uncommitted
result (an error stops it; `--accept-lost` records a `Lost-Accepted:` trailer), and the paths of
the merge alone are committed with the trailers `Merge-Base:`, `Trunk:` and `Landed:`.
`--dry-run` previews, `--abort` undoes. The report says how many files a plain `git merge` would
leave conflicted against the branch's own diff; `--json` gives the same.

**`merge-trunk --to-land` gives the migrations of a branch their real names before its squash
merge.** Under drizzle-kit the replay drops `working-` even in the worktree of a worker; under
knex, Prisma and TypeORM each migration of the branch the trunk does not have is renamed after the
trunk's last, its content kept (TypeORM's class and `name`, Prisma's folder), and the merge stops
when a migration the trunk gained and one of the branch change the same table. The guard of the
plugin refuses `--to-land` to a sub-agent, however it launches the CLI: it is the conductor's step. `plan-waves` ends with what
runs before each merge.

**`status` counts a worker's branch from where it landed.** Once a branch was squash-merged into
its base, `status --workers` shows the commit that took it in (`landed`), counts its commits ahead
and its files from there (no stale count, no false overlap with what landed), and adds its commits
behind and what `merge-trunk` would leave conflicted now (`behind`, `mergePreview`). A row that
landed with a branch is no longer counted on its way, and `status` names a landed row the slices
file of the trunk does not mark done.

**A worker brings the trunk in with `merge-trunk`, never with `git merge` alone.** The briefing of
`worker-scope`, the parallel-work skill, the briefing template and the `context-builder` agent say
so; the guard's refusal of `-X theirs` and `checkout --theirs` points to `merge-trunk --continue`,
and `worker-scope` refusing a worktree that does not contain its base gives the `merge-trunk` that
brings it in.

To move: `npx ddd-ts-kit init --force` (or `doctor`) adds the agent permissions
`Bash(npx ddd-ts-kit merge-trunk)` and `Bash(npx ddd-ts-kit merge-trunk *)`. Bring the trunk into a
branch with `npx ddd-ts-kit merge-trunk` from now on, and run `merge-trunk --to-land --cwd
<worktree>` before each squash merge of a worker's branch. It needs git 2.40; an older git merges
only from `git merge-base`.

## 0.25.1

**The places that teach how a spec builds its test application point to worlds.** The command
handler specs `generate` writes say, in their `TODO(domain)`, that `generate test-world <context>`
writes the arrangement once in `test/worlds/` when several specs of the context share it; the
`wiring` and `use-case` skills, `docs/tools/dependency-injection.md` and the README of
`@ddd-ts-kit/di` say the same where a reader writes that arrangement.

**The example application arranges through worlds.** `identity` and `notification` get their
world, and 42 handler, projection and integration handler specs take their test application from
the world of their context, their starting data in `given`. A spec keeps its own setup when it
builds what a world does not: a database wired by hand, a handler built by hand, a fake with
constructor arguments, a platform port.

Nothing to move: specs already written keep working; a project takes a world when its specs
repeat the same arrangement.

## 0.25.0

**`generate test-world` gives the shared arrangement of a context its place, `test/worlds/`.**
`npx ddd-ts-kit generate test-world <context> [Name]` writes `test/worlds/<name>.world.ts`, the
name defaulting to the context: `a<Name>World({ now, idPrefix, given })` reads the fakes of
`test/fakes/` and the port each one implements, builds them, hands them to `given` so that a spec
stores what it starts from, then to the test application (`modules` adds the authorization of the
spec) or, wired by hand, to the buses of `createTestBuses`, each repository wrapped by
`dispatching`; it returns every fake under the name of its port. A fake that needs constructor
arguments, or, under a container, the fake of a port nothing binds or depends on yet, is left out
with a note. `test/worlds/` (`*.world.ts`) joins the canonical tree; `list` and `describe` name
the worlds of each context, and the import graph (rewritten by the next `generate`) and the knip
config of a new project keep a world no spec imports yet, as they keep a fake.
The identity preset writes its shared arrangement in `test/worlds/<context>.world.ts`, and three
handler specs of the example application use the world of `scheduling`.

**`test/helper-placed` (a warning).** A `.ts` file of a context's `test/unit/` or
`test/integration/` that is not a spec (`*.spec.ts`, `*.test.ts`) is reported: an arrangement
several specs share goes to `test/worlds/`, test data to `test/builders/`, an in-memory port to
`test/fakes/`.

To move: `npx ddd-ts-kit check --rule test/helper-placed` lists the helpers written among the
specs; move each to its place, or replace a shared arrange function by the world `generate
test-world` writes. A project created by the identity preset moves
`test/unit/identity-application.ts` to `test/worlds/<context>.world.ts` and updates the imports of
its specs.

## 0.24.0

**`plan-waves` orders the work, and `status` says when a row can start.** `npx ddd-ts-kit
plan-waves [<context>]` reads the rows of `slices.md` not done and gives waves (the rows whose
dependencies are done, then the rows waiting only for earlier waves), batches of one or two rows
per owner, the batches of one context and one wave that touch the same aggregate, the
`worker-scope` command that briefs each batch, and a merge order. A cycle, an unknown dependency,
a row without owner or an id used twice is reported alone. `status` gives each row not done its
readiness: on the trunk, on a branch (its dependencies are rows of a worker whose worktree has
commits), or waiting, with what it waits for.

**`drizzle-generate` formats, warns and replays.** After a migration, it formats the files it wrote
under `meta/` with the formatter the `format` script names (Biome or Prettier), and warns when the
SQL changes a primary key in an order PostgreSQL refuses. `npx ddd-ts-kit drizzle-generate --replay
[--base <ref>]`, run on a branch after merging the trunk, deletes the branch's migrations the base
does not have and generates them again on top of the trunk's last snapshot, with their names; the
`persistence` and `parallel-work` skills use it at the merge. It is Drizzle's only.

**Each spec opens a copy of a started test database.** With Vitest on an ORM, a global setup starts
PGlite once and saves it; every integration spec opens a copy and creates its tables there, so the
slow start is paid once per run and the code that creates the tables still counts in the coverage
of each context. `settled()` of `@ddd-ts-kit/testing/e2e`,
and `application.settled()` of the generated end-to-end support, wait until the outbox has nothing
pending instead of a fixed delay, and fail with what is still pending.

**`tree/documented-paths` (a warning).** A path of a context cited as code in a Markdown file of
`docs/architecture/` is judged as `tree/closed` judges a file: a plan, a design note or a review
that names a directory the canonical tree refuses describes a design the code no longer has. A path
that does not exist yet is not reported.

To move: `npx ddd-ts-kit check` reports, as a warning, the paths of `docs/architecture/` the tree
refuses: write the place the code has now. To take the test database template in an existing
project, regenerate `vitest.config.ts`, `vitest.e2e.config.ts`,
`src/platform/database/open-test-database.ts` and `test/e2e/support/start-application.ts`
(`npx ddd-ts-kit init --force`, which rewrites every file of the platform); plain `npx ddd-ts-kit
init` adds the setup file and the rest keeps working as before.

## 0.23.1

**`verify-slice` proposes to stage the paths of the slice only.** In 0.23.0 it listed every path
`git status` reported in the repository as the paths to commit: a file of another context or of
the platform, an editor's folder, notes or a document left at the root of a shared checkout. The
list is now closed: the files of the context, an end-to-end spec of `test/e2e/`, a working
migration with its snapshot and the journal, and the derived files `regenerate` rewrites when git
already tracks them. Every other changed path is listed as left out, never to stage with the
slice; `--json` gives `toStage` and `leftOut`. The briefing and the `context-builder` agent say
that a path left out is never staged nor deleted. Upgrade from 0.23.0 now.

**`doctor` lists what an upgrade left to do.** `npx ddd-ts-kit doctor` compares the project with
what the installed version writes: the scripts of `package.json` (missing, or written otherwise),
the packages of the kit (missing, or at another range) and the permissions of
`.claude/settings.json` (missing). `npx ddd-ts-kit init` adds what is missing and leaves what the
project wrote. `--strict` exits 1 while something is missing. The version gap the plugin says at
session start points to it.

**`clean/function-size` does not count one parameter typed `Actor` or `Date`.** Who acts and when
are the context of an intention rather than its input: `invoice.issue(lines, customer, actor,
now)` counts three. The rule reports less, never more.

## 0.23.0

**A domain event declares its name once, with `NamedDomainEvent`.** `export class InvoiceIssued
extends NamedDomainEvent('billing.invoice.issued') { .. }` gives the class `eventName` and each
instance `name`, both typed with the literal, in place of the two lines `static readonly eventName`
and `readonly name = X.eventName`. The generators and the identity preset write it; the rules and
generators that read an event's name recognise it. The former form stays accepted.

**`verify-slice` closes a slice in one run.** `npx ddd-ts-kit verify-slice <context> --since
<trunk>` runs the `regenerate` script, the architecture rules on the files changed since the trunk
(new files included) and the `test` script for the context, then names the changed files past 300
of the 350 lines and the paths to stage, one by one. Every step runs, so one answer says all that is
left; it exits 1 while a step fails. The briefing of `worker-scope` and the `context-builder` agent
use it in place of three commands. It needs the `regenerate` script of 0.21: run
`npx ddd-ts-kit init --force` if it is missing.

**`status --workers` shows who builds what.** For each git worktree that `worker-scope` prepared:
its branch, context, rows, base, commits ahead, the files it changed and its report; then the files
more than one worker changed, where the second merge will conflict. `worker-scope` now writes the
rows, the base and the branch in `.ddd-ts-kit/worker.json`. `parallel-work` has the conductor run
it before briefing a second worker in a context and before each merge, and says how a stacked
branch moves its own commits onto the trunk after a squash merge.

**A non-blocking review remark is a `TODO(review)` marker.** `architecture-reviewer` sorts its
findings into blocking and non-blocking, and gives each non-blocking one its `file:line` and the
marker line to write there. `todo` lists `TODO(review)`, `status` counts it per context. A slice
may merge with such markers; a story or a milestone is closed when none is left, each handled or
dismissed by a decision record.

**Slices are numbered within their story.** `plan-slices` gives each row the code of its story or
milestone and a number within it (`US5.03`, `M2.07`), never one sequence across stories, and an id
is never renumbered. `status` names a bare number. A rule line under the slices tables may omit the
`#` (`- 5.01: ..`): `worker-scope` reads it. A slice that changes a behaviour already delivered
adapts its tests in the same row. The example application numbers its rows `M1.01` to `M1.39`.

**The briefing of a worker says what blocks.** A worker marks each need of its report blocking (a
migration, a contract field, a shared file, a dependency) or a note for the merge, and the run goes
on for a note. It records a decision of its own slices with `generate adr` (without `--deviation`,
which stays the conductor's), formats with `npm run format` only, and is done when `npm run verify`
passes on the whole tree. The conductor merges the trunk into a branch before its review and
`verify`. Only the conductor prepares a worktree: the guard refuses `worker-scope` without
`--dry-run` to a sub-agent.

**`check --changed-since` judges the new files.** A file git does not track yet, as a generator
just wrote it, was left out until it was staged; it is judged now.

**`clean/file-size` judges `test/` and `scripts/`, and tells an aggregate how to shrink.**
`ddd-ts-kit check` now holds the end-to-end specs and the scripts to the 350 lines, as the ESLint
rule already did in the lint gate. For an aggregate past the limit, the fix names a domain service
that returns the new state and its events, which the aggregate applies, or a value object; never a
public setter.

**`language/declared-vocabulary` leaves the storage names alone.** In `infrastructure/persistence/`,
the name of a column, a table or a schema (the first argument of a call, `name`, `tableName`,
`schema`) is no longer taken for a value of a vocabulary; a stored value (`.default(..)`, a value
compared in a query) still is.

To move: run `npx ddd-ts-kit init --force`, which adds the `regenerate` script when it is missing
and allows `verify-slice` to agents in `.claude/settings.json`; run
`npx ddd-ts-kit check` once and split each file of `test/` or `scripts/` it reports past 350 lines
(the lint gate already refused them).

## 0.22.0

**A context builder keeps its report current and regenerates with each slice.** The
`context-builder` agent has 150 turns instead of 80, and after each step of a slice it rewrites
`.ddd-ts-kit/report.md` in its worktree, in the form of its final report: an agent that stops
early leaves its state there, and `parallel-work` tells the conductor to read it. The guard lets a
worker write that one file. After each slice the worker runs `npm run regenerate` and commits the
derived files with it, as the briefing of `worker-scope` now says: they were left to the conductor,
so a worker stopped on "regenerate" and the run stopped with it. The agent never shortens a
comment, a test or a written rule to stay under a size limit: it extracts instead.

**`generate event-handler` and `generate integration-handler` take `--name <Name>`.** A reaction
was named after the event it handles; when the design names it after what it does in its context,
`--name` gives that name to the file, the class, the spec and the registration, and for an
integration handler to its consumer name and its system actor. The name passes the same checks
as any concept of the context (`--term`, `--allow-name`). Without it, nothing changes.

**`clean/function-size` names the fix.** More than three parameters: group them in a typed props
object or a value object (`Invoice.draft({ ... })`), never a fourth parameter. A `describe`
past the 100-line ceiling: one top-level `describe` per behaviour, in the same file. The ESLint
rule no longer takes production code such as `context.run(callback)` for a group of tests: such a
callback is now held to the limit of a function, and may be reported where it was not.

## 0.21.0

**A rule can be set for some files only, and a rule off everywhere is said.** `rules.<id>` in
`ddd-ts-kit.config.json` also takes `{ "severity": "error" | "warn" | "off", "files": ["<glob>"] }`:
a finding on a matching file takes that severity, every other file keeps the one of the project.
The ESLint preset applies the same setting to the same files. A lowered setting still needs its
`deviations` entry. The new rule `config/rule-off-everywhere` (a warning) reports a bare `"off"`,
which hides every finding of the rule and not only the ones its exception was about. To move,
narrow each reported rule to the files it is about, or write `"files": ["**"]` when the whole
project is meant.

**The generated barrel of a context is not judged by `clean/file-size`.** `<context>.declarations.ts`
and `<context>.dependencies.ts`, at the root of their context, are written by the kit and may grow
past 350 lines; a project no longer has to turn the rule off for them. A file of the same name
elsewhere is still judged. To move, remove an exception you wrote for them.

**`worker-scope` briefs one batch, from a checked base.** `--base <ref>` cuts the worktree from
that ref (`origin/main`) and gives it as the trunk of the checks; `--rows <id,...>` limits the
briefing to those rows of `slices.md`, in that order. Without `--base`, the command refuses to run
from a worker's worktree, and an existing worktree or branch that does not contain the base is
refused with the fix. The `rules:` of a row is filled from the line of rules that `plan-slices`
writes under the table. The `context-builder` agent takes one or two rows, keeps its last turns for
its report and never ends without it; `architecture-reviewer` keeps turns for its verdict.

**A worker may generate a working migration.** `npm run db:generate working-<what>` in a worker's
worktree is allowed by the guard, and `persistence/migration-history` accepts it there, so a branch
that changes the stored state is green alone. On the trunk the same file is reported: at the merge
the conductor deletes it and generates the real one (`parallel-work`, merge step). Any other
migration stays refused to a worker.

**`db:generate` under drizzle-kit no longer waits or pretends.** Without a terminal, drizzle-kit
refused its rename question, wrote no migration and exited 0; under a pseudo-terminal it waited
for an answer. `db:generate` is now `ddd-ts-kit drizzle-generate --name`: in a terminal it is
`drizzle-kit generate` as before; without one, those two silent failures exit 2 with the fix (split
the rename, or write a custom migration). To move, in a Drizzle project, set the `db:generate`
script to `ddd-ts-kit drizzle-generate --name`, or run `npx ddd-ts-kit init --force`.

**One `regenerate` script for every derived file.** `npm run regenerate` runs
`ddd-ts-kit depcruise-config --write` then `npm run docs:generate` (the context documents, the
barrels, the OpenAPI and event documents, the clients): the one step after a change of route,
schema, event or config. To move, run `npx ddd-ts-kit init --force` after the upgrade, which adds
the script and allows it to agents.

**`generate adr` takes `--number <n>`.** A team that numbers its decision records by block
(`0401` for one story, `0701` for another) chooses the number instead of taking the highest plus
one. The number goes to the file, the `# ADR-NNNN` title and the `deviations` entry; a number
already taken, or one that is not a number, is refused.

**Where a shared type, a pure function and a strategy live in the domain.** `docs/ARCHITECTURE.md`
says it, with no new directory: a side-effect-free function on one value is a method of that value
object, a computation over several is a domain service, a shape of business data is a value object,
an interchangeable rule is an abstract class of `domain/services/` with its implementations.
`test/spec-required` no longer asks a spec of a file that exports abstract classes only; each
implementation keeps its own.

**The integration specs of a generated project give the test database a minute to open.** Their
hooks had the default 10 seconds of Vitest, which opening PGlite outlasted under coverage on a busy
machine. To move, add `hookTimeout: 60_000` to the `integration` project of `vitest.config.ts`, or
run `npx ddd-ts-kit init --force`.

## 0.20.0

**A permission no role holds is said.** In a project whose rights are roles (`stack.authz`
`rbac`), `authz/granted` (`ddd-ts-kit check`) reports each permission a context declares that no
role names in `platform/auth/roles.ts`, nor `platform/auth/signed-in-grants.ts`: the super-admin
`*` was the only one to reach it, so the checks stayed green and every other person was refused
at run time. It is a warning: `check` does not fail on it. A grant counts by the entry of the set
(`billingPermissions['invoice.issue']`), by the id (`'billing:invoice.issue'`) or by the wildcard
of the context (`'billing:*'`); a grant to `Role.System`, written by `generate job`, counts too.
The rule is silent under attributes, relationships or an authorizer of the project's own.

**`generate command`, `query` and `file-upload` take `--grant <role>`.** With `--permission`, it
writes the grant in `platform/auth/roles.ts` and adds the role to `platform/auth/role.ts` when it
is new. It is refused with `--public`, and when the rights are not roles. Without it, a `next`
step points at the roles to edit. `init --force` writes the roles from their template again, and
the warning names the grants to give back. To move, run `ddd-ts-kit check --rule authz/granted`
and grant each permission it lists to the roles that hold it, by the entry of its set, in
`roles.ts`; a permission meant for administrators only is granted to `Role.Admin` by name. A
context worker never passes `--grant` (`--local-only` refuses it): the conductor grants on the
trunk.

## 0.19.0

**`status` and `worker-scope` read every slices table.** `docs/architecture/slices.md` may plan
the work in several tables, one per milestone or story, under the same header: only the first was
read, so `status` counted a part of the plan and a worker started on a later table got an empty
briefing. Every table is now read, in the order of the file, and `status` names a row number that
more than one row carries (`duplicates` in `--json`).

**The notes travel with the CLI, and a version gap is said.** The `ddd-ts-kit` package ships this
file, so an agent finds the steps of a version in `node_modules/ddd-ts-kit/CHANGELOG.md`, offline.
The plugin states the version of the packages its skills describe: when the installed
`ddd-ts-kit` is another one (below 1.0.0, another minor version), the session start says so and
what to do, upgrade the packages together or update the plugin. It never blocks.

**Every domain event declares its name once, consumed or not.** `events/name-declared-once`
(`ddd-ts-kit check`) reports a class of `domain/events/` without `static readonly eventName`, and
one whose `readonly name` writes the name again instead of reading it. Until now an event that no
handler or projection reacted to could keep the form 0.5 wrote, `readonly name = '..'` alone, and
the first reaction attached to it failed to compile. To move, give each reported class
`static readonly eventName = '<context>.<aggregate>.<fact>'` and `readonly name = <Event>.eventName`.

## 0.18.0

**The tenant check of `RoleBasedAuthorizer` follows memberships and the tenant of the work.**
With `tenantOf`, an actor of several tenants (its `tenants`, from a list claim or the
`organization` claim of Keycloak) was refused in each of its own tenants and listed nothing, and
a system actor of a per-tenant job was refused in the tenant it ran for. The guard of the bus and
`PolicyAccess` now give the authorizer the tenant of the work (`workTenantId` on `CheckRequest`
and `ListRequest`), read from the execution scope that `authorizationModule` wires. A request is
refused when the actor does not belong to the tenant it targets, when that target is not a tenant
id, and when it is another tenant than the one the work runs in; a system actor belongs to the
tenant its work runs in. A list is filtered on the tenant of the work, and is empty for an actor
of several tenants outside of a tenant's work. `RoleBasedAuthorizer` now refuses at construction
a cross-tenant role or a system role that no role declares, and `crossTenantRoles` without
`tenantOf`: each silently did nothing. To move, declare the role named by `systemRole` or
`crossTenantRoles` in `roles`, and give `tenantOf: tenantOfContext` where `crossTenantRoles` is
set. `authorizationMiddleware` and `PolicyAccess` built by hand take the `scope` option to do the
same.

**A policy is asked, or the use case fails.** The bus decides the permission of a use case before
its handler runs, with the identifier of the element at most; a policy, the part of the right
that needs the element, applies only when the handler asks `Access` once the element is loaded.
Forgetting to ask is now caught twice. `authz/policy-asked` (`ddd-ts-kit check`) reports the
handler of a command or query whose permission a policy refines (`@Policy` or `definePolicy`)
when it never asks `Access` about that permission. At run time, `authorizationModule` refuses the
result of such a handler with `PolicyNotAskedError`, inside the unit of work, so that its change
is rolled back: the guard gains a step that wraps the handler alone, `UseCaseGuard.within`, which
the buses of `kernelModule()` run with `aroundHandler`, a new method of the in-process buses that
places a middleware right around the handler, inside every other one: a middleware that answers
in place of the handler, as a spec that records the commands a job sends, is not judged. Without
the container, `policiesAskedMiddleware({ map, refined })` is the same check. The generators
follow: a command or a plain query generated once a policy refines its permission receives
`Access` and asks it, about the message until the element is loaded, with a `TODO(domain)` to
ask about that element instead; `generate policy` writes a use case of its permission again that
way when its files are still as generated, and otherwise leaves a `TODO(domain)` where the policy
is asked, which the rule accepts and `ddd-ts-kit todo` lists.

To move: a handler whose permission a policy refines calls `await this.access.authorize(actor,
permission, element)` before its change; `npx ddd-ts-kit check --rule authz/policy-asked` lists
the ones that do not. A project that binds its own `Access` instead of `PolicyAccess` passes
`policiesAsked: false` to `authorizationModule`, since only `PolicyAccess` records the questions.
A bus of your own, given through `kernelModule({ commandBus })`, runs `UseCaseGuard.within` with
`aroundHandler`.

**A domain event handler names its event once.** `@DomainEventHandler` and `@On` no longer take
the name of the event: they read the one its class declares, `static readonly eventName`. A
handler is now `@DomainEventHandler(InvoiceIssued)`, `@DomainEventHandler(InvoiceIssued, { phase:
'after-commit' })` or, with a dependency list, `@DomainEventHandler(InvoiceIssued, [Mailer])`; a
method of a projection applies a domain event with `@On(AppointmentBooked)`, as it already did an
integration event. The compiler refuses an event class without a `static readonly eventName`, or
one that declares it empty, and the decorator refuses at declaration a name that is empty when it
is read. `NamedDomainEventType` (`@ddd-ts-kit/kernel/declarations`) is the type of such a class.
Since a handler can no longer be written under another name than the one its event carries,
`declarations/role-declared` (in `ddd-ts-kit check` and `@ddd-ts-kit/eslint-plugin`) no longer
judges that name. In the declared style, `generate event-handler` and `generate integration-event`
refuse an event class that does not declare its name, and say the two lines to write.
`@IntegrationEventHandler(definition, { consumer })` is unchanged: the consumer name is the
identity of the handler, not of the event.

To move:

1. give every domain event class that declares only `readonly name = '..'` its
   `static readonly eventName = '..'` and `readonly name = <Event>.eventName` (the classes
   generated since 0.7 already have them);
2. remove `name: ..` from the options of `@DomainEventHandler` and `@On`, and the options object
   when nothing is left in it: `@DomainEventHandler(X, { name: X.eventName })` becomes
   `@DomainEventHandler(X)`, `@DomainEventHandler(X, { name: X.eventName }, [Mailer])` becomes
   `@DomainEventHandler(X, [Mailer])`;
3. `npx tsc --noEmit` lists what is left.

**A quieter, more legible documentation website.** The site takes the pine green of the domain
layer of its diagrams as its accent instead of the default blue, cool slate greys, and IBM Plex
Sans and Plex Mono served with the site (no request to a font service). Headings, links, tables,
inline code, the current page of the sidebar and the cards of the home page are restyled; keyboard
focus stays visible and reduced motion is respected.

**Codex and GitHub Copilot, beside Claude Code.** `init` writes the guide of the project in
`AGENTS.md`, which Codex, Copilot and most coding agents read, and `CLAUDE.md` imports it; a
project initialised before keeps its `CLAUDE.md`, and `ddd-ts-kit sdk` writes in whichever of the
two it has. The rules by layer of `.claude/rules/` are also written for Copilot in
`.github/instructions/<layer>.instructions.md`, scoped by `applyTo`;
`.github/copilot/settings.json` declares the plugin of the kit, which the Copilot cloud agent
installs and VS Code recommends; with `--ci github`, `copilot-setup-steps.yml` installs the
project before the cloud agent starts. The plugin installs in Codex
(`codex plugin marketplace add gbourgeat/ddd-ts-kit`, from `.agents/plugins/marketplace.json`)
and in the Copilot CLI (`copilot plugin marketplace add gbourgeat/ddd-ts-kit`). Its guard reads
the patches of Codex and the tool calls of Copilot: a hand-written file of a generated role is
refused there as in Claude Code, and a stop with architecture errors is refused once per session
on a host that does not say it already was. Codex cannot ask the user, so a suppression or a
change of the rules is announced there instead of put to the project owner. The agent
configuration of Copilot and of Codex joins the files whose change the guard puts to the owner.

## 0.17.0

**Names of the business, never `target`.** The command handler templates named the aggregate
they load or build `target`, and every project generated from them inherited the word. A
generated handler now names it after its concept, `const invoice = Invoice.create(..)`, and a
generated search names its lines after what it searches (`invoice`, `invoices`, never `item`).
A new rule, `naming/business-name`, held by `ddd-ts-kit check` and by `@ddd-ts-kit/eslint-plugin`
(`ddd-ts-kit/naming-business-name`), reports a variable, a loop variable, a destructured binding,
a parameter or a property of `domain/`, `application/` and the shared kernel named `target`,
`targets`, `data`, `item`, `items`, `obj`, `object`, `thing`, `things`, `stuff`, `info`,
`element`, `el`, `tmp`, `temp`, `foo`, `bar` or `baz`. ESLint fixes what it can name: a variable
built by `X.create(..)` or `new X(..)`, read from a repository (by the type of the call when the
parser has types, as the presets give it, by `xRepository.findById(..)` otherwise), or both
(`found ?? X.create(..)`) is renamed with every use to the camel name of the concept, unless that
name is taken; a loop variable is reported with the singular of its collection. The list is
`businessNames` of the config (`{ "words": [..], "allow": [..] }`), which the `words` and `allow`
options of the ESLint rule come over. `ddd-ts-kit explain naming/business-name` gives the reason
and both forms; the clean code and ubiquitous language pages say why `target`, `data` and `item`
hide the language.

The rule is on in every project, new or existing: a config without `businessNames` reads the
default list. To move:

1. `npx eslint . --fix` renames the bindings whose initializer names the concept (in the example
   application, 23 of 27);
2. `npx eslint .` and `npx ddd-ts-kit check` list what is left, each message with the name to
   write when the code says it (a loop variable, the result of a domain service): rename them;
3. a word that is the term of your business (`item` of a catalogue, `object` of a relationship
   model) goes in `businessNames.allow` of the config.

**The documentation is a website.** Every page of the documentation, the README of every package,
the page of every ESLint rule and the documents of the example are published at
<https://gbourgeat.github.io/ddd-ts-kit/>, in English and in French under `/fr/`, with search,
a sidebar that follows the reading path of the concepts, a dark theme and the diagrams of the
pages. The Markdown files of the repository stay the only source: `site/` assembles them at each
build (a private workspace, never published), `npm run site:dev` previews it, and the site is
deployed to GitHub Pages from `main`. A link or an anchor that leads nowhere fails its build,
which the CI runs on every pull request that touches the documentation.

## 0.16.1

**The documentation is in French too.** Every reader-facing page of the repository (the root
pages, `docs/`, the README of every package, the page of every ESLint rule and the docs of the
example) has a French translation next to it, `X.fr.md`, reached by a switcher on its first
line; start at `README.fr.md` or `docs/README.fr.md`. A French page records the version of the
English page it translates, so a change to the English page without its translation is
reported. Release notes, agent instructions (`CLAUDE.md`, `.claude/`, `plugin/`), generated
files and the partly generated `CONTEXT.md` stay in English only.

**The pages teach with diagrams and samples that compile.** The concepts, guides, tools pages,
package READMEs and the example docs are enriched with worked examples and hand-written SVG
diagrams (one English and one French drawing each, readable in dark mode and on npm). A
TypeScript block marked `<!-- checked sample -->` is compiled against the packages of the
workspace, in both languages, so a sample cannot drift from the API; several samples that no
longer matched the API were corrected on the way.

**Two new checks.** `npm run docs:translations` (in `ci:docs`) reports a page without its
switcher, a missing or stale French page, a link or anchor that leads nowhere, a French page
that links to an English page whose French sibling exists, and a diagram without its French
drawing or malformed. `npm run docs:samples` (in `ci:typecheck`) compiles every checked sample.
[docs/translation.md](docs/translation.md) says what is translated, the shape of a French page,
the glossary, the style of the diagrams and how to keep it all current.

## 0.16.0

**A new project writes its values as classes, and the kit checks it.** `init` writes
`"stack.values": "classes"` (`--values classes|free`), under which a new rule,
`domain/value-object-class`, held by `ddd-ts-kit check` and by `@ddd-ts-kit/eslint-plugin`
(`ddd-ts-kit/domain-value-object-class`), judges the model. A file of `domain/value-objects/` (or
a `*.vo.ts` of the shared kernel) exports exactly one class extending `ValueObject`, directly or
through another value object of the project, with a private or protected constructor and static
factories, and no function, arrow constant or object literal, inline, by an export list or by
default; the types of its props may sit next to it. In `domain/` and in the shared kernel outside
`presentation/`, an exported function that answers a record of data,
`export const money = (amount, currency) => ({ amount, currency })`, is reported with the command
that writes the class (`npx ddd-ts-kit generate value-object`): an object is a record of data when
it holds data (a literal, a parameter, a call of the language), no spread and nothing a call or
`new` of the model built. A domain service, a state machine, a specification answering a boolean
or functions only, a record of value objects the function builds, a reducer that spreads its state
and a function declaring a return type of a package are not concerned; a decision answered as a
plain record is. `ddd-ts-kit explain domain/value-object-class` gives the reason and both forms.

A config without the key reads as `free`: an existing project upgrades without a change, and
nothing is reported. To move: set `"stack.values": "classes"`, run
`npx ddd-ts-kit check --rule domain/value-object-class` and ESLint, write each reported value as a
class with `generate value-object` (its checks in the static factory, its helpers as methods, its
callers on `Money.of(..)` and `equals`), make each reported constructor private and add the
factory the rule names. The steps are in `docs/CONFIG.md`; until they are done, the rule can stay
at `warn` under `rules`, recorded in `deviations`.

**The text checker reads a class whose heritage holds an object type.** `class Money extends
ValueObject<{ readonly cents: number }> {` was read as a class whose body was the object type:
its methods and constructor are now found, for every rule that reads them.

**Why a value object is a class.** `docs/concepts/entities-and-value-objects.md` explains it with
three diagrams (the two forms, what the rule reads, how an answered object is read entry by
entry) and both forms side by side: equality without identity, invariants checked once in
the factory, behaviour next to the data, refusals from static factories, immutability and
`instanceof` in the boundary mappers. The domain rules `init` writes and the `scaffold` and
`clean-code` skills say the same.

**The example models its values as classes.** In the analytics context, the outcome the occupancy
measure reads and the figures it answers are value objects, `MeasuredOutcome` and
`OccupancyFigures`, each with its spec. Each checks its rules in its factory: an outcome never
ends before it starts, figures are whole numbers, none below zero, with at least as many
appointments held as completed and missed ones, refused through `OccupancyError`.
`CalendarDesk` and `FreedSlot` stay parameter objects: they group the arguments of one factory,
and `FreedSlot` holds a `Calendar`, an entity no equality by value can compare.

## 0.15.0

**A context written whole: the identity preset** ([Bootstrap with well-designed contexts](docs/guides/bootstrap-with-well-designed-contexts.md)).

- `init --preset identity` and `generate context <name> --preset identity` write a generic
  context instead of an empty one: accounts provisioned from the identity provider at the first
  sign-in (no password kept), organisations (the tenants under `--tenancy shared-table`, their
  tables then under a decision record), members with roles of a declared vocabulary, invitations
  by token with an expiry, delegations of rights for ninety days at most; seven policies, the
  published language (`member.joined`, `member.role-changed`, `account.deactivated`...), a
  search, controllers, specs with builders and fakes, the Knex or Drizzle adapters, and the port
  `IdentityProviderAdmin`, kept in line at least once by consumers of the published facts, with a
  Keycloak 26 adapter given as a recipe (run once by hand against Keycloak 26.8.0, not in the
  pipeline). Nobody changes their own role or acts above it, whatever
  a delegation lends, and a change decided under a delegation names it (`delegationId`); every
  change of a member saves its organisation, so two owners who remove each other at once cannot
  both commit; a deactivated account leaves its organisations; an address the provider did not
  verify (`email_verified`) provisions no account. With tenants and Keycloak, the authenticator
  reads the `organization` claim as the tenants of the person. Written for the declared style on
  Knex or Drizzle on PostgreSQL, Zod or class-validator, Express or Fastify, with a token
  verifier, and for both `stack.schemas`: shared, its identifier answers are `acceptedSchema` and
  the token of an invitation one shared schema; per route, each route keeps its own; another stack is refused with the flag to change, and so is a second context of the
  same preset. Nothing is recorded in the config. Which other contexts deserve one:
  [Context presets](docs/proposals/context-presets.md).
- `@ddd-ts-kit/auth`: `SignedInGrantsAuthorizer({ grants, otherwise })` grants every signed-in
  person (an actor of type `user`) the same permissions before the model of the project decides
  the rest, whatever that model is. The preset wraps `createAuthorizer` in it, its grants in
  `platform/auth/signed-in-grants.ts`.
- `@ddd-ts-kit/auth`: the default mappings of `JwtAuthenticator` and `keycloakAuthenticator` read
  a tenant claim that lists several tenants (the `organization` claim of a member of several
  organizations) as the `tenants` attribute of the actor, among which a request names one, where
  they gave no tenant; and both give the attributes `username`, `email` and `emailVerified`
  (`email_verified`), where `JwtAuthenticator` gave none.
- The barrels and dependency files the CLI writes set a call that takes several lines apart by
  blank lines, as `@stylistic/padding-line-between-statements` asks.
- Plugin 0.22.0: the skill `bootstrap` proposes the preset for a generic identity context.

**The example serves several networks of practices, one tenant each** (its ADR-0003, accepted).

- `@ddd-ts-kit/knex`: `addTenantColumn(knex, { schema, table, tenantOfExistingRows })`, the
  migration of a table of a project that becomes multi-tenant: the rows already there go to the
  tenant named (refused when there are rows and none), then the column is required and indexed; a
  table that has the column is left alone. `derivedTable(context, query, alias)` selects from a
  query confined by `tenantTable`, for a measure grouped then paged by its output columns.
- `@ddd-ts-kit/knex`: `addOutboxTenantColumn(knex, { schema, tenantOfUnpublished })` gives the
  events not published yet (pending or dead) the tenant the database served, so that their
  consumers run in it.
- `@ddd-ts-kit/http`: `servedTenantOf(resolver, served)` answers 404 to a tenant the deployment
  does not serve, whoever names it, and reads the headers its resolver reads, so that a cached
  answer still varies on them.
- `@ddd-ts-kit/knex`: `createProcessTable(knex, { tenant: true })` adds `tenant_id` to the
  instances of the process managers, and `KnexProcessStore(context, { tenant: scope })` keeps each
  one in the tenant of the work that saves it: an instance of another tenant is neither found nor
  changed, and work that names no tenant is refused (`NoCurrentTenantError`).
- `@ddd-ts-kit/di`: `kernelModule({ tenants })` binds a `TenantDirectory` and gives it to the
  default scheduler, so that a job declared `tenancy: 'per-tenant'` can be registered; the test
  application takes `tenants` too, by default the tenant of its execution context, and composes
  with none named (such a job then runs for no tenant), where it refused the job before.
- `tenancy/scoped-statement` reads the literal text of a raw call: a statement of the schema with
  no word of rows, and an expression that holds no word reading or writing rows or starting a
  statement (`table`, `with`, `values`, `call`, `do`...) and calls only known expression
  functions (aggregates, casts, arithmetic, text), are no longer reported; raw SQL whose text is
  not a literal, or a template that interpolates, still is. Bind a list as one value
  (`state = any(?)`) instead of interpolating its placeholders.
- Plugin 0.22.0: the guard lets `test/e2e/journey-*.e2e.spec.ts` be written by hand, since a
  journey crosses several routes and no generator writes it.
- Example: `"stack.tenancy": "shared-table"`, a tenant column on its twelve tables and the
  migration that adds it to an existing database, `tenantIsolationContract` on every Knex
  repository, the jobs run per network (`NETWORKS`), the audit trail read by platform staff
  through a recorded elevation, `x-tenant-id` refused at the edge for another network than the
  caller's, and a network missing from `NETWORKS` not found. Its HTTP contract changed: `POST
  /practices` asks the role `network-admin`, `GET /audit/entries` takes `network`, every request
  that reaches data needs the `tenant_id` claim, a token or header naming a network not served is
  answered 404, and a person registered in one network who registers in another is refused
  (422, `CONCURRENCY_CONFLICT`). What 0.11 to 0.14 added to it is confined the same way: the
  instances of the confirmation deadline keep their network, the migration gives the network to
  the instances and the unfinished background jobs already there, a clearance is read in the
  network of its job, and the public opening hours are tagged and purged per network
  (`cacheTags.perTenant`, `PublishedCacheInvalidation` with `perTenant`), named by `x-tenant-id`
  for an anonymous caller and varying on it; their tags read `<network>/calendar:<id>`.

## 0.14.0

**A route answers in JSON, XML or CSV, as the request asks.** `Representations.standard()` of
`@ddd-ts-kit/http`, given to the adapters (`representations` of the mount options) and to
`generateOpenApi`, chooses per request the media type the `Accept` header prefers among those
the route declares in `produces` (on `@Controller` or `defineRoute`), JSON first; none
acceptable is `406 NOT_ACCEPTABLE`, before the handler runs. A refusal is written as
`application/problem+xml` when XML was negotiated. A route that declares `consumes:
['application/xml']` reads an XML body into the value the JSON path produces, validated by the
same schema; another media type is `415 UNSUPPORTED_MEDIA_TYPE`. XML follows one convention,
the default of the XML object of OpenAPI, with a parser of the package's own that refuses any
document type declaration (no new dependency). CSV is written for a page or a list of flat rows,
and a handler that answers an `AsyncIterable` under `streamSchemaOf(item)` is streamed in every
representation; one that fails once its status is sent is reported to `onError` with
`interrupted: true`. `everyPage(readPage)` streams a search page after page, each page a query
sent through the bus, so each one runs under the middlewares of the bus (transaction, tenant
session, timeout, tracing). A route that declares no body schema (a file, a redirect, no
content) is never refused 406 and its answer, a `Readable` included, goes out as the handler
wrote it. The contract follows the representations it is given, which must be those the
server is mounted with: every media type of each route, `406 NOT_ACCEPTABLE` on every route a
representation writes, `415 UNSUPPORTED_MEDIA_TYPE` on every route that reads a body; without
them, JSON only and neither status. Mounting a route that declares `produces` or `consumes`
without representations is refused. Both codes join the default error mapping and the codes
of the kit. Without the option nothing changes: every answer stays JSON. `money` and
`decimalText` write money and decimals as strings, the rule every representation follows.
The documentation page of a generated project (`withDocumentation`) is written with the error
mapper and the representations of the boundary; the contract script looks for stale files in
`openapi/` itself and, with forms, in `openapi/forms/` only.

**A generated project negotiates its representations and serves its forms.** Two keys of
`stack`, chosen at `init`: `representations` (`negotiated`, `json`) and `forms` (`on`, `off`),
both on by default with an HTTP stack. `negotiated` writes `src/platform/http/presentation-of.ts`,
which gives the HTTP boundary and the contract script `Representations.standard()` and a field
decider over the `Access` of the application; `forms: on` writes `with-forms.ts`, which serves
`GET /forms/<operationId>` for each route that declares `form`, and `npm run docs:generate`
writes the forms to `openapi/forms/`. A config without the keys is read as `json` and `off`:
nothing changes until `init --force --representations negotiated --forms on`. `generate
representation <context> <UseCase> xml,csv` adds `produces` (and `consumes` of XML for a
route with a body) to a controller, `generate form <context> <UseCase>` its `defineForm`
hints, and `describe` lists the media types and the form of each route.

**A route describes its body as a form.** A route that declares `form` (on `@Controller` or
`defineRoute`, `defineForm<Body>(hints)` next to the schemas of the controller) is served by `formRoutes(routes,
{ fieldAccess })` at `GET /forms/<operationId>`: JSON Forms by default (schema, UI schema,
data), or a neutral tree of groups and fields with `?format=blocks`. Fields, constraints and
options come from the request schema and its closed vocabularies, layout, widgets, lookups and
conditions (`visibleWhen`, `requiredWhen`) from the hints, labels are translation keys, and
values given in the query prefill it. The form respects the caller: given only to who may run
its use case when it declares `requires` (the permission asked as `@Requires` asks it, from the
values of the query; 403 otherwise), a field they may not see is absent (and not echoed in
`data`), one they may not set is read-only, an object with every field it holds; the server
still validates and the use case still decides. `formDocumentsOf(routes)` writes every form whole for the documentation.

**A field of an answer can be reserved to some callers.** `withFieldAccess(schema, { field: {
read, write, subject } })` of `@ddd-ts-kit/http` marks a field with a permission or a policy:
the pipeline leaves it out of every representation (JSON, XML, CSV, streamed lists) for an actor
who may not read it, refuses it with 403 in a request body from one who may not set it, and the
contract marks it with `x-field-access` and no longer lists it as required. `fieldDeciderOf({
access, clock })` decides through the `Access` of `@ddd-ts-kit/auth`, once per element and per
request, remembering the last 256 elements per requirement; without a decider a restricted
field is refused to everybody. A field shown or hidden is decided without being recorded, a
field set in a body is recorded: `Access.decideOn({ actor, permission, subject, context,
recorded })`, new and optional on `Access`, implemented by `PolicyAccess`. The new rule
`authz/fields-by-schema` (checker and ESLint) refuses a test on the roles of the actor under
`application/queries/`, the hand-written way of shaping an answer.

**The JSON Schema of a class-validator class holds what it inherits.** A class that extends
another one, `class SearchPracticeAgendaLine extends SearchAppointmentsLine {}`, was described as
an empty object: the contract said nothing of its fields. `classSchema` now gives it the
properties and the required names of its ancestors. A project with such classes sees its
contract grow on the next `npm run docs:generate`. The end-to-end client of
`@ddd-ts-kit/testing` sends a string body as it is when the call names another content type
(`{ headers: { 'content-type': 'application/xml' } }`), as JSON otherwise.

The concepts and the tools are explained in two new pages, `docs/concepts/representations-and-forms.md`
and `docs/tools/representations-and-forms.md` (JSON Forms renderers for React, Angular and Vue,
the alternatives, why no XML or CSV library), and parts 2 and 3 of `docs/proposals/read-side.md`
are marked built.

**Representations, caching and the four adapters together.** `mountHono` serves what
`mountExpress` and `mountFastify` serve: a body in a media type the route consumes is read as
text under `bodyLimit`, a streamed list is streamed, and the mount refuses `produces` or
`consumes` without representations. A cached answer written in XML or CSV keeps the validators
and tags of its policy: the version, the instant and the tags are read from what the handler
answered, a strong `ETag` digests the bytes of the media type sent (none on a streamed list),
and `Vary` holds the headers of the policy and `accept`, in the answer and in the contract. A
public answer chosen by `Accept` is refused at the mount behind a cache that ignores `Vary`, and
so is a public answer with fields reserved to some callers whose `vary` names neither
`Authorization` nor `Cookie`, even on a route anybody may call: a shared cache would hand the
fields one caller may read to the next. A shared schema keeps its restricted fields whichever
wraps the other (`withFieldAccess(sharedSchema(...))` or `sharedSchema(name,
withFieldAccess(...))`, through `schemaBehind` of `@ddd-ts-kit/validation`), in the definition it
refers to and in the answer, and the page of a shared item keeps the restricted fields of the item.

## 0.13.0

**A schema shared by several routes is documented once.** Declared once, a schema used whole or
inside other schemas by several routes lands once in `components.schemas` of the OpenAPI
contract and every route points at it with `$ref`: a zod schema with `.meta({ id })`,
`classSchema(Dto, { shared: true })`, or any schema through `sharedSchema(name, schema)` of
`@ddd-ts-kit/validation`. class-validator gains `pickClass`, `omitClass` and `partialClass` to
reuse a DTO class in part, and the Standard Schema adapter documents a schema its library
converts itself (Standard JSON Schema, verified with zod 4) when no JSON Schema is given. The
platform shares its own: `acceptedSchema` (`Accepted`, the `{ id }` a command route answers),
the page of a shared item (`<Item>Page`) and the problem document. A shared `params`, `query`
or `headers` schema still gives one parameter per property.

**The contract of a project on the Standard Schema adapter can change.** `standardSchema(schema)`
without a JSON Schema documented `{}` (any value); it now documents what the library converts
itself, so a project on `"stack.validation": "standard-schema"` whose schemas implement Standard
JSON Schema (zod 4 does) sees its OpenAPI contract and client SDK grow the real shapes, and
`openapi --check` or `sdk --check` report drift until they are regenerated. To move: run
`npm run docs:generate` and commit the contract and the client; to keep a schema documented as
any value, pass `{}` as its second argument. A schema the library cannot convert (a date, a
custom check) is still documented `{}`, never a failure.

**A new project declares a shape once.** `init` writes `"stack.schemas": "shared"`: a generated
command route answers its identifier with `acceptedSchema` instead of a schema of its own,
`generate schema <context> <Name>` writes a shape several routes use in
`presentation/http/shared/<name>.schema.ts` (`generate schema shared-kernel <Name>` in
`presentation/` of the shared kernel, for what several contexts answer with), and two rules hold
it: `schema/no-duplicate-shape` reports a DTO class or an object schema that declares by hand
the shape of another one of its context or of the shared kernel (two contexts may say the same
thing in their own words; a placeholder the generator left to fill is not judged), `schema/presentation-only` keeps every schema in a presentation layer
(the second in ESLint too). A config without the key reads as `per-route`: nothing changes and
nothing is reported; the steps to move are in `docs/CONFIG.md`. The example now shares its
schemas: its twenty identifier answers are the one `Accepted` component, its two agenda
searches answer `AgendaLinePage` pages of one `AgendaLine`, and one `TimeSpan` is the body of
the time off route whole and the start of a booking or a rescheduling through
`pickClass(TimeSpan, ['startsAt'])`; the bytes on the wire are unchanged.

**Hono and TypeBox.** `@ddd-ts-kit/http/hono` mounts the routes on Hono 4 (`mountHono`), through
the same pipeline and the same behaviour suite as Express, Fastify and NestJS, uploads and signed
file links included. The adapter reads a JSON body chunk by chunk up to `bodyLimit` (1 MiB by
default, as Fastify): a larger one is answered 413 `BODY_TOO_LARGE`, one that is not JSON 400
`MALFORMED_BODY`, both as problems. `@ddd-ts-kit/validation/typebox` validates with TypeBox 1
(`typeboxSchema`, compiled once, defaults filled, undeclared properties dropped, the failed
keyword as the issue code and a missing property at its own path, `{ coerce: true }` for query
strings) and documents the schema as it is, a nested schema with an `$id` shared once in the
contract (`Type.Intersect` extends it and keeps the reference). Both libraries are optional peers.

**Four contract pairs a project starts from.** `init --http hono` serves the routes with Hono on
Node (`@hono/node-server`, the limiter and the readiness probe in front when the cache is
shared), and `init --validation typebox` writes every schema of a route (the line of a search
included), a function route and a shared schema with TypeBox. A new end-to-end spec,
`contract-pairs.spec.ts`, generates one project per pair (Express and zod, Fastify and TypeBox,
Hono and zod, NestJS and class-validator), shares one shape between two routes, adds a search,
and holds each to zero finding, its specs and end-to-end specs (401, 403, 201 and the trace of
the request), a current contract that documents the shape once, and a client generated from it
that names `Money` and `Accepted` once and compiles. NestJS with class-validator, generated before but never run end to end, is now.

**Which pair for which team.** `docs/tools/contract-pairs.md` compares the four pairs (type
inference, composition of shapes, contract fidelity, issue codes, ecosystem, maintenance) with
numbers measured by `pipeline/monorepo/measure-contract-pairs.mjs`: the pipeline of the kit costs
about a microsecond per request before validation, zod parses in about half a microsecond,
class-validator and TypeBox (through the adapter) in five to ten. oRPC was run and is documented
as not fitting: its procedures, error format and second contract generator would sit next to the
kit's, and the typed client it offers comes here from the generated contract.

## 0.12.0

**Cache policies on routes, and `no-store` for authenticated answers.** A controller, a route
group or a function route declares `cache: { scope, maxAge, sMaxAge, staleWhileRevalidate,
staleIfError, mustRevalidate, vary }` of `@ddd-ts-kit/http`: the pipeline answers its
`Cache-Control` and `Vary`, the contract documents them, and a policy that would let a cache keep
what it must not is refused when the route is declared, above all the `public` answer of a route
that knows its caller without the request headers it varies on. When the routes are mounted, a
public answer is held to the options of the application: on a route that knows its caller, `vary`
names `Authorization`, `Cookie` or the header its tenant is read from; behind a cache that ignores
`Vary` (Cloudflare, Bunny; `cacheTags.honoursVary` to say otherwise) a varying answer is refused;
and every kept answer varies on the headers `resolveTenant` reads (`TenantResolver.headers`, set by
`tenantFromHeader` and `firstTenantOf`). The policy of a route group reaches its reads only: a
write of the group keeps the default of a write. A route that is not public and
declares nothing now answers `Cache-Control: no-store`, refusals included (before, nothing): a
generated contract gains that header on every authenticated operation, regenerate it with
`npm run docs:generate`. The ESLint rule `presentation/shared-cache-varies` reports in the editor a
public policy, without `vary`, on a declaration that writes guards or security schemes. See
`docs/concepts/http-caching.md`.

**Conditional requests.** A cache policy names the version of an answer, `etag: 'representation'`
(a strong tag hashed from the bytes) or `etag: { version: 'version' }` (a weak tag from a field of
the body), and `lastModified: 'changedAt'`: the pipeline answers `ETag` and `Last-Modified`, and
`304 Not Modified` to `If-None-Match` and `If-Modified-Since`. A write declares
`ifMatch: 'optional' | 'required'`: the version named in `If-Match` reaches the handler as
`context.expectedVersion`, `expectVersion(aggregate, expected)` of the kernel refuses a stale one
with `PreconditionFailedError` (`PRECONDITION_FAILED`, 412), and a required one that is missing
answers `PRECONDITION_REQUIRED` (428). Both codes join the default error mapping and the codes a
route may declare without a class of its own (`errors/known-code`). The contract documents the
parameters, headers and answers.

**Cache tags, purged after the commit.** A public policy names the resources its answer shows
(`tags: [{ resource: 'calendar', param: 'calendarId' }]`), sent in the header the shared cache
reads (`cacheTags: { header: CacheTagHeader.xkey }` of the options; `surrogate-key`, `cache-tag`,
`cdn-tag`), filed under the tenant of the request when the application says so (`perTenant`, on
the answers and on the purges). The kernel gains two ports: `CacheInvalidation`,
which a `before-commit` handler asks and which `kernelModule()` binds to purge requests published
on the outbox (a rollback purges nothing, a commit purges even across a crash), and `CachePurger`,
which the relay calls through `new PurgingPublisher(purger, broker)` and which
`domain-events/transactional-before-commit` now refuses before the commit. `@ddd-ts-kit/http/purgers`
holds `VarnishCachePurger` (xkey or ban, with the purge `key` of the VCL), `FastlyCachePurger` and
`CloudflareCachePurger`, all held to `cachePurgerContract` of `@ddd-ts-kit/testing/contracts` (the
CDN ones on a fake of the purge API each documents); the test application exposes
`cacheInvalidation`. `RepeatedCachePurger` purges once more a little later, for a read that reached
the cache after the purge. Filed per tenant, a tagged answer to a request naming no tenant is
`no-store`, a tagged public route anybody may call needs `resolveTenant`, and an invalidation asked
without a tenant throws `NoCurrentTenantError`. `CacheInvalidation` and `CachePurger` join the
standard interfaces (`standard/no-parallel-interface`: `CacheInvalidator`, `CdnPurger` and the
like). Varnish 9.1.0 runs in the integration job. See `docs/tools/http-caches.md`.

**Varnish in front of a generated project.** `init --http-cache varnish` (recorded as
`stack.httpCache`; a config without it is `none`) adds the Varnish 9.1.0 service to the compose
file with its VCL in `docker/varnish/default.vcl` (it keeps only what an answer allows by
`max-age` or `s-maxage`, and lets a purge in from its machine or with `VARNISH_PURGE_KEY`),
validates `VARNISH_URL` and `VARNISH_PURGE_KEY`, tags the public answers in `xkey` from the HTTP
boundary, and has the outbox relay of `main.ts` and of every `generate service` entry point purge
through `PurgingPublisher` and `VarnishCachePurger`; the end-to-end application records the purges
(`purges.purged`). It needs an HTTP framework and `--events outbox`. On `--di manual` and `nest`
the platform gains `cacheInvalidation`. With `--tenancy`, the answers and the purges are tagged
per tenant and the HTTP boundary reads the tenant of a request from `x-tenant-id`.
`generate controller --cache public|private|no-store` writes the cache policy of a controller.
The generated presentation rules say when to cache, purge and condition a write.

## 0.11.0

**File import and export, designed.** `docs/concepts/file-import-export.md` says how a large
file is to be processed on the job queue and the file storage: an import read as a stream and
sent as commands batch by batch, with its checkpoint, its progress and a rejection report; an
export written in parts; chunks followed by a process manager beyond one attempt. Nothing of it
is built in this version; the page lists what would be added.

**A long background job in the example.** A practitioner going away clears a period of their
calendar: `POST /calendars/:calendarId/clearances` (202, the identifier of the clearance) enqueues
`ClearCalendarBackgroundJob` in the unit of work of the command, which cancels the appointments
of the period one by one as the person who asked, with a checkpoint and its progress after each,
and `GET /calendars/:calendarId/clearances/:clearanceId` answers its status (an enum of
`QueuedJobStatus`) and `{ done, total }`, for a clearance of that calendar only (the subject of
its job);
then the time off is accepted. Both routes are new, with the permission `scheduling:calendar.clear`
and the error code `UNKNOWN_CLEARANCE` (404); no existing route of the contract changes. The
end-to-end support of the example can start the worker (`startApplication({ jobs: true })`).

**Generators for background work.** `ddd-ts-kit generate background-job <context> <Name>
--command <UseCase>` writes a background job that sends its command as the actor that enqueued
it (`execution.actor`, new on `BackgroundJobExecution`), with one field of its payload per other
input of the command (a `Date` as its ISO text), registered by `@Background()` or on the builder
of the module file, and a spec that enqueues a payload of every field and runs what is due. `generate
state-machine <context> <Aggregate> --value <state>... --transition "<intention>:<from>>[<to>]"`
writes the status vocabulary (or adds the values it misses), the machine and its spec; a machine
without `refused` throws the new `TransitionError.forbidden` (code `FORBIDDEN_TRANSITION`), and
`lifecycle/status-through-machine` asks an aggregate to import its machine once it writes a
status. `generate process <context> <Name>` writes a process manager, the background job of its
timeouts and their specs. The two that run on the queue need `--di tsyringe`. `init --queue
database|redis|memory` chooses where jobs and process instances are kept (`stack.queue`):
`database` by default on Knex or Drizzle with tsyringe, the jobs and processes tables created by
the first migration and bound by the platform module; `redis` puts the jobs on the server of the
cache, a write lost after the commit logged and reported (`reportLostJobs`); a config without
the key is read as `memory`, as before. A queue kept in the memory of a process is consumed by
that process even with its jobs off, so the API of a project with a worker still runs the jobs
it enqueues. Under standard decorators,
`@Background` records the job once the class is defined, when its static `jobName` exists.

**Process managers.** A long-running process that reacts to events, keeps its own state and
sends commands is a class of `application/processes/` whose steps decide (`ProcessDecision`: the
next state, the commands, the timeouts armed or disarmed, the end). The new `ProcessRunner`
port (runner in `@ddd-ts-kit/scheduling`) runs a step in one unit of work: it loads the instance
an event correlates, saves its state with optimistic concurrency through `ProcessStore`
(`InMemoryProcessStore` in the kernel, `KnexProcessStore` and `createProcessTable`,
`DrizzleProcessStore` and `processesTable`, held by `processStoreContract`), arms its timeouts
as delayed background jobs and sends the commands. `givenProcess` of `@ddd-ts-kit/testing`
tests a step without infrastructure. The new rule `process/sends-commands-only` (checker and
ESLint) refuses a process that imports an aggregate, a repository, a port or infrastructure;
`CONTEXT.md` gains a `Process managers` section and `describe` lists them. In the example, the
confirmation deadline of a requested appointment is a process manager; the booking trace gains
one handler span, the HTTP contract is unchanged.

**State machines.** `defineStateMachine` (kernel) declares the lifecycle of an aggregate once,
in `domain/state-machines/<aggregate>.state-machine.ts`: its states, the states it starts in,
transitions named after the intention methods, guards, and the refusal of a forbidden transition
from a static factory of the concept error. The aggregate asks `machine.next(status, 'confirm',
context)`; the new rule `lifecycle/status-through-machine` (checker and ESLint) refuses a status
written by hand in an aggregate whose machine exists, and `ddd-ts-kit docs` draws each machine in
a new `State machines` section of `CONTEXT.md` (and lists the background jobs in a
`Background jobs` section); `describe` lists both. A CONTEXT.md written before gains the
sections by hand: copy them from a context generated by this version. In the example, the
appointment lifecycle is a state machine; its HTTP contract is unchanged.

**Background jobs.** A use case hands work to a worker with the new `JobQueue` port of the
kernel: `jobs.enqueue(CompileStatementsBackgroundJob, { month }, { delay, runAt, idempotencyKey, subject })`, the
job a class with a static `jobName` declared with `@Background({ maxAttempts, backoff, timeout,
lease })`, its payload typed by its `run`. With a database the job is a row of the jobs table of
its context, written by the transaction of the command (`KnexJobStore` and `createJobTable` in
`@ddd-ts-kit/knex`, `DrizzleJobStore` and `jobsTable` in `@ddd-ts-kit/drizzle`), so a command
that rolls back leaves no job and one that commits loses none; `RedisJobStore` and
`InMemoryJobStore` write it, and a cancellation or a revival, once the unit of work committed
(`whenCommitted`, new in the kernel). An idempotency key is scoped by the tenant of the job, and
work done for a tenant finds and cancels the jobs of that tenant only; `find` answers the tenant
and the `subject` of a job, never its payload, and its status is the closed vocabulary
`QueuedJobStatus`. The `QueueWorker` of `@ddd-ts-kit/scheduling` claims the jobs of the queues of its
contexts with a lease it extends by heartbeats, at least once, with retries and an exponential
backoff, dead jobs, cancellation, progress, checkpoints for long jobs, a concurrency per queue
and a graceful stop; each attempt runs as the actor, in the correlation, the tenant and the
trace of the work that enqueued it, is counted in `background_job_runs_total` and
`background_job_duration_ms`, and reports an unexpected failure to the error reporter.
`@ddd-ts-kit/di` registers the declared jobs and runs the worker in the processes that run the
jobs; the test application gains `jobQueue` and `backgroundJobs.runDue()`. One contract,
`jobStoreContract`, holds every store; the Knex and Drizzle stores are proven on PostgreSQL in
CI behind a pool of several connections, the Redis store on Dragonfly. Prisma and TypeORM get no
store yet. `givenProcess(..).thenState` fails a state that JSON would change, as the runner
stores it. See [Background jobs](docs/concepts/background-jobs.md).

## 0.10.0

**Event sourcing, chosen per aggregate.** `EventSourcedAggregate` in the kernel: a command
checks its invariants and records an event, the state changes only in the apply method of each
event, and the aggregate is rebuilt by replaying its stream, from a snapshot when one was
taken. An `EventStore` port (append at an expected version, a concurrency conflict otherwise,
each stream in order, the whole store by position), `InMemoryEventStore`, stored events
declared with `defineStoredEvent` and read back through upcasters (a stored event is never
rewritten), `EventSourcedRepository` for the adapters, snapshots per aggregate, and
crypto-shredding of personal data (`personalData`, `PersonalDataCipher`, `SubjectKeyStore`).
`@ddd-ts-kit/testing` adds `eventStoreContract`, `eventStoreUnitOfWorkContract` (nothing is
published for an append rolled back), `givenEvents` (given events, when a command, then events,
without a database) and `expectSnapshotEquivalence`. The other aggregates of a context keep
their state in tables: nothing changes for a project that does not opt in.

**An event store on PostgreSQL through every ORM adapter.** One implementation in the kernel
(`PostgresEventStore`, with the snapshot, checkpoint and data-subject key stores), run by
`createKnexEventSourcing`, `createDrizzleEventSourcing`, `createPrismaEventSourcing` and
`createTypeOrmEventSourcing`, each held to `eventStoreContract` and to
`eventStoreUnitOfWorkContract`. The tables come with the migrations of the project:
`createEventStoreTables` (knex), `eventStoreTables` (drizzle-kit), the models of
`prisma/event-store.postgresql.prisma`, `eventStoreEntities` (TypeORM), or the statements of
`eventStoreTablesSql`. An append locks the head of the store until its transaction ends, so
positions follow the commits without gaps; two appends never run side by side.

**Projections fed by the event store.** `@Projection(name, { feed: 'event-store' })` is applied
by a `CatchUpSubscription` with a stored checkpoint (one batch and its checkpoint per unit of
work), never by the dispatcher, and rebuilt from position zero by
`EventStoreProjectionRebuild` into a copy that takes the place of the table.

**Five rules for event-sourced aggregates**, in `ddd-ts-kit check` and in the ESLint plugin:
`event-sourcing/state-in-apply` (the state changes only in apply methods, which record nothing),
`event-sourcing/past-tense`, `event-sourcing/store-behind-repository` (the domain and the use
cases never read the store), `event-sourcing/projection-never-appends` (no projection names the
event store; one declared `{ feed: 'event-store' }` names no repository either) and
`event-sourcing/upcaster-required`: the data of a stored event is a named type declared in its
codec file with every named type it reaches, a version above 1 has an upcaster from each
version below, and the shape of each version is recorded by `ddd-ts-kit docs --stored-events`
in `stored-events.lock.json`, so a shape changed in place is refused. `ddd-ts-kit docs --check`
(`npm run docs:check` in the generated pipeline) fails while a declared version is not
recorded. The rules judge event-sourced code, the kernel's event store and projections declared
`{ feed: 'event-store' }`, all new in this release: a project that has none sees no new finding,
and a projection fed by the dispatcher may still name a repository port.

**`ddd-ts-kit generate aggregate <context> <Name> --event-sourced`** writes the aggregate with
its birth event (`<Name>Created`) and its apply method, the codec of its stored events
(`infrastructure/persistence/<name>-events.mapper.ts`), a builder that replays a history and a
given-events spec; `generate domain-event` on such an aggregate adds the event to its union, to
`appliers()` with an empty apply method, and to the codec. `CONTEXT.md`, `describe` and `list`
mark the event-sourced aggregates. `ddd-ts-kit docs --stored-events` records the stored shapes.
Like every reaction since 0.7.0, `appliers()` and the codec read the name an event declares
once, `[LedgerCredited.eventName]: ...`; the checker and `docs --stored-events` resolve that key.

**Documentation.** A concept page, [Event sourcing, per aggregate](docs/concepts/event-sourcing.md):
when to choose it and when not, what it costs, crypto-shredding, projections fed by the store,
and how to move an aggregate to it and back. The example keeps the attendance record of a
patient as its events (scheduling), with a history rebuilt from the store and the erasure of a
patient (`npm run erase:patient`: the key destroyed, the projections fed by the store rebuilt);
its only change of
HTTP contract is the additive route `GET /practices/{practiceId}/patients/{patientId}/attendance`.
Plugin 0.13.0: the persistence, testing and scaffold skills say how.

## 0.9.0

**Files live in a storage, never in the database.** The kernel gains the ports `FileStorage`
(streams in and out, `stat`, `delete`, `copy`, `move`, `list`, short signed download and upload
links), `FileKeys` (keys generated on the server, under the tenant when there is one) and
`FileScanner` (an antivirus or content check before a file is accepted), the reference an
aggregate keeps, `StoredFile` (key, size, media type, checksum), and `FileStaging`, which stages a
file, moves it to its key as the last step of the transaction that records it
(`promoteOnCommit`, on the new `atCommit` step of the unit of work, undone on a rollback) and
purges the staged files, every one an orphan since no committed row points into `staging/`. A
command carries a client's file as a `FileUpload`, which `fileUploadsMiddleware` stages after
the permission and before the unit of work, so no transaction waits on an upload. A direct
upload is confirmed from the `PendingUpload` grant the server kept (`uploadUrl` answers the link
and the grant, `confirm(pending)` checks the size cap it carries), and the upload links of the
storages the application serves enforce that cap. Media types are checked on the bytes.
`InMemoryFileStorage` and `LocalFileStorage` pass the new `fileStorageContract` of
`@ddd-ts-kit/testing/contracts`; a signed download link is an attachment on every connector.

**`@ddd-ts-kit/s3`, the connector of a deployment.** `S3FileStorage` holds files in a bucket of
any provider of the S3 protocol (AWS, MinIO, OVHcloud, Scaleway, Cloudflare R2): multipart
uploads streamed part by part, presigned links whose upload signature covers the media type,
copy and move by the service. The AWS SDK v3 packages are optional peers. The contract runs on
MinIO in the integration job (`pgsty/minio`, pinned by digest: the upstream project no longer
publishes images).

**A controller declares the file it receives.** `upload: { field, maxBytes, mediaTypes }` on
`@Controller` puts the multipart form, the size and the media types in the OpenAPI contract
(with the 413, 415 and 422 refusals) and streams the file to `handle` as `upload`, checked on
its way: `multipartUploads()` of the new `@ddd-ts-kit/http/uploads` entry reads it (busboy, an
optional peer); a client that drops the connection part-way fails the file stream, so nothing
waits on it. `FILE_TOO_LARGE` answers 413, `UNSUPPORTED_MEDIA_TYPE` 415 and `FILE_NOT_FOUND`
404 by default. `signedFileRoutes(storage)` answers the signed links of the local and in-memory
storages, and a handler may answer a stream.

**A generated project keeps files, from its first day.** `init --storage local|s3|none` (new key
`stack.storage`, `local` in what `init` writes, `none` when a config does not say it, so an
existing project changes nothing) writes `platform/files/` and `platform/config/read-files.ts`
(with `local`, `FILES_PUBLIC_URL` and `FILES_SIGNING_SECRET` are required in production, even
before the first file arrives):
a local directory in development, a bucket of the S3 protocol with a MinIO service in
`docker-compose.yml` for `s3`, the memory in the tests; the ports bound, the hourly purge of
staged files, the routes that answer the links of a served storage and the upload reader.
`generate file-upload <context> <UseCase> --path ...` writes the controller that declares the
file, the command that carries it as a `FileUpload`, the handler that records and promotes it,
and their specs.
Two rules: `persistence/no-file-content` (no binary or base64 column in a schema or a
migration) and `files/port-not-connector` (the model and the use cases name the port, never a
connector); `@ddd-ts-kit/s3` is refused in `domain/` and `application/`. To add files to an
existing project: `npx ddd-ts-kit init --force --storage local`.
`FileStaging.deleteAfterCommit` deletes, once committed, a file an aggregate no longer
references, and the refusals of a file are codes of the kit for `errors/known-code`.

**The example keeps the documents of appointments.** A practice attaches a document (`POST
/appointments/{appointmentId}/document`, multipart, at most 10 MiB of PDF, PNG or JPEG checked on
its bytes), reads it through a link of five minutes (`GET`, every read recorded in the audit
trail) and removes it (`DELETE`); the contract only gains these three operations. The local
directory serves development and the memory the tests; MinIO waits behind the `files` profile
of the compose stack.

## 0.8.0

**The tenant travels with every unit of work** ([Multitenancy](docs/concepts/multitenancy.md)).

- `IntegrationEvent.tenantId`: `scopedPublisher` stamps the tenant of the work on every event
  published without one, `executionContextOfEvent` runs the consumer in it, and the four brokers
  carry it in the envelope and in a header (`x-tenant-id`; `tenant-id` for Redis Streams). The
  outbox keeps it where asked: `createOutboxTables(knex, { tenant: true })` or
  `addOutboxTenantColumn` with `KnexOutboxStore`'s `tenant: true`, `tenantOutboxTable()` for
  Drizzle. Without them nothing changes: the tenant is not stored, as before.
- Jobs state `tenancy: 'global'` (the default, as before) or `'per-tenant'`: the in-process
  scheduler, given a `TenantDirectory` (`tenants`), runs a per-tenant job once per tenant, each
  run in that tenant's scope, and `JobExecution.tenantId` says which.
- One grammar for a tenant id, `isTenantId` (letters, digits, `_`, `-`, at most 63): the edge
  answers 404 to any other, a broker treats an envelope carrying one as poison, and
  `executionContext` throws `InvalidTenantIdError`. A project whose tenant ids hold other
  characters (a `.`, a `:`) must map them before upgrading.
- Kernel: `tenantReachOf`, `tenantsOf`, `isTenantMember`, `tenantKey`, `tenantCacheKey`,
  `TenantDirectory` and `InMemoryTenantDirectory`, and `acrossTenants`, the explicit elevation of
  platform staff over tenants, refused without a reason and written to the audit trail before
  the work runs (`ExecutionContext.elevation`, logged as `elevation`).
- `@ddd-ts-kit/testing`: `eventBusContract` checks that the tenant of an envelope arrives intact;
  `outboxStoreContract` does with `carriesTenant: true`.

**Tenant isolation, four strategies, proven by one contract.**

- Shared tables: `tenantTable`, `ownTenantTable` and `whereTenant` (Knex), `tenantCondition` and
  `ownTenantCondition` (Drizzle): reads reach the tenant of the work or the tenants of an
  elevation, writes the one tenant of the work. The read model stores of both take `tenant`, and
  `TenantAuditReader` (`@ddd-ts-kit/audit`) confines every search of the trail to the tenant.
- Row-level security on PostgreSQL, the second line: `enableTenantIsolation` and
  `tenantIsolationStatements` (Knex), `tenantPolicies` and `forceRowLevelSecurity` (Drizzle), and
  `tenantSession(scope)`, the new `begin` option of `createKnexUnitOfWork` and
  `createDrizzleUnitOfWork`, which sets the tenant of each transaction only. One policy per
  command: an elevated update or delete still touches only the tenant of the work.
- Schema per tenant (Knex): `tenantSchemaOf`, `tenantSchemaTable`, `migrateTenantSchema` with
  `tenantOfMigration`, `tenantSearchPath`. Database per tenant (Knex): `TenantDatabases` (one
  bounded pool per tenant held by a lease, at most `maxTenants` instances closing ones included,
  an idle one closed first and work waiting rather than exceeding the bound),
  `createTenantRoutedUnitOfWork` (statements inside the unit of work only, one tenant per
  transaction), `migrateEveryTenant`.
- `@ddd-ts-kit/testing`: `tenantIsolationContract`, run against every strategy above on PGlite
  and PostgreSQL; `asTenant(scope, tenantId, work)` and `anExecutionContext().elevatedOver(...)`.
- Prisma and TypeORM get the `tenant_id` column and the kernel helpers, applied by hand; no
  helper, no row-level security, no contract run yet.

**The tenant of a request is resolved at the edge** (`@ddd-ts-kit/http`): `resolveTenant` with
`tenantFromSubdomain`, `tenantFromHeader`, `tenantFromPath`, `tenantFromClaim` or `firstTenantOf`;
the pipeline answers 403 to an authenticated caller that does not belong to the tenant named,
before any guard or handler. The guard `TenantMember` keeps routes for the members of the tenant
of the request. Without `resolveTenant` the tenant is the actor's, as before.

**`init --tenancy shared-table`** (Knex or Drizzle) records `"stack.tenancy"` and generates every
repository confined to the tenant through the helpers above, the outbox keeping the tenant of each
event, the search of the audit trail confined to the tenant of the work by `TenantAuditReader`; the new rule `tenancy/scoped-statement` reports a statement of a context that reaches a table
straight from the executor. `init` refuses the strategy with Prisma, TypeORM, `custom` or no ORM,
and refuses row-level security, schema per tenant and database per tenant, which are wired by hand
for now. `generate repository --tenant-scoped` writes the same helpers. A config without the key is
`none`: nothing changes for an existing project.

**Access control: a decision guide, scopes, and the refusals at the edge in the audit trail.**

- [Choosing access control](docs/guides/choosing-access-control.md): five questions that pick
  roles, attribute policies or relationships (Zanzibar), a worked preset for each (typed
  permissions and roles, a policy on one element, a scoped search), the combined model of the
  example, and where relationships are evaluated.
- `Session.scopes`, filled by the JWT and Keycloak authenticators from `scope` (or `scp`);
  `hasScope`, and `SessionScopes` to declare the vocabulary of a project; the guard `HasScope`
  (`@ddd-ts-kit/http`) refuses a request whose session lacks a scope named.
- A request refused by a guard (`HasRole`, `HasScope`, `TenantMember`, a tenant the caller does
  not belong to) is reported to the new `onGuardRefusal` of the HTTP pipeline, and
  `auditGuardRefusals` (`@ddd-ts-kit/audit`) records it as a denied decision, except for a caller
  without a credential, so that unauthenticated traffic cannot write to the trail without bound.
  It is part of `--audit on` (`stack.audit`), with no key of its own. A generated project
  with the audit trail wires it (`create-audit.ts`, `http-boundary.ts`, `compose-application.ts`);
  a project initialised before adds `refusals: auditGuardRefusals(trail, { clock, ids })` to the
  call of `httpBoundary` and `onGuardRefusal: refusals` to what it answers, as `init --force` writes.

**`@ddd-ts-kit/openfga`, a new package: relationships on OpenFGA.** `OpenFgaRelationTupleStore`
and `OpenFgaAuthorizer` answer the `RelationTupleStore` and `Authorizer` ports of
`@ddd-ts-kit/auth` on an OpenFGA server (OpenFGA 1.10 or later), with the mapping and the denial
codes of `RelationBasedAuthorizer`. The authorization model is generated from the relationship
schema (`authorizationModelOf`), written when it differs (`ensureAuthorizationModel`) and
compared (`modelDrift`): the schema stays the one source. `@openfga/sdk` 0.9.7 is an optional
peer, imported by the `/sdk` entry (`openFgaClient`). Both adapters pass the contract suites of
the in-process ones, in memory and against `openfga/openfga` v1.22.0 in the integration job. A
`ListObjects` answer as long as the server's cap (`listObjectsLimit`, 1000 by default) is refused
with `ReverseExpansionLimitError`, since the server cuts a longer list without an error.
[Authorization engines](docs/tools/authorization-engines.md) says when to move from the
PostgreSQL tuple store to OpenFGA.

## 0.7.0

**A value object throws its refusals.** `init` writes `"stack.valueObjects": "throwing"`:
`generate value-object` writes a `create` that returns the value object or throws the refusal
built by the static factory of its concept (`throw PersonError.invalidEmail(raw)`), as the rest
of the domain refuses, and a spec that asserts it with `expectRefusal(() => Email.create(raw),
code)`; a caller no longer unwraps anything. `Result`, `ok`, `err` and `unwrap` stay in the
kernel: `--value-objects result`, or a config without the key, keeps the form of 0.5, so an
existing project upgrades without a change. `ddd-ts-kit value-objects` moves a project from one
to the other: it rewrites the factories, removes every `unwrap(..)` of them, turns the assertions
on a `Result` into assertions on the factory, tidies the imports, sets the key, and prints what
is left to a person.

**Closed vocabularies are declared once.** A status, a kind or a role is an object `as const`
and the union type of the same name (`AppointmentStatus.NoShow`), not an `enum`: Node's type
stripping and `erasableSyntaxOnly` refuse an `enum`, measured on Node 24. `generate vocabulary
<context> <Name> --value <value>...` writes one under `domain/vocabularies/`, a new canonical
role, and adds the values a file does not hold yet. `init` writes the roles a credential carries
as the vocabulary `Role` of the platform (`<platformDir>/auth/role.ts`), read by the grants
(`[Role.Admin]: ['*']`, `systemRole: Role.System`) and the attribute policies;
`generate route-group --role <role>` writes `HasRole(Role.<Key>)` and adds the role to it; the
grant `generate job` gives a system actor names the permission through its set
(`billingPermissions['invoice.cancel']`) instead of its id.

**A domain event names itself once.** `generate domain-event` writes `static readonly eventName =
'billing.invoice.issued'` and `readonly name = InvoiceIssued.eventName`; the reactions
`generate event-handler` and `generate integration-event` write read it,
`@DomainEventHandler(InvoiceIssued, { name: InvoiceIssued.eventName })` and
`domainEvents.on(InvoiceIssued.eventName, ..)` in a module file, so a renamed event cannot leave a
handler on the old name. An integration event handler reads the type it handles from the
declaration of its upstream, `static readonly eventType = invoiceIssuedV1.type`, which the event
catalog script resolves. `events/name-format` judges `eventName`, and `declarations/role-declared`
accepts `{ name: <Event>.eventName }` when `<Event>` is the class the decorator is given. An event
written before, `readonly name = '..'`, and a handler that writes the name out are still read and
compared; a reaction generated for such an event writes the name out, so it compiles.

**Two rules against magic values.** `language/declared-vocabulary` (checker and ESLint) reports a
string literal whose value a vocabulary of the project declares, an object `as const` with the
union type of its name or a permission set of `definePermissions`, and names the key to write
instead: a vocabulary of a context in that context, the one of the platform in the platform and
in the route groups, a permission id and a vocabulary of the shared kernel everywhere; tests,
published languages and the relationship schema are not judged. A vocabulary is parsed, so a
documented entry, double quotes and `as const satisfies ..` are read. `clean/no-magic-number`
(ESLint) reports a number in `domain/` and `application/` other than 0, 1, -1, an index, a type or
the initializer of a module constant or a `static readonly`; the `allow` option changes the list.
Both rules hold under `"stack.literals": "named"`, which `init` writes (`--literals free` leaves
them out). A config without the key reads as `free`: an existing project upgrades without a
change, including the grants `generate job` wrote by their permission id, which a job generated
again recognises instead of granting twice. To turn the rules on, set the key and follow the fix
each finding gives ([Configuration](docs/CONFIG.md#stack)). The example declares 8 vocabularies and
replaced 227 raw values and 8 numbers, its OpenAPI contract unchanged.

**Every package carries the MIT notice.** Each published package now holds the `LICENSE` of the
repository next to its `dist/`, and `npm run package:check` refuses a tarball without it, or with
another text. Earlier versions were published without it.

## 0.6.0

**A typed client of the contract, for the callers of the API.** `npx ddd-ts-kit sdk` (or
`init --sdk`) generates one client per document of the OpenAPI contract, a workspace package
under `clients/<document>` with no runtime dependency: each operation answers its outcome typed
by status, a refusal typed by the error codes its contract declares (`problem.code` is
`'UNKNOWN_TIME_ZONE' | 'VALIDATION_FAILED'`, not `string`), credentials are given per security
scheme, and `unwrap` with `isProblem` serve the code that prefers exceptions. A status the
contract does not declare throws `UnexpectedResponseError`, which reads the problem document of
a fault of the server: its `code` (`INTERNAL_ERROR`) and its `requestId`. An operation id that
is a reserved word or a name of the client is renamed (`deleteOperation`, `send2`). The command
records `"sdk"` in the config (`sdk.name`, `sdk.access`, see `docs/CONFIG.md`), tells the agents
in CLAUDE.md never to edit a client, and wires the project: `docs:generate` regenerates the
clients, `docs:check` fails while one differs from the contract, `ci:build` builds them, so the
GitHub and GitLab pipelines check them; publishing stays a manual step. Under npm, while
`package-lock.json` does not list a client, the command says to run `npm install` and
`sdk --check` fails, before `npm ci` refuses the lock in the pipeline. openapi-typescript with
openapi-fetch, hey-api and orval were measured on the example contract first: none reads the
error codes, and the first refuses TypeScript 6 (`docs/tools/client-sdk.md`). A project without
the key is unchanged: only with it does the ESLint preset leave out `clients/*/src/**`, and the
command add `!**/clients/*/src` to Biome.

## 0.5.0

**Migrations are named by a timestamp and what they do.** The generated `drizzle.config.ts`
sets `migrations: { prefix: 'timestamp' }`, and every `db:generate` requires a name:
`npm run db:generate add-invoices` writes `migrations/20261012093000_add-invoices.sql` (Drizzle),
`migrations/20261012093000_add-invoices.js` (Knex, from its ES module stub now set in
`knexfile.js`; the former default stub wrote CommonJS, which an ES module project cannot load),
`prisma/migrations/20261012093000_add_invoices/` (Prisma); TypeORM takes the path
(`npm run db:generate migrations/add-invoices`) and fixes its own form,
`<milliseconds>-add-invoices.ts`. The first Knex migration of a new project is
`00000000000000_initial.js`. Timestamps keep two branches from writing the same file, but
drizzle-kit's journal still conflicts, and its migrator applies only the entries newer than the
last one a database recorded: a migration merged after a later one was deployed is skipped
without an error (measured). The new rule `persistence/migration-history` reports a migration
without its number, two sharing one, a journal that does not match the files, entries out of
the order they were generated in, and two snapshots generated from the same parent; the merge
procedure is in `docs/tools/persistence.md`. Projects initialised before keep their
`0001_initial.js`: an applied migration is never renamed.

**The generated pipelines use free tools only.** CodeQL and dependency review (free on public
GitHub repositories, paid on private ones) and GitLab's SAST, Secret Detection (findings in a
merge request on Ultimate only) and Dependency Scanning (Ultimate) are no longer written by
default: `init --ci-extras codeql,dependency-review,gitlab-sast,gitlab-secret-detection,gitlab-dependency-scanning`
adds the ones a team wants, recorded as `ci.extras` in the config. `npm audit` and gitleaks
still block a vulnerable dependency or a committed secret on every plan. The table of every
tool, its class and its source is in `pipeline/README.md`. To keep a removed job in a project
initialised before: `init --force --ci-extras <names>`.

**The contracts are YAML by default, and the OpenAPI contract can be split.**
`npm run docs:generate` writes `openapi/openapi.yaml` and `docs/integration/asyncapi.yaml`
(`"openapi": { "format": "json" }` keeps JSON), with a deterministic YAML writer of the CLI
(`ddd-ts-kit/dist/contracts.js`) that the scripts of the project import. `openapi.documents`
splits the contract by route groups, contexts and tags into self-contained documents,
`openapi/<name>.yaml`; a route in no document stops the generation; `/docs` offers a selector
between them. `@ddd-ts-kit/http` adds `routesByDocument`, `openApiDocumentsRoutes` and the
`groups` of a controller route. A project initialised before: compare `scripts/openapi.ts`,
`scripts/events.ts` and `src/platform/http/with-documentation.ts` with what `init --force`
writes, run `npx ddd-ts-kit docs` (it writes `src/platform/http/openapi-documents.ts`), then
`npm run docs:generate`, which replaces the JSON contracts.

**Onboarding.** The root README starts with the recommended steps; `init` ends with the next
step of the method, the README and `CLAUDE.md` it writes list the steps, `status` points at
step 1 when there is no plan, and the `start` and `bootstrap` skills say plainly when a step is
skipped. A new guide, `docs/guides/commands.md`, gives the command or skill for each moment of a
project and the reference of every command and flag, generated from the help of the CLI and
held to it by a test.

## 0.4.1

- A project generated on a stack that tests against PGlite (knex, prisma, typeorm, audit) failed
  `npm install` with `ERESOLVE`: `@electric-sql/pglite-socket` 0.2.12 requires exactly
  `@electric-sql/pglite` 0.5.9, and both were written as caret ranges. The pair is now pinned to
  exact, matching versions, and Dependabot and Renovate move it as one group. The workspace root
  declares the pair as well: drizzle-orm and the copy of the example used by the conformance suite
  resolve them from there.

## 0.4.0

**A route is a controller class with one method.** One class per route; its decorator is the
single statement of the route, and the compiler holds `handle` to it:

```ts
@RouteGroup({ prefix: '/appointments', tags: ['scheduling'], guards: [Authenticated], errors: ['FORBIDDEN'] })
export class AppointmentsRoutes {}

@Controller({
  group: AppointmentsRoutes,
  method: 'POST',
  path: '/',
  summary: 'Book appointment',
  body,
  response: { status: 201, body: accepted },
  errors: ['SLOT_TAKEN'],
})
export class BookAppointmentController {
  constructor(
    private readonly commands: CommandBus,
    private readonly mapper: BookAppointmentMapper,
  ) {}

  async handle(request: HttpRequest<{ body: BookAppointmentBody }>): Promise<BookAppointmentAccepted> {
    return { id: await this.commands.execute(this.mapper.map(request)) };
  }
}
```

- `@ddd-ts-kit/http`: `Controller`, `RouteGroup`, `Guard`, `Authenticated`, `Public`, `HasRole`,
  `RequestMapper`, `Serializer`, `HttpRequest`, `controllerRoutes`, `controllerRoute`. A
  controller becomes a `Route`: the adapters, validation, problem documents, the error mapper
  and tracing are unchanged. `defineRoute` stays supported, and both forms run in one project.
- Route groups carry a prefix, tags, guards and error codes, and a child group inherits. A
  guard is a control at the edge; permissions stay on the use cases (`@Requires`). A controller
  with no group and no guard is refused: `guards: [Public]` says a route is open.
- `"stack.routes": "controllers" | "functions"` in the config, `init --routes`. A new project
  writes controllers; a config without the key is read as `functions` and nothing changes for
  it. `generate route` follows the key (`--group`, `--mapper`, `--serializer`), `generate
  controller` always writes a class, `generate route-group` and `generate guard` are new, and
  `ddd-ts-kit controllers [<context>] [--dry-run]` turns the function routes of a context into
  controllers, files moved and imports rewritten.
- `presentation/http/` has one folder per route, `<resource>/<use-case>/`, with the controller,
  its schemas (`*.params.ts`, `*.body.ts`, `*.accepted.ts`, `*.answer.ts`, `*.line.ts`), its
  `*.mapper.ts` and `*.serializer.ts`; groups are `<name>.routes.ts`, guards
  `guards/*.guard.ts`, shared schemas `shared/`.
- Controllers, guards, mappers and serializers are declared classes: `Edge` in
  `@ddd-ts-kit/kernel/declarations`, `DeclaredEdges` in `@ddd-ts-kit/di`, and discovery reads
  `presentation/`. The generated file of a context registers what each one is given, and a
  declared context lists no route.
- Rules: `presentation/controller-shape`, `presentation/controller-delegates`,
  `presentation/guard-at-the-edge`; `authz/declared` and `errors/known-code` read controllers.
- `describe` and the reference tables of `CONTEXT.md` list each route with its group and its
  guards, next to its use case and its permission.

**To do when upgrading.** Nothing for a project that keeps its function routes. A project
initialised before this version that writes its first controller adds one line to
`compose-application.ts`, which `ddd-ts-kit controllers` prints.

**The `detail` of a problem no longer quotes a private fact.** The message of a refusal built
by a factory is answered as `detail` unless it quotes a fact the factory did not expose; then
the client reads a sentence made from the code (`INVALID_EMAIL` gives `Invalid email.`), and the
message stays in logs and error reports. A client that parsed such a `detail` reads the `code`
and the exposed `facts` instead. `RequestContext` gains an optional `rawHeaders`.

## 0.3.0

**A domain error is built by a static factory named in the words of the business.** One error
class per concept of the language, one factory per refusal, instead of one class per error
built with `new`:

```ts
// domain/errors/appointment.error.ts
export class AppointmentError extends ConceptError {
  static slotTaken(calendarId: string, startsAt: Date) {
    return AppointmentError.refusal(
      'SLOT_TAKEN',
      `The slot starting at ${startsAt.toISOString()} on calendar ${calendarId} is already held.`,
      { calendarId, startsAt },
    ).exposing('startsAt');
  }
}

throw AppointmentError.slotTaken(calendar.id, slot.startsAt);
```

- `ConceptError` is a new export of `@ddd-ts-kit/kernel`, a `DomainError`. Its constructor is
  protected and a subclass declares none: a refusal exists only through a factory, which calls
  the protected `refusal(code, message, facts?)`. The codes of a class are a closed vocabulary
  the compiler derives from its factories: `CodeOf<typeof AppointmentError>`,
  `RefusalOf<typeof AppointmentError, 'SLOT_TAKEN'>`, and `AppointmentError.is(error, code?)`
  narrows to a union a `switch` on `error.code` exhausts, each case with its facts.
  `isRefusal(error, code?)` knows a refusal by its code whatever its class.
- The facts of a refusal travel with it, as data: `error.facts`. They are private. A factory
  names the ones a client may read, `.exposing('startsAt')`, and `@ddd-ts-kit/http` writes
  those, and no other, under `facts` in the problem document; the `Problem` schema of the
  OpenAPI document gains that optional member, which is the one change of a regenerated
  contract. `DomainError.toJSON()` answers `{ name, code, message }` and the exposed facts,
  never the stack or the cause. The audit trail, the spans and the error reports are unchanged:
  they key on the code.
- `@ddd-ts-kit/testing`: `expectRefusal(subject, code, facts?)` on an action, a `Result` or a
  caught error; `thenError(code, facts)` in a scenario; `expectProblem(response, { status,
  code, facts })`.
- `ddd-ts-kit generate error <context> <Concept> <refusal>` creates the error class of the
  concept when it is absent and adds a factory when it is there, with its case in the spec;
  run again, it changes nothing. The concept is a term of the glossary. It refuses a name such
  as `create`, a code that says something else than the name, and a code already set in the
  context.
- Five rules, under `"stack.refusals": "factories"` only. ESLint:
  `errors/through-factory` (no `new` of a class of `domain/errors/`),
  `errors/constructor-not-public`, `errors/factory-name` (a business phrase, and a code that
  says the same words: `slotTaken` setting `BOOKING_FAILED` is reported). `ddd-ts-kit check`:
  `errors/code-unique` (one refusal per code in a context) and `errors/known-code` (a route
  declares in `errors` only codes that exist). `language/glossary-term` now holds the name of
  an error class too.
- `CONTEXT.md` and `ddd-ts-kit describe` list the errors of a context: class, refusal, code
  and exposed facts.

**Nothing to do to upgrade.** `class SlotTakenError extends DomainError { readonly code =
'SLOT_TAKEN' }` and `new SlotTakenError(..)` keep working: `DomainError` is unchanged but for
`toJSON`. A config without `stack.refusals` is read as `classes`: `generate domain-error` still
writes one class per error there, and no `errors/*` rule reports. `init` writes
`"stack.refusals": "factories"` in a new project (`--refusals classes` for the other form),
where `generate domain-error` points to `generate error`.

**To move a project:** `npx ddd-ts-kit error-factories --plan` writes
`error-factories.plan.json` with the concept it proposes for each class (the aggregate its name
starts or ends with); give every entry its concept, then `npx ddd-ts-kit error-factories
--apply` writes the classes of the concepts with a factory per error (same parameters, same
message, the plain parameters as facts), merges the specs, rewrites every `new`, `thenError`,
`toThrow`, `expect.any`, `toBeInstanceOf`, `instanceof`, import and type, and sets the key. Then
`npm run format`. Left to a person, and listed by the command: which facts to expose, a
property of an error that became a fact (`error.personId` is `error.facts.personId`), a class
with members of its own.

Also:

- The `jest.config.js` that `init` writes compiled legacy decorators in every stack. It now
  follows the stack: `decoratorVersion: '2022-03'` where nothing needs the legacy ones,
  `legacyDecorator` and `decoratorMetadata` with class-validator or NestJS.
- The example application imports with `import type` every port and kernel type it only uses
  as a type, as the templates do; the generated declarations import the values.

## 0.2.0

**A class states its dependencies once, in its constructor.** In the declared style a
decorator no longer repeats what the constructor takes:

```ts
@CommandHandler(RegisterPersonCommand)
export class RegisterPersonHandler implements CommandHandler<RegisterPersonCommand> {
  constructor(
    private readonly personRepository: PersonRepository,
    private readonly clock: Clock,
  ) {}
}
```

- The constructor signature is the single statement of what a declared class depends on, for
  every declaring decorator: `@CommandHandler`, `@QueryHandler`, `@DomainEventHandler`,
  `@IntegrationEventHandler`, `@Scheduled`, `@Projection`, `@Repository`, `@Gateway`,
  `@Adapter`, `@Policy`. Each parameter is typed by one class, which is its injection token.
- No compiler metadata. `emitDecoratorMetadata` exists only with legacy decorators compiled by
  `tsc` or swc: it is absent with standard decorators and under `tsx` and esbuild, and it is
  `Object` for a port imported with `import type`. `ddd-ts-kit docs`, every `generate` and
  every start of `npm run dev` read the signatures from the sources and write
  `injected(Class, [Tokens])` statements in the generated file of each context:
  `<context>.declarations.ts`, after its exports, or `<context>.dependencies.ts` under
  discovery, which `discoverContext` loads with the role files. `@ddd-ts-kit/di` injects from
  there, in both decorator modes, whoever compiles. `injected` and `injectedDependencies` are
  new exports of `@ddd-ts-kit/kernel/declarations`, `declaredTokens` of `@ddd-ts-kit/di`.
- Three guards against a stale generated list. `declarations/barrel-current` and
  `ddd-ts-kit docs --check` fail when a constructor changed without regeneration, and now name
  the class. The `dev` script loads `ddd-ts-kit/dist/refresh-declarations.js` before the
  application, on every start and reload: a port added to a constructor is injected on the
  reload that follows the save. And `createApplication` refuses, by name, a class that takes
  parameters and has no list, or a list of another length: new `WiringError` codes
  `MISSING_DEPENDENCIES` and `DEPENDENCY_ARITY`. Nothing is injected as `undefined`.
- New rule `declarations/constructor-injection`, in `ddd-ts-kit check` and in the ESLint
  plugin: a constructor parameter of a declared class names exactly one class. An interface, a
  type alias, a union, a primitive, an optional or defaulted parameter, a rest parameter and a
  constructor inherited from a class of a package are refused, each with its fix; a value is
  carried, as before, by an abstract class bound in the platform.
  `ports/no-concrete-dependency` now also holds the types of constructor parameters.
- **A 0.1 project keeps working untouched.** A list written in a decorator,
  `@CommandHandler(Message, [Ports])`, is still read, still checked by the compiler and wins
  over the signature. New config key `stack.dependencies`: `signature`, which `init` writes
  (`init --dependencies listed` for the other), or `listed`, which is what a config without the
  key means and under which lists are never reported. To migrate: set
  `"dependencies": "signature"`, run `npx eslint . --fix` (the rule removes every list that
  repeats its constructor and reports the ones that differ), run `npx ddd-ts-kit docs`, and add
  `--import ddd-ts-kit/dist/refresh-declarations.js` to the `dev` script. Under discovery, add
  `src/contexts/*/*.dependencies.ts` to the entries of knip (inside the pattern of the role
  files, as `init` writes it) and to the orphan exceptions of dependency-cruiser (`ddd-ts-kit depcruise-config --write` does the second).
- In the types, the dependency list of every decorator is optional, and a decorator without a
  list accepts any constructor: the compiler no longer reports, at the decorator, a list that
  was forgotten. The list is derived instead, and the generated `injected(...)` is checked
  against the constructor as a written list was. A declaration read with `declarationOf`
  carries `dependencies: undefined` when its decorator lists nothing, where it carried `[]`.
- The explicit style stays explicit: `.toClass(Adapter, [Ports])` and
  `.handledBy(Handler, [Ports])` list what a class is given. NestJS and manual wiring are not
  concerned.
- A test assembles a context from its generated file, as the composition root does; to build
  one class alone, take it from that file
  (`contextModule('billing', { IssueInvoiceHandler: billing.IssueInvoiceHandler })`).

**Projections are a role of the CLI.** `application/projections/*.projection.ts` joins the
canonical tree (`tree/closed`, `naming/suffix`, `naming/one-concept-per-file`,
`test/spec-required`), the generated barrel exports a projector and registers what its
constructor takes, discovery, knip and dependency-cruiser know the suffix, and
`ddd-ts-kit describe` and the reference of `CONTEXT.md` list each projection with the events it
applies. New generator `ddd-ts-kit generate projection <context> <Name> <event-type>`
(declared style): a projector of an integration event of the context itself or of a declared
upstream, and its spec. A project that declared `application/projections` in
`extraDirectories` removes the entry and its deviation, runs `ddd-ts-kit docs` (its barrels
gain one line per projection) and gives each projection a spec, which `test/spec-required`
now asks for; a composition root or a test that
added projections to a context by name removes them, the barrel now brings them, and a handler
spec gives a fake to the read model a projection of its context writes.

**Imports without the `.js` extension, by default.** A new project imports its own files by
their alias and nothing else:

```ts
import { PersonRepository } from '@/contexts/identity/domain/repositories/person.repository';
```

- `importExtension` in `ddd-ts-kit.config.json` says how an import ends: `none`, which `init`
  now writes, or `js`, the previous spelling (`init --import-extension js`). Everything `init`
  and `generate` write follows it: every template, the declarations barrels, the published
  language indexes, the wiring of the composition root.
- With `none`, the generated `tsconfig.json` resolves as a bundler does (`"module": "ESNext"`,
  `"moduleResolution": "Bundler"`, `"customConditions": ["node"]`); a file that does not exist
  is still a compile error. Node needs the extension at run time, so `ddd-ts-kit build-aliases`,
  the second step of `npm run build`, now writes the full relative path with `.js` whichever
  spelling the sources use, and the output runs under plain `node` as before.
- New rule `imports/extension`, in `ddd-ts-kit check` and in the ESLint plugin, with a fix: an
  import of a file of the project ends as the config says. Under `none` it also refuses an
  import that names a directory: write `.../published-language/index`.
- `imports/alias-declared` holds what derives from the key: the two resolution options of
  `tsconfig.json`, the pattern of the jest mapping, and the build step.

**Nothing breaks.** A config file without `importExtension`, which is every project generated by
0.1.x, is read as `js`: its imports, its `tsconfig.json`, its jest mapping and its build are
judged and rewritten exactly as before, and `init` run again keeps that spelling. To move such a
project: set the key to `none`, write the two compiler options `ddd-ts-kit check` then asks
for, run `eslint --fix` and the formatter ([docs/CONFIG.md](docs/CONFIG.md)).

One behaviour of `build-aliases` is stricter in both spellings: a specifier names one emitted
file, by the path the config's spelling gives. It used to fall back to `<specifier>.js` and to
`<specifier>/index.js`, which no generated project relied on, since the compiler refused both
under `NodeNext`. It now says what to write instead.

Also:

- **`init --force` keeps the config.** It used to write the config anew: the declared contexts,
  the rules, the limits and the deviations were dropped, and the composition root no longer
  assembled anything. It now changes in the config the stack choices its flags name and nothing
  else, and wires the declared contexts again into the files it rewrites.
- `init` run again on a pnpm project no longer adds every agent permission a second time to
  `.claude/settings.json`.
- The checker and the ESLint plugin read an import written without its extension as the same
  source file as with it, whatever dots its name holds (`invoice.aggregate`): the layer and
  context rules judge both spellings alike.

## 0.1.1

**A project is green from its first minute.** In 0.1.0, `npx ddd-ts-kit init`, the install and
`verify`, which is what `init` tells you to run, failed on a project nothing had been generated
in. Fixed in the generator, and held by an end-to-end spec that runs that exact sequence on both
package managers and on every proven stack, with no context, one, several, and a first use case:

- `init` writes the generated contracts as the scripts of the project write them for a project
  without a route or an integration event of its own (`openapi/openapi.json`,
  `docs/integration/asyncapi.json`, `docs/integration/event-catalog.md`): `docs:check` passes at
  once and the first commit holds the contract. A contract that is already there is left alone.
- The dead-code gate passes on an empty project. The helper `ownPolicy`
  (`platform/resilience/own-policy.ts`) is written with the first adapter that uses it
  (`generate adapter`) instead of by `init`, where nothing imported it on tsyringe; knip is told
  what it enters a context by with the first context, and reads the fakes as entries of the test
  runner, so that it has no remark about its own configuration either.
- A project without a context has a spec to run and passes its linter: the proof that the
  platform wires alone is written by `init` (`test/architecture/extractable.spec.ts`), which each
  context then joins, and the composition root imports `contextModule` or `discoverContext` with
  the first context instead of before it.
- The integration run of the pipeline passes while the project has no integration spec yet.
- Under `--assembly discovery`, a context that was just declared and has no role file yet is
  discovered as an empty context (`@ddd-ts-kit/di`): it used to stop the application, the specs
  and the documents with `DISCOVERY_FAILED`.

In a project created with 0.1.0, nothing has to change: these fixes are about what `init` writes.
`generate adapter` now counts as writing a shared file for the first adapter of a project wired on
tsyringe (`--local-only` refuses it once, naming the file).

Also since 0.1.0:

- **pnpm by default.** `init` writes a project for pnpm, pinned in `package.json` and provided by
  corepack, unless `--package-manager npm`: every script, pipeline, hook, the Dockerfile, the
  guidance and the agent permissions are said in the words of the manager chosen.
- **`ddd-ts-kit affected`.** A pull or merge request runs the unit specs, the integration specs
  and the lint of the contexts its change reaches through the context map; the generated
  pipelines call it, and the default branch and the nightly schedule run everything.
- The release is published through npm trusted publishing (OIDC), with provenance and without a
  stored token.

## 0.1.0

First publication to the npm registry: the CLI `ddd-ts-kit` and the 23 packages `@ddd-ts-kit/*`.
