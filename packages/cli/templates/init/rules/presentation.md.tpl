---
paths:
  - "{{config.contextsDir}}/*/presentation/**"
  - "openapi/**"
  - "scripts/openapi.ts"
---

# Presentation layer

- A route validates the shape of the input, builds a command or a query with the actor, executes it through `CommandBus` or `QueryBus` (never a handler class) and maps the answer. Nothing else.
- Imports `application/` (and domain types for mapping), never `infrastructure/` (`layer/presentation-no-infrastructure`).
- Input shape is validated here with the schema library of the project, behind the `Schema` port. Business rules are not validated here.
- Every route declares its `security`, or `security: false`, and the `DomainError` codes it can answer in `errors`; the mapping from code to status lives in one place, the error mapper.
- No role or ownership test here (`authz/in-application`): the bus asks for the permission, a policy decides on loaded state.
- Request and response types are presentation types (`*.dto.ts`): never an aggregate, never a row.
- Never put the message of an unexpected failure in a response or a log.
- Files: `*.route.ts` (or `*.controller.ts`) and `*.dto.ts` in `presentation/http/` (`naming/suffix`).
- After a change, `npm run docs:generate` regenerates `openapi/openapi.json`, committed with the route; CI fails on a difference. Never edit it by hand.
- Contract with `/ddd-ts-kit:document`. Create with `npx ddd-ts-kit generate route <context> <UseCase> --method <M> --path <p> --json`, then `generate e2e <context> <UseCase>`.
