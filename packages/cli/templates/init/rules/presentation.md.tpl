---
paths:
  - "{{config.contextsDir}}/*/presentation/**"
  - "openapi/**"
  - "scripts/openapi.ts"
---

# Presentation layer

- A route validates the shape of the input, builds a command or a query, executes it through `CommandBus` or `QueryBus` (never a handler class) and maps the answer. Nothing else.
- Imports `application/` (and domain types for mapping), never `infrastructure/` (`layer/presentation-no-infrastructure`).
- Input shape is validated here with the schema library of the project, behind the `Schema` port. Business rules are not validated here.
- Declare the `DomainError` codes a route can answer in `errors`; the mapping from code to status lives in one place, the error mapper.
- Never put an error message of an unexpected failure in a response or a log.
- Files: `*.route.ts` (or `*.controller.ts`) and `*.dto.ts` in `presentation/http/` (`naming/suffix`).
- `openapi/openapi.json` is generated from the route definitions by `npm run docs:generate` and committed; CI fails on a difference. Never edit it by hand.
- Contract with `/ddd-ts-kit:openapi-contract`; scaffold with `npx ddd-ts-kit generate route <context> <UseCase> --method <M> --path <p>`.
