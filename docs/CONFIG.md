# `ddd-ts-kit.config.json`

Read by the CLI, the ESLint plugin, the editor hook and the skills. It lives at the root of
the consuming project. `ddd-ts-kit init` writes it; `generate context`, `generate service`,
`generate worker` and `generate adr --deviation` edit it; `ddd-ts-kit check` reports what is
inconsistent in it as `config/valid`.

The example below is what `init --context billing:core --context catalog:supporting` writes,
after `generate context shipping --classification supporting --upstream billing`. It holds no
deviation.

```json
{
  "sourceRoot": "src",
  "contextsDir": "src/contexts",
  "sharedKernelDir": "src/shared-kernel",
  "platformDir": "src/platform",
  "importAlias": "@/",
  "stack": {
    "http": "express",
    "validation": "zod",
    "di": "tsyringe",
    "events": "outbox",
    "orm": "drizzle",
    "database": "postgres",
    "tests": "vitest",
    "docsUi": "swagger",
    "ci": "github",
    "authn": "jwt",
    "authz": "rbac",
    "broker": "none",
    "cache": "none",
    "audit": "on",
    "errors": "none",
    "logger": "stdout",
    "style": "declared",
    "assembly": "barrel"
  },
  "contexts": {
    "billing": { "classification": "core", "upstreams": [] },
    "catalog": { "classification": "supporting", "upstreams": [] },
    "shipping": {
      "classification": "supporting",
      "upstreams": [{ "context": "billing", "relationship": "published-language" }]
    }
  },
  "rules": {},
  "domainAllowedPackages": ["@ddd-ts-kit/kernel"],
  "applicationAllowedPackages": ["@ddd-ts-kit/kernel", "@ddd-ts-kit/auth"]
}
```

## Paths

| Key | Meaning | Default |
|---|---|---|
| `sourceRoot` | where the sources live | `src` |
| `contextsDir` | the bounded contexts, one directory each | `<sourceRoot>/contexts` |
| `sharedKernelDir` | the shared kernel | `<sourceRoot>/shared-kernel` |
| `platformDir` | the technical platform | `<sourceRoot>/platform` |
| `importAlias` | the prefix that names `sourceRoot` in imports: `@/`, or `$`, one name in lower case (letters, digits, hyphens) and `/`. Every file of the project is imported by it (`imports/alias-only`) | `@/` |

`importAlias` is the one place a person writes the alias. `init` (flag `--import-alias`)
derives the `paths` of `tsconfig.json` from it, and `ddd-ts-kit build-aliases` reads it when it
rewrites the compiled output; `ddd-ts-kit check` compares them and everything that has to
follow (`imports/alias-declared`). Only a prefix that cannot be the name of a package is
accepted: `#<name>/` is refused (a Node subpath import is another mechanism), `@<name>/` is
refused (it is how the packages of a scope are named, and dependency-cruiser would resolve an
installed one first), and so is a bare `name/`. `$test/`, `$scripts/` and `$generated/` are
taken: they name `test/`, `scripts/` and the client Prisma generates, and are not configurable.
To rename the alias of an existing project: change the key, write the `paths` entry the finding
gives, and replace the prefix in the sources. See [tools/import-aliases.md](tools/import-aliases.md).

## Stack

The "Default" column is what `ddd-ts-kit init` writes when the flag is left out. A value
outside the list stops every command with the list of accepted values.

