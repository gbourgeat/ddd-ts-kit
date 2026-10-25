**`init --rpc trpc` serves the routes of the contexts under `/trpc` as tRPC procedures, and `ddd-ts-kit sdk` gives each client the type of their router at `./trpc`.**
`stack.rpc` takes a third value, `trpc`: `start-http-server.ts` mounts `trpcRouter` of
`@ddd-ts-kit/http/trpc` under `/trpc` on Express, Fastify, Hono and NestJS, with the options of
the HTTP boundary, and adds `@trpc/server`; it needs an HTTP framework, as `orpc` does. `ddd-ts-kit
sdk` then writes `src/trpc.ts` in each client: `AppRouter`, the type of the router written from
its document, a query for each `GET` operation and a mutation for the others, their input and
answer the types of the HTTP client, a refusal carrying its problem document in `data.problem`;
`createRpcClient` and `isRpcRefusal` call it. A front end imports the client, never the code of
the server. `@trpc/client` and `@trpc/server` become the only dependencies of the client; moving
to another value takes them and `src/trpc.ts` away.

To move: a project that wants the procedures runs `init --force --rpc trpc` on a clean tree (it
records the key, rewrites `start-http-server.ts` and adds `@trpc/server`), then
`npx ddd-ts-kit sdk` when it has clients. A project that served oRPC removes `@orpc/server` from
its `package.json`: `init` adds the dependencies of a stack, it does not take back those of the
previous one.
