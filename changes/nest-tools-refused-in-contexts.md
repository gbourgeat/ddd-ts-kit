**`ddd-ts-kit check` refuses in a context the tools of Nest that the kit does its own way, and says which tool of the kit to use instead (`nest/no-parallel-pipeline`).**
The routes of the kit are mounted under Nest, not through its pipeline: a Nest guard, pipe,
exception filter or interceptor never sees them, and a Nest controller written in a context was
a route the checker let through, with no declared security, no problem codes and no place in the
contract (`authz/declared` judged the controllers of the kit only). The new rule, an error,
reports in `presentation/`, `infrastructure/` and the module file of a context, tests apart: a
controller and its decorators, a guard, a pipe, an exception filter or an `HttpException`, an
interceptor or the `Logger` of `@nestjs/common`, and `@nestjs/core`, `@nestjs/swagger`,
`@nestjs/cqrs`, `@nestjs/passport`, `@nestjs/jwt`, `@nestjs/schedule`, `@nestjs/bull(mq)`,
`@nestjs/config`, `@nestjs/throttler`, `@nestjs/cache-manager`, `@nestjs/event-emitter`, the ORM
modules of Nest and `@nestjs/terminus`. Each finding names the tool of the kit in its place. The
container of Nest (`@Injectable()`, `@Inject()` on an adapter bound as a provider), its WebSocket,
GraphQL, microservice and testing packages, and everything in the platform are left alone. The
HTTP frameworks guide gains "Where each tool of Nest goes", and the `wiring` skill `nest.md`.

To move: a project with Nest code in a context runs `npx ddd-ts-kit check` and replaces each
finding by the tool its message names (a Nest controller by `generate route`, a role guard by the
permission of the use case, an `HttpException` by a refusal of the code list), or moves what is
not a use case to the platform.