| Key | Values | Default |
|---|---|---|
| `stack.http` | `express`, `fastify`, `nest`, `none` | `express` |
| `stack.validation` | `zod`, `class-validator`, `standard-schema`, `none` | `zod` |
| `stack.di` | `tsyringe`, `nest`, `manual`; `init` accepts `nest` with `http: nest` and only with it | `tsyringe` (`nest` when `http` is `nest`) |
| `stack.events` | `in-memory`, `outbox`, `custom`; `init` offers `in-memory` and `outbox` | `outbox` when an ORM is set (anything else then needs a `stack.events` deviation), `in-memory` otherwise |
| `stack.orm` | `drizzle`, `knex`, `prisma`, `typeorm`, `custom`, `none` | `drizzle` (`none` with `database: none`) |
| `stack.database` | `postgres`, `mysql`, `sqlite`, `mongodb`, `none`. The generated adapters are written for PostgreSQL: `init` refuses another database with `drizzle`, `knex`, `prisma` or `typeorm`, and its `--database` flag does not offer `mongodb` | `postgres` with one of the four ORMs, `none` otherwise |
| `stack.tests` | `vitest`, `jest` | `vitest` |
| `stack.docsUi` | `swagger`, `scalar`, `redoc`, `none` | `swagger` (`none` when `http` is `none`) |
| `stack.ci` | `github`, `gitlab`, `both`, `none` | `github` |
| `stack.authn` | `jwt`, `keycloak`, `none` | `jwt` |
| `stack.authz` | `rbac`, `abac`, `rebac`, `custom` | `rbac` |
| `stack.broker` | `none`, `rabbitmq`, `kafka`, `nats`, `redis` (Redis Streams), `custom`; `init` refuses a broker without an ORM, since a broker is reached through the outbox | `none` |
| `stack.cache` | `none`, `redis`: what backs the kernel `Cache` port, the wake-up of the outbox relay, the rate limiter and the lock of the scheduled jobs | `none` |
| `stack.audit` | `on`, `off`: whether the audit trail is wired | `on` when an ORM is set, `off` otherwise |
| `stack.errors` | `none`, `sentry`: where unexpected failures are reported; `sentry` binds the kernel `ErrorReporter` to `@ddd-ts-kit/sentry` (Sentry or GlitchTip) | `none` |
| `stack.logger` | `stdout`, `pino`, `winston`: what implements the kernel `Logger` port | `stdout` |
| `stack.style` | `declared`: each class declares what it is with a decorator and a context has no module file; `explicit`: every binding is written in `<context>.module.ts`. `init` accepts `declared` with `di: tsyringe` only | `declared` with `di: tsyringe`, `explicit` otherwise |
| `stack.assembly` | `barrel`, `discovery`: how a declared context reaches the composition root, one generated `<context>.declarations.ts` or a scan at startup. `init` accepts the flag in the declared style only | `barrel` |

A config file that omits a `stack` key is read with the same defaults, with one exception:
without `stack.style` the project is read as `explicit`, whatever `stack.di` says, because
such a file was written before the declared style existed.

## Contexts

| Key | Values | Default |
|---|---|---|
| `contexts.<name>.classification` | `core`, `supporting`, `generic` | required |
| `contexts.<name>.upstreams[]` | a context name, or `{ "context", "relationship" }` | `[]` |
| `contexts.<name>.upstreams[].relationship` | `published-language`, `customer-supplier`, `conformist`, `anti-corruption-layer`, `open-host-service`, `shared-kernel` | `published-language` |
| `contexts.<name>.extraDirectories[]` | a path inside the context, or `{ "path", "reason" }`: a directory added to the canonical tree. Each one is a deviation | `[]` |
| `contexts.<name>.deployable` | `true`, `false`: the context has its own entry point `src/apps/<name>/main.ts`; `generate service <name>` sets it | `false` |

The contexts of the config and the directories of `contextsDir` must be the same set.

## Rules and limits

| Key | Values | Default |
|---|---|---|
| `rules.<id>` | `error`, `warn`, `off`, for a rule id of [ARCHITECTURE.md](ARCHITECTURE.md) section 3 (`ddd-ts-kit rules` lists them) | the severity `ddd-ts-kit rules` prints: `error`, except the seven rules that default to `warn` |
| `limits` | `{ "maxParameters": 3, "maxFunctionLines": 30 }`, read by `clean/function-size`; `maxFunctionLines` is at most 100, a larger value is read as 100 and reported | as shown |
| `onePerFile.allow` | `[{ "file": "<path or glob>", "reason": "<why these exports are one thing>" }]`: exempts a file from the count of `clean/one-export-per-file`, never from its file name check. An entry without `file` or without `reason` allows nothing and is reported | `[]` |
| `standardInterfaces` | `{ "<DeclaredName>": "<kernel interface to use instead>" }`, merged over the default names of `standard/no-parallel-interface`; `false` drops a default name | `{}` |
| `coverage` | `{ "<layer>": { "<rate>": <0 to 100> } }` for the layers `domain`, `application`, `presentation`, `infrastructure` and the rates `statements`, `branches`, `functions`, `lines`: the minimum test coverage of each layer, applied to every context. A rate left out is the reference; a rate that is not a percentage, an unknown layer or an unknown rate is reported (`config/valid`). `init` does not write the key: the reference applies until a project changes a rate | domain 90, 85, 90, 90; application 85, 80, 85, 85; presentation 80, 70, 80, 80; infrastructure 70, 60, 70, 70 |
| `domainAllowedPackages` | packages `domain/` may import | `["@ddd-ts-kit/kernel"]` |
| `applicationAllowedPackages` | packages `application/` may import | `["@ddd-ts-kit/kernel", "@ddd-ts-kit/auth"]` |
| `publishedLanguageAllowedPackages` | packages `published-language/` may import | `@ddd-ts-kit/kernel`, `@ddd-ts-kit/events`, `@ddd-ts-kit/validation` and the schema library of `stack.validation` (`zod`; `class-validator` with `class-transformer`; none for `standard-schema` and `none`) |

