**`init --routes nest` makes a Nest controller what `generate route` writes: Nest builds it with the bus it injects, the kit serves it.**
A new form of `stack.routes`, `nest`, for a project on `--http nest` with class-validator. `generate
route` writes `<use-case>.controller.ts` with Nest's `@Controller()`, `@Post` or `@Get`, `@Param`,
`@Body` typed by the DTO classes beside it, `@CurrentActor()` for the caller, the bus injected by
Nest (`@Inject(CommandBus)`), and `@KitRoute` and `@KitRoutes({ group })` of
`@ddd-ts-kit/http/nest`; the module of the context lists it under `controllers`, the application
composes its routes with the others (`nestControllers`), and the Nest module of the platform builds
it with the buses of the platform (`provideControllers`). The routes keep the guarantees of every
route: the guards of the group, validation, problem documents, the contract, and the procedures
over `/rpc` and `/trpc`. A search stays a controller of the kit (`generate controller`), and
`--mapper` and `--serializer` are left out: the method maps its input and its answer itself.

`@ddd-ts-kit/http/nest` gains `nestControllers`, `provideControllers` and `nestControllerRoute`,
and `@KitRoutes` a `group`, a route group of the kit whose prefix, tags, guards and codes come first.

To move: a new Nest project passes `--routes nest`; an existing one keeps its routes, and a context
that gets Nest controllers needs the `controllers` list of the module file and the composition of
the platform that `init --force --routes nest` writes.
