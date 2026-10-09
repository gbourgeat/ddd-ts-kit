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
| `stack.events` | `in-memory`, `outbox`, `custom` | `in-memory` (`outbox` when a database is set) |
| `stack.orm` | `drizzle`, `knex`, `prisma`, `typeorm`, `custom`, `none` | `drizzle` |
| `stack.database` | `postgres`, `mysql`, `sqlite`, `mongodb`, `none` | `postgres` |
| `stack.tests` | `vitest`, `jest` | `vitest` |
| `contexts.<name>.classification` | `core`, `supporting`, `generic` | required |
| `contexts.<name>.upstreams[].relationship` | `published-language`, `customer-supplier`, `conformist`, `anti-corruption-layer`, `open-host-service`, `shared-kernel` | `published-language` |
| `rules.<id>` | `error`, `warn`, `off` | `error` |

Rule ids are those of [ARCHITECTURE.md](ARCHITECTURE.md) section 3.
