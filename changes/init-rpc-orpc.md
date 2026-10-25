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
