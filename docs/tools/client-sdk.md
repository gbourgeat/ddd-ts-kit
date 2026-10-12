# Client SDK: a typed client from the OpenAPI contract

**Summary.** A project of the kit writes its OpenAPI contract from its routes
(`openapi/openapi.yaml`, or one file per document of `openapi.documents`). The callers of the API
(a front end, another team, a partner, the end-to-end specs of the project itself) want a typed
client of that contract, current with it, that refuses what the API refuses in the words of its
error codes. Three maintained generators were measured on the contract of the example
application. None of them reads the error codes the contract declares per status, two of them
add an install of 35 to 73 MB to the project, and one of them refuses the TypeScript version the
projects of the kit use. The kit therefore writes the client itself: `ddd-ts-kit sdk`, with no
dependency to install and none for the consumer. This page gives the measures, the decision, and
how the generated client is used, checked and published.

## What a client of a kit contract has to do

The contract of the example (`examples/scheduling/openapi/openapi.yaml`, 25 operations) shows
what a client must carry:

- **Refusals as data.** Every refusal is a problem document (RFC 9457,
  `application/problem+json`) with a stable `code`. Each response lists the codes it may carry
  in `x-error-codes`: `POST /practices` answers `404` with `PERSON_NOT_REGISTERED`, `422` with
  `UNKNOWN_TIME_ZONE` or `VALIDATION_FAILED`. A caller branches on the code, so the client should
  type `problem.code` as exactly those codes, per status.
- **Security per operation.** Most operations require the `bearer` scheme, a few are public.
- **Split documents.** With `openapi.documents`, a contract is several self-contained files: a
  public API and a back office get one client each.
- **Query parameters as written.** Filters are named `filter[status]`, lists are repeated.
- **Many consumers.** A browser bundle, a Node service, the end-to-end specs: no runtime
  dependency, and what a bundle does not call should not be in it.

## Comparison

Measured on 2026-10-12 on the example contract, versions read from npm the same day, every
generator with its documented defaults (`openapi-fetch` for openapi-typescript, the fetch client
for orval). Sizes are minified with esbuild 0.28; "one operation" bundles `getAppointment` and
what it needs. Install sizes include TypeScript 6 (24 MB), which every project of the kit
already installs.

| | openapi-typescript + openapi-fetch | @hey-api/openapi-ts | orval | `ddd-ts-kit sdk` |
|---|---|---|---|---|
| Version, licence | 7.13.0 and 0.17.0, MIT | 0.99.0, MIT | 8.41.0, MIT | the CLI, MIT |
| Installed to generate | 35 packages, 45 MB | 46 packages, 35 MB | 60 packages, 73 MB | nothing: the CLI the project has |
| Installs next to TypeScript 6 | no: its peer range is `typescript@^5.x`, `npm install` stops on ERESOLVE | yes | yes | yes |
| Output on the example | one `.d.ts` of 80 kB, types only | 16 files, 110 kB, half of it a copied runtime | one file of 68 kB | 6 files, 66 kB, and a README |
| Runtime dependency of the consumer | `openapi-fetch` and its helper package | none (runtime copied) | none | none |
| Whole client, minified (gzip) | 6.6 kB (2.6 kB): the runtime, the paths are types | 13.6 kB (4.5 kB) | 13.9 kB (2.2 kB) | 10.1 kB (2.8 kB) |
| One operation, minified | the whole runtime, 6.6 kB | 9.6 kB | 0.2 kB | 2.4 kB |
| Error codes of `x-error-codes` | lost: `code: string` | lost: `code: string` | lost: `code: string` | typed per status: `Failure<422, 'UNKNOWN_TIME_ZONE' \| 'VALIDATION_FAILED', Problem>` |
| Outcome discriminated by status | yes, `{ data, error, response }` | yes with `throwOnError: false` | yes, `{ data, status }` | yes, `{ ok, status, data \| problem }` |
| Security of the contract | not read: a middleware sets the header | per operation, an `auth` callback | not read: no credential is attached | per operation and scheme, a value or a function per scheme |
| Split documents | one run per file | one run per file | one target per file | one client per document, from `openapi.documents` |
| Base URL | an option | an option | none: relative URLs, a mutator to add one | an option |
| Maintenance | active, stable major | active, still 0.x: breaking changes between minors | active, frequent releases | released with the kit, held by its specs |

