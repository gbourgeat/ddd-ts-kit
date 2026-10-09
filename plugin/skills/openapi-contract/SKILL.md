---
name: openapi-contract
description: >-
  Owns the OpenAPI 3.1 contract generated from route definitions, whatever the HTTP
  framework and validation library. Use when adding or changing a route, a request or
  response schema or an error code, when the user asks for the API contract, Swagger, the
  docs UI or client generation, or when CI reports OpenAPI drift.
allowed-tools:
  - Bash(npm run openapi:generate)
  - Bash(npm run openapi:check)
  - Bash(git diff *)
---

# OpenAPI contract

The contract is an output of the code: `openapi/openapi.json` is generated from the route
definitions (`@ddd-ts-kit/http`) and committed. Never edit it by hand.

## Change a route

1. Edit the route definition: `operationId` (stable, unique, verb + noun), `summary`,
   request schemas, one entry per response status, and `errors` listing every domain error
   code the use case can raise.
2. Schemas describe shape and format only. Business rules stay in the domain.
3. Response schemas are presentation DTOs. Never return an aggregate or an application
   object as is: map it, so the contract does not move when the model does.
4. Regenerate and read the diff:
   ```bash
   npm run openapi:generate
   git diff -- openapi/
   ```
5. Commit code and contract together. CI runs `npm run openapi:check` and fails on drift.

## Breaking or not

| Change | Breaking |
|---|---|
| new optional request field, new response field, new route | no |
| new required request field, stricter validation, removed or renamed field, changed type | yes |
| new error code or status on an existing route | yes for clients that enumerate errors |
| new enum value in a response | yes for clients with exhaustive switches |

A breaking change needs a new route version or a deprecation period (`deprecated: true` on the
old route), and a look at every known consumer before merging. Tightening validation on a
deployed API breaks clients that were sending what used to be tolerated.

## Closed vocabularies

A field with a fixed set of values is declared as an enum in the schema, so that clients get
a type and never display raw values.

## Clients

Generate clients from the committed file with the tool of your choice
(`openapi-typescript`, `orval`, `openapi-generator`); the generation is deterministic, so the
file is a stable input.
