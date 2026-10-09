# `ddd-ts-kit.config.json`

Read by the CLI, the hook and the skills. It lives at the root of the consuming project.

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
    "events": "in-memory",
    "orm": "drizzle",
    "database": "postgres",
    "tests": "vitest"
  },
  "contexts": {
    "billing": {
      "classification": "core",
      "upstreams": [
        { "context": "catalog", "relationship": "published-language" }
      ],
      "extraDirectories": []
    },
    "catalog": { "classification": "supporting", "upstreams": [] }
  },
  "rules": {
    "naming/suffix": "error",
    "test/spec-required": "warn"
  },
  "domainAllowedPackages": ["@ddd-ts-kit/kernel"],
  "applicationAllowedPackages": ["@ddd-ts-kit/kernel"]
}
```

| Key | Values | Default |
|---|---|---|
| `stack.http` | `express`, `fastify`, `nest`, `none` | `express` |
| `stack.validation` | `zod`, `class-validator`, `standard-schema`, `none` | `zod` |
| `stack.di` | `tsyringe`, `nest`, `manual` | `tsyringe` (`nest` when `http` is `nest`) |
| `stack.events` | `in-memory`, `outbox`, `custom` | `outbox` when an ORM is set (anything else then needs a `stack.events` deviation), `in-memory` otherwise |
| `stack.orm` | `drizzle`, `knex`, `prisma`, `typeorm`, `custom`, `none` | `drizzle` |
| `stack.database` | `postgres`, `mysql`, `sqlite`, `mongodb`, `none` | `postgres` |
| `stack.tests` | `vitest`, `jest` | `vitest` |
| `stack.authn` | `jwt`, `keycloak`, `none` | `jwt` |
| `stack.cache` | `none`, `redis`: what backs the kernel `Cache` port, the HTTP rate limiter and the wake-up of the outbox relay (Redis, Dragonfly or Valkey) | `none` |
| `stack.audit` | `on`, `off`: whether the audit trail and its three sources are wired | `on` when an ORM is set, `off` otherwise |
| `standardInterfaces` | `{ "<DeclaredName>": "<kernel interface to use instead>" }` merged over the default names of `standard/no-parallel-interface`; `false` drops a default name | `{}` |
| `stack.authz` | `rbac`, `abac`, `rebac`, `custom` | `rbac` |
| `stack.broker` | `none`, `rabbitmq`, `custom` | `none` |
| `stack.ci` | `github`, `gitlab`, `both`, `none` | `github` |
| `stack.docsUi` | `swagger`, `scalar`, `redoc`, `none` | `swagger` |
| `contexts.<name>.deployable` | `true`, `false`: the context has its own entry point `src/apps/<name>/main.ts` | `false` |
| `applicationAllowedPackages` | package names | `["@ddd-ts-kit/kernel", "@ddd-ts-kit/auth"]` |
| `limits` | `{ "maxParameters": 3, "maxFunctionLines": 30 }` | as shown |
| `guard` | `enforce`, `advise`, `off`: how the editor hook of the plugin reacts | `enforce` |
| `deviations[]` | `{ "what", "adr", "reason" }`: a recorded exception. `what` is `rules.<id>`, `contexts.<name>.extraDirectories.<path>`, `domainAllowedPackages.<package>`, `applicationAllowedPackages.<package>`, `publishedLanguageAllowedPackages.<package>`, `guard` or `stack.events`; `adr` names an existing `docs/adr/<number>-*.md` | `[]` |
| `contexts.<name>.classification` | `core`, `supporting`, `generic` | required |
| `contexts.<name>.upstreams[].relationship` | `published-language`, `customer-supplier`, `conformist`, `anti-corruption-layer`, `open-host-service`, `shared-kernel` | `published-language` |
| `rules.<id>` | `error`, `warn`, `off` | `error` |

Rule ids are those of [ARCHITECTURE.md](ARCHITECTURE.md) section 3.

A relaxed rule, an extra directory, an extra allowed package, a guard that is not `enforce`
or events off the outbox are deviations: each needs an entry in `deviations` pointing to a
decision record (`npx ddd-ts-kit generate adr "<title>" --deviation <what>` writes both).

`@ddd-ts-kit/aspects`, `@ddd-ts-kit/audit`, `@ddd-ts-kit/redis` and `@ddd-ts-kit/tracing` stay
refused in `domain/` and `application/` even when listed in an allow-list.