None of the three reads `x-error-codes`: a vendor extension, which they leave in comments
(openapi-typescript and hey-api copy the description "Error codes: ..." into JSDoc). Getting the
codes into the types would mean a second generator over theirs, plus their install, plus, for
openapi-typescript, an override of its peer range in every project. The contracts the kit
writes use a known subset of OpenAPI 3.1 (JSON request bodies, JSON and problem responses,
component schemas, HTTP and API key schemes), because the kit writes them: a generator of that
subset is a few hundred lines that the CLI, which has no runtime dependency, can carry.

## The decision

`ddd-ts-kit sdk` generates the clients. It reads the committed contract (YAML or JSON, as
`openapi.format` says), so it needs no build and no network, and the same command answers
`--check` for the pipeline.

When the contract comes from somewhere else, or when the team wants React Query hooks, Zod
schemas or mocks generated with the client, orval and hey-api are the better tools: they cover
OpenAPI broadly and have plugins for those. Run them on `openapi/*.yaml` like any other
contract; the kit does not stand in the way.

## What is generated

`init --sdk` asks for the clients in a new project; `npx ddd-ts-kit sdk` asks for them in an
existing one (it records `"sdk"` in ddd-ts-kit.config.json, see [CONFIG](../CONFIG.md), appends
to CLAUDE.md the instruction `init --sdk` writes for the agents, never to edit a client, and
says to add `clients/**` to the paths of `.claude/rules/presentation.md`).
For each document of the contract, a workspace package:

```text
clients/
  tsconfig.json          builds every client: tsc -b clients
  api/                   the whole contract; a split contract gives clients/<document>
    package.json         name from "sdk.name"; the version is the team's
    README.md            use, operations, error codes, how to publish
    tsconfig.json        ES modules, declarations, DOM types: a browser and Node alike
    src/
      index.ts           what the package exports
      client.ts          createClient(), connect(), the security schemes
      operations.ts      per operation: its input type, its outcome type, its function
      errors.ts          ERROR_CODES, ErrorCode, isErrorCode(), isProblem()
      schemas.ts         one type per component schema
      runtime.ts         the same for every contract: request, credentials, answer
```

A split contract (`openapi.documents`) gives `clients/<name>` for each document, a document
named `openapi` included; two contract files that would write one client (`openapi.yaml` and a
stray `api.yaml` in a contract that is not split) are refused with both names.

Every file but package.json is rewritten by each run; package.json keeps its version and every
key the team adds, and only the name, the entry points, the build script and
`publishConfig.access` follow the config.

The command also wires the project, and running it again changes nothing:

- the clients are workspace packages (`"workspaces"` in package.json, `pnpm-workspace.yaml`
  under pnpm). npm lists each one in `package-lock.json`, and `npm ci` refuses a lock that
  misses one: while the lock of an npm project does not list a client (the first run, a new
  document of a split contract, a new `sdk.name`), the command says to run `npm install` and
  commit the lock, and `sdk --check` fails. pnpm accepts a new workspace package in a frozen
  install;
- the name of each client resolves to its sources in the `paths` of `tsconfig.json`, which the
  type check, Vitest, tsx and knip read: a spec imports the client by its package name, as a
  consumer would, without a build first;
- their sources are left out of Biome and knip, which would read generated code as code written
  by hand, and of the ESLint preset, which does so when the config has `"sdk"`: a project
  without the key keeps linting and formatting whatever it has under `clients/`;
- the scripts: `sdk:generate`, `sdk:build`; `docs:generate` regenerates the clients after the
  contract, `docs:check` and `ci:docs` compare them, `ci:build` builds them.

### Use

```ts
import { createClient, isProblem, unwrap } from 'scheduling-api-client';

const api = createClient({ baseUrl: 'https://api.example.com', credentials: { bearer: () => session.token() } });

const result = await api.openPractice({ body: { name: 'Riverside', timeZone: 'Europe/Paris', managerId: 'ada' } });

if (result.ok) {
  console.log(result.data.id);
} else if (result.status === 422 && result.problem.code === 'UNKNOWN_TIME_ZONE') {
  // result.problem.code is 'UNKNOWN_TIME_ZONE' | 'VALIDATION_FAILED' here, and nothing else.
}

try {
  const page = await unwrap(api.searchAppointments({ query: { 'filter[status]': 'booked' } }));
} catch (error) {
  if (isProblem(error, 'INVALID_CRITERIA')) {
    // error.code is 'INVALID_CRITERIA'.
  }
}
```

- A method never throws for a status its contract declares: the outcome is a union keyed by
  `ok` and `status`. `unwrap` turns a refusal into a thrown `ProblemError`.
