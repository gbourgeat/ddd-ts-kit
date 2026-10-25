# NestJS: where each tool of Nest goes

Rule: a context uses none of the tools of Nest the kit does its own way
(`nest/no-parallel-pipeline`, an error), and a controller Nest serves reaches no use case,
wherever it is written. A Nest controller the kit serves (`@KitRoute`) keeps Nest's route and
parameter decorators. The routes of the kit are mounted under Nest, not
through its pipeline: a Nest guard, pipe, exception filter or interceptor never sees them, and a
Nest controller in a context is a route nothing secures, outside the contract and the problem
format. A right checked by a Nest guard is checked on HTTP only, never on `/rpc`, `/trpc`, a job
or an event handler. Nest stays free in the platform. Judged: `presentation/`,
`infrastructure/` and the module file of a context, outside its tests.

| Reached for, in Nest | Write instead |
|---|---|
| `@Controller`, `@Get`, `@Post`, `@Body`, `@Param` | keep them: each method with a route decorator of Nest is a route, named after the method, its parts and its answer read from its signature; `@KitRoute({ errors })` for its refusal codes, `@KitRoutes({ group })` on the class, `@CurrentActor()` for the caller, the bus injected by Nest; under `stack.routes: nest` (`init --routes nest`), `npx ddd-ts-kit generate route <context> <UseCase> --method <M> --path <p>` writes it and the generated `<context>.controllers.ts` lists it |
| `ValidationPipe`, a DTO with class-validator | the schemas of the route, with the validation library of the project |
| `@UseGuards(AuthGuard(...))`, Passport | authentication in the platform, read by `resolvePrincipal`; `generate guard` for a control at the edge of a route group |
| `@Roles`, a `RolesGuard`, CASL | the permission of the use case (`requires` in the module file, `@Requires`), a policy, an access scope: `/ddd-ts-kit:access-control` |
| an exception filter, `throw new NotFoundException()` | a refusal from the code list of the context; the error mapper answers the problem |
| an interceptor (logs, traces, retries) | a bus middleware or an aspect: `/ddd-ts-kit:cross-cutting` |
| `CacheInterceptor`, `@nestjs/cache-manager` | the `cache` of the route, the `Cache` port of the kernel |
| `FileInterceptor`, `@UploadedFile()` | `upload` of `@KitRoute` and `@Upload()` on the parameter: `npx ddd-ts-kit generate file-upload <context> <UseCase> --path <p>` |
| `@nestjs/swagger` | `npm run docs:generate`: the contract comes from the routes |
| `@nestjs/cqrs` | `CommandBus` and `QueryBus` of the kit |
| `@nestjs/schedule`, `@nestjs/bullmq` | `generate job`: a job sends a command |
| `@nestjs/event-emitter` | domain events, integration events through the outbox |
| `@nestjs/config` | the configuration of the platform, handed to the module |
| `@nestjs/typeorm`, `@InjectRepository` | the repository adapter on the ORM package of the kit: `/ddd-ts-kit:persistence` |
| `@nestjs/throttler` | `rateLimit` of the platform |
| `Logger` of `@nestjs/common` | the `Logger` of the kernel |

What a method takes and answers is its signature (`@Body() body: IssueInvoiceBody`,
`Promise<IssuedInvoiceAnswer>`, `Promise<Accepted>`, `Promise<void>`): the kit reads it into the
generated `<context>.controllers.ts`, which the module lists, and `nest/controllers-current` keeps
that file current and reports a type it cannot read (an array, an inline type, an interface):
type the part or the answer by a DTO class, or give it in `request` or `response` of `@KitRoute`.
`@KitRoute` is left for the refusal codes. Nothing depends on `emitDecoratorMetadata`, so tsx in
`npm run dev` serves the same routes as the build.

Every route generator writes the Nest form: `generate route` a search too (its page is no DTO
class, so its `@KitRoute` gives `request: { query }` and `response.body`), `generate file-upload`
a method that takes `@Upload() file: IncomingFile`, streamed and checked by the kit, and
`generate form` and `generate representation` their options at the top of `@KitRoute`. Nest's
`@UploadedFile()` and `FileInterceptor` are refused: the kit would not stream nor check the file.

A generated controller injects the buses only (`@Inject(CommandBus)`, `@Inject(QueryBus)`): they
are the providers the platform gives Nest, as a controller only sends a message through a bus.
Another provider is added to `controllersOf` in `src/platform/composition/compose-application.ts`.

Not judged: `@Injectable()` and `@Inject()` outside `domain/` and `application/` (an adapter
bound as a Nest provider), and the packages the kit has no answer to (`@nestjs/websockets`,
`@nestjs/graphql`, `@nestjs/microservices`, `@nestjs/testing`). A resolver or a gateway that
calls a use case sends its command through the bus, which checks its permission.

Full table, with what each tool of the kit keeps: `docs/tools/http-frameworks.md` of the kit,
"Where each tool of Nest goes".
