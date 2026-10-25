**A Nest controller is a route of the kit: `@KitRoute` on its method, `createControllersModule` of `@ddd-ts-kit/http/nest` to serve it.**
A project on NestJS writes its controllers as Nest does (`@Controller`, `@Get`, `@Post`,
`@Param`, `@Query`, `@Headers`, `@Body` with a DTO class, `@HttpCode`, injection by constructor),
and adds `@KitRoute({ operationId, summary, guards, errors, response })` to each method,
`@KitRoutes({ guards, tags, errors })` to the class for what its routes share. The kit, not Nest's
router, serves the method, through the pipeline of every route: guards, validation of the DTO
(`schemaOfClass: classSchema`), problem documents, tracing, the contract, and a procedure over
`/rpc` and `/trpc`. `@CurrentActor()` hands the method the caller the authentication resolved;
`@RouteContext()` the context of the request. `nestControllerRoutes` gives the same routes without
Nest's container, for the contract and the procedures. What the kit's pipeline would not run is
refused when the routes are built: `@UseGuards`, `@UsePipes`, `@UseInterceptors`, `@UseFilters`,
`@Header`, `@Redirect`, `@Render`, `@Sse`, `@Version`, pipes on a parameter, `@Req`, `@Res`; a
route with no guard is refused; a controller also among the `controllers` of a Nest module stops
the start. The metadata Nest's decorators record is read in one place, checked on each read, and
held by a test on the Nest the kit is released with.
