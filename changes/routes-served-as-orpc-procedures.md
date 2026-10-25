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