`@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis`, `@ddd-ts-kit/scheduling`,
`@ddd-ts-kit/sentry` and `@ddd-ts-kit/tracing` stay refused in `domain/` and `application/`
even when listed in an allow-list.

## Working agreements

| Key | Values | Default |
|---|---|---|
| `commit` | `{ "maxFiles": 20, "maxLines": 600 }`: advised size of one commit, read by `ddd-ts-kit check --commit-size` (advisory, `--strict` exits 1) and by the editor hook (a reminder, never blocking). Generated files are not counted. A limit that is not a positive integer is read as its default and reported | as shown |
| `guard` | `enforce`, `advise`, `off`: how the editor hook of the plugin reacts to a violation. The environment variable `DDD_TS_KIT_GUARD` takes precedence over it | `enforce` |
| `worker` | `true`, `false`: the project has `src/apps/worker/main.ts`; scheduled jobs then run there and not in the API process. `generate worker` sets it | `false` |
| `deviations[]` | `{ "what", "adr", "reason" }`: a recorded exception; `adr` names an existing `docs/adr/<number>-*.md` | `[]` |

## Deviations

These settings relax the reference, and `governance/recorded-deviation` reports each one that
has no entry in `deviations`:

| Setting | `what` of its deviation |
|---|---|
| a rule set to `off`, or to `warn` when its default is `error` | `rules.<id>` |
| an extra directory in a context | `contexts.<name>.extraDirectories.<path>` |
| a package added to an allow-list | `domainAllowedPackages.<package>`, `applicationAllowedPackages.<package>`, `publishedLanguageAllowedPackages.<package>` |
| a coverage threshold under the reference | `coverage.<layer>.<rate>`, for example `coverage.infrastructure.branches` |
| a guard that is not `enforce` | `guard` |
| an ORM with events off the outbox | `stack.events` |

`npx ddd-ts-kit generate adr "<title>" --deviation <what> --reason "<why>"` writes the
decision record and the entry together.

## Coverage thresholds

The test runner config writes no number: it spreads `governedCoverage(mode)` (`governedJestCoverage()`
under jest) of `@ddd-ts-kit/testing/coverage`, which reads the `coverage` key each time a run
starts. One place holds a threshold, and `check` holds that place.

```json
"coverage": { "domain": { "branches": 95 }, "infrastructure": { "branches": 50 } },
"deviations": [
  { "what": "coverage.infrastructure.branches", "adr": "0011", "reason": "The failure branches of the driver are held by its contract suite." }
]
```

| Layer | Reference (statements, branches, functions, lines) | Why this floor |
|---|---|---|
| `domain` | 90, 85, 90, 90 | the highest: pure code that needs no double and holds the rules of the business; nothing but a missing test keeps a line from running |
| `application` | 85, 80, 85, 85 | handlers orchestrate through ports, each with a fake: every path is reachable, a few are wiring |
| `presentation` | 80, 70, 80, 80 | mapping and status translation; the error paths of a transport are also held by the end-to-end specs, which are not measured |
| `infrastructure` | 70, 60, 70, 70 | the lowest: the failure branches of a driver are hard to provoke and are not the adapter's to prove; what an adapter promises is held by the contract suites of the integration specs |

- **Raising a rate is free. Lowering one under the reference is a deviation** (`governance/recorded-deviation`) with its decision record.
- **Each context is held on its own**: the thresholds of a layer apply to `contexts/<name>/<layer>/` of every context, so a well tested context does not hide another.
- **An empty layer is held to nothing, and to its threshold from its first source file** (a spec or a document is not one). A project just initialised passes; the first route of a context brings the presentation floor with it.
- **A run is held to the layers it executes**: `npm run test:coverage`, the run of `verify`, executes every spec and measures the four layers; in the pipeline `ci:test:unit` (`--mode unit`) measures domain, application and presentation, `ci:test:integration` (`--mode integration`) measures infrastructure. Jest runs every spec in one run.
- **The measure cannot be narrowed quietly** (`test/coverage-governed`): no `include`, `exclude` or `thresholds` by hand in the runner config, no such flag in a script, no `v8 ignore` or `istanbul ignore` comment without `-- ADR-NNNN: <reason>`.
- Under the legacy decorator mode the generated Vitest config lists `decoratorCoverage()` of `@ddd-ts-kit/testing/vitest`: the statements the transform writes to apply decorators hold a branch per named type that no test can take, and are kept out of the measure.

## Limits

The parser is tolerant: a key it does not know is ignored without a message, and a wrong
classification, relationship, rule id, guard mode or coverage rate is reported by `check` as `config/valid`,
not when the file is read. Only a wrong `stack.*` value, or a file that is not a JSON object,
stops a command.
