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
