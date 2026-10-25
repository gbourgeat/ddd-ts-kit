**`nest/no-parallel-pipeline` lets a Nest controller the kit serves declare its routes with Nest's decorators, and refuses anywhere a controller Nest serves that reaches a use case.**
In a context, a file that imports `KitRoute` of `@ddd-ts-kit/http/nest` may use `@Controller`,
`@Get`, `@Post` and the other methods, `@Param`, `@Query`, `@Headers`, `@Body` and `@HttpCode` of
Nest: the kit reads them and serves the route through its own pipeline. The raw request and answer
(`@Req`, `@Res`, `@Header`, `@Redirect`, `@Render`, `@Sse`, uploads), guards, pipes, filters and
interceptors of Nest stay refused there. Outside the contexts, under the source root and outside
the tests, a file that imports `Controller` of `@nestjs/common`, not `KitRoute`, and names
`CommandBus` or `QueryBus` or imports a file of a context is reported: a controller Nest serves
that reaches a use case has no declared security, no problem codes and no place in the contract,
and moving it to the platform no longer hides it. A controller of the platform that reaches no
use case (health, metrics) is left alone.

To move: a Nest controller of the platform that sends commands or queries gets `@KitRoute` on each
method and moves to `createControllersModule`, or becomes a route of the context.