- A status the contract does not declare throws `UnexpectedResponseError`. The common one is a
  fault of the server: the kit answers any unexpected error with a 500 problem document
  (`code` `INTERNAL_ERROR`, `requestId`) that no operation declares, and the error reads it:
  `error.code`, `error.requestId` (the reference to quote to the team of the API, which finds
  the request in its logs) and `error.problem`. A gateway in between (502, 503) and a server that
  disagrees with its contract end there too; the drift check keeps the contract equal to the
  routes, not to every answer of the server.
- A declared status below 400 is a success (`ok: true`), a 304 or a 302 under
  `redirect: 'manual'` included; 400 and above a refusal.
- A credential is given per security scheme, as a value or as a function asked before each
  request. An operation sends the credentials of the first alternative of its security that has
  all of them, nothing when it allows anonymous calls and none is given.
- `headers` adds headers to every request, and a header of the call replaces the one of the
  client whatever the case of its name; `fetch` replaces the global one (a test, a retry).
- Each operation is also a function, `getAppointment(connect(options), input)`, so that a bundle
  holds only the operations it calls.
- The body is not validated against its schema: the client trusts the contract, and
  `docs:check` keeps the contract equal to the routes.

### Limits

- Request bodies are JSON. A route of another media type (an upload) is generated without its
  body type; send it with `fetch`.
- A `default` response or a range (`4XX`) is not typed: the kit writes neither.
- Cookie parameters are not generated; a cookie scheme is, sent as a `Cookie` header, which only
  a caller outside a browser can set. A browser drops it and sends its own cookies: there, give a
  `fetch` that calls the global one with `credentials: 'include'`, and no credential for that
  scheme.
- A component schema named like a type the generated files use (`Array`, `Record`) or like an
  export of the client (`ErrorCode`, `Client`, `unwrap`...) gets a trailing `_`.
- An operation is named after its `operationId`. A reserved word is followed by `Operation`
  (`deleteOperation`); a name another operation already holds (`listItems` and `ListItems`), a
  name of the client (`send`, `createClient`), or one whose types (`<Name>Input`,
  `<Name>Result`) a schema holds, is followed by a number (`createClient2`).

## Checked by the pipeline

The clients are committed, so a fresh clone builds without generating anything. The documents
job runs `docs:check`, which ends with `ddd-ts-kit sdk --check`: a route added without
`docs:generate` fails it on `openapi/openapi.yaml` first, then on the client. The build job runs
`ci:build`, which compiles every client with its own compiler options (`npm run sdk:build`):
what ships to a consumer is type-checked in GitHub Actions and in GitLab CI alike. The end-to-end
specs that import a client type-check it with the project in `ci:typecheck`.

## Publish

Publishing is a decision of the team and never a step the generated pipeline takes. To publish
a client:

1. choose its name (`"sdk.name"`, a scope for a private registry) and its access (`"sdk.access"`:
   `restricted` for a private scope, `public`), then `npx ddd-ts-kit sdk`;
2. raise `version` in `clients/<document>/package.json` (the contract version is a good
   source: `info.version`);
3. for a registry other than npm, write its URL in an `.npmrc` next to that package.json, its
   token in the environment, never in the repository;
4. `npm publish --workspace clients/<document>` (`pnpm publish --filter <name>`): its
   `prepublishOnly` builds it first.

A team that wants it automated adds a job of its own on a tag, with the registry token as a
secret of the pipeline, and `npm publish --provenance` from GitHub Actions.

## In the example

The scheduling example generates `clients/api` (`scheduling-api-client`). Inside the kit's
repository the example is itself a workspace of the root, and npm ignores a workspace's own
`"workspaces"`: there the client is reached through the `paths` entry of `tsconfig.json` alone,
which is what the specs and the type check use. Its workspace entry takes effect in a standalone
copy of the example, the layout a generated project has, where `npm publish --workspace
clients/api` works. Its end-to-end specs
of registering a person and opening a practice, and the helpers every journey sets its practice
up with (`registerPeople`, `openStaffedPractice`), call the API through it
(`application.apiAs(actor)` in `test/e2e/support/start-application.ts`, with `expectAnswer` and
`expectRefusal`, which the compiler holds to the statuses and codes of each operation).
`apiAs` gives the token of the actor as the credential of the `bearer` scheme, a function asked
before each request: the authentication of the client is proven against the real server. The other
specs keep the HTTP helpers, which remain the tool for a request the contract does not describe:
a body the client would refuse to compile is sent with them to prove `VALIDATION_FAILED`. The
end-to-end spec `packages/cli/test/e2e/client-sdk.spec.ts` proves the loop on a fresh project:
`init --sdk`, a route added, the contract and the client regenerated, a consumer type-checked.
