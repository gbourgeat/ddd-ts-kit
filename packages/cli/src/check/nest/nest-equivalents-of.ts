/** A tool of Nest a context reached for, and what the kit does in its place. */
export interface NestEquivalent {
  readonly tool: string;
  readonly instead: string;
}

const ROUTE: NestEquivalent = {
  tool: 'a controller Nest serves',
  instead:
    'a route of the kit: `@KitRoute` of `@ddd-ts-kit/http/nest` on each method of the controller, served by `createControllersModule`, or `generate route`. Its security is declared, its refusals are problem documents with their codes, and it is in the contract',
};

const UPLOADED: NestEquivalent = {
  tool: 'a file parsed by Nest',
  instead:
    '`upload` of `@KitRoute` (its field, largest size and media types, in the contract) and `@Upload()` of `@ddd-ts-kit/http/nest`, which hands the method the file the kit streams and checks: `ddd-ts-kit generate file-upload` writes it',
};

const RAW: NestEquivalent = {
  tool: 'the raw request or answer',
  instead:
    'the parts of the request a route of the kit validates (`@Body`, `@Query`, `@Param`, `@Headers`, `@CurrentActor`, `@RouteContext`), and an answer it declares (`response` of `@KitRoute`, `cache` for its headers)',
};

const GUARD: NestEquivalent = {
  tool: 'a guard',
  instead:
    'the guards of a route group of the kit for a control at the edge (`generate guard`), and the permission of the use case for a right (`@Requires`, or `requires` in the module file), which the bus checks on every door: HTTP, /rpc, /trpc, a job, an event',
};

const PIPE: NestEquivalent = {
  tool: 'a pipe',
  instead: 'the schemas of the route (`request.body`, `params`, `query`), the ones the contract documents',
};

const FILTER: NestEquivalent = {
  tool: 'an exception filter or an HTTP exception',
  instead:
    'a refusal of the domain or the application from the code list of the context, which the error mapper answers as a problem document with its code',
};

const INTERCEPTOR: NestEquivalent = {
  tool: 'an interceptor',
  instead:
    'a bus middleware or an aspect (logging, retry, timeout), and the `cache` of the route for what a cache keeps',
};

const LOGGER: NestEquivalent = { tool: 'its logger', instead: 'the `Logger` of `@ddd-ts-kit/kernel`' };

const SIDE_EFFECT: NestEquivalent = {
  tool: 'its common package',
  instead: 'nothing: a context needs no side effect of Nest, which the platform sets up',
};

const PIPELINE: NestEquivalent = {
  tool: 'its request pipeline',
  instead:
    'the platform, for what acts on Nest itself: the routes of the kit do not go through `APP_GUARD`, `APP_FILTER` or `APP_INTERCEPTOR`',
};

/** The tools of `@nestjs/common`, by the names a context imports. */
const COMMON: readonly (readonly [RegExp, NestEquivalent])[] = [
  [/^(?:Controller|Get|Post|Put|Patch|Delete|All|Head|Options|Search|Body|Param|Query|Headers|HttpCode)$/, ROUTE],
  [/^(?:Req|Request|Res|Response|Next|Header|Redirect|Render|Sse|Ip|HostParam|Session)$/, RAW],
  [/^(?:UploadedFiles?|ParseFilePipe|ParseFilePipeBuilder|MaxFileSizeValidator|FileTypeValidator)$/, UPLOADED],
  [/^(?:UseGuards|CanActivate|SetMetadata|applyDecorators)$/, GUARD],
  [/^(?:UsePipes|PipeTransform|ArgumentMetadata)$|Pipe$/, PIPE],
  [/^(?:UseFilters|Catch|ExceptionFilter|ArgumentsHost)$|Exception$/, FILTER],
  [/^(?:UseInterceptors|NestInterceptor|CallHandler|ExecutionContext)$/, INTERCEPTOR],
  [/^(?:Logger|ConsoleLogger|LoggerService)$/, LOGGER],
];

/** The packages of Nest whose work the kit does, and what it does in their place. */
const PACKAGES: Readonly<Record<string, NestEquivalent>> = {
  '@nestjs/core': PIPELINE,
  '@nestjs/platform-express': PIPELINE,
  '@nestjs/platform-fastify': PIPELINE,
  '@nestjs/swagger': {
    tool: 'Swagger',
    instead: 'the OpenAPI contract the kit generates from the routes (`npm run docs:generate`), with its error codes',
  },
  '@nestjs/cqrs': {
    tool: 'CQRS',
    instead:
      'the `CommandBus` and `QueryBus` of the kit, whose middlewares check the permission, open the unit of work and write the outbox',
  },
  '@nestjs/passport': {
    tool: 'Passport',
    instead:
      'the strategy in the platform, where `passportPrincipal(strategy, { actorOf })` of `@ddd-ts-kit/auth/passport` makes it the `resolvePrincipal` of the HTTP boundary; a strategy class of `@nestjs/passport` is one, and Nest may build it',
  },
  '@nestjs/jwt': {
    tool: 'its JWT module',
    instead: 'the authentication of the platform, read by `resolvePrincipal` of the HTTP boundary',
  },
  '@nestjs/schedule': {
    tool: 'its scheduler',
    instead: 'a job of the kit (`generate job`), which sends a command through the bus',
  },
  '@nestjs/bull': { tool: 'its queues', instead: 'a background job of the kit, which sends a command through the bus' },
  '@nestjs/bullmq': {
    tool: 'its queues',
    instead: 'a background job of the kit, which sends a command through the bus',
  },
  '@nestjs/config': {
    tool: 'its configuration',
    instead: 'the configuration of the platform, validated at start and handed to the module of the context',
  },
  '@nestjs/throttler': { tool: 'its throttler', instead: 'the rate limit of the platform (`rateLimit` of the config)' },
  '@nestjs/cache-manager': {
    tool: 'its cache',
    instead: 'the `Cache` port of the kernel, and the `cache` of a route for what HTTP caches keep',
  },
  '@nestjs/event-emitter': {
    tool: 'its event emitter',
    instead: 'domain events, which leave with the save, and integration events through the outbox',
  },
  '@nestjs/typeorm': {
    tool: 'its ORM module',
    instead: 'the repository adapter of the context on the ORM package of the kit, inside the unit of work',
  },
  '@nestjs/mongoose': {
    tool: 'its ORM module',
    instead: 'the repository adapter of the context, inside the unit of work',
  },
  '@nestjs/sequelize': {
    tool: 'its ORM module',
    instead: 'the repository adapter of the context, inside the unit of work',
  },
  '@nestjs/terminus': { tool: 'its health checks', instead: 'the readiness of the platform' },
};

/**
 * What a context imports of Nest that the kit does in its own way, one per tool: none for a
 * package of Nest the kit has no answer to (WebSockets, GraphQL, microservices, testing), nor for
 * its container (`Injectable`, `Inject`), which an adapter bound as a Nest provider may carry. In
 * a controller the kit serves (`servedByKit`: it carries `@KitRoute`), the decorators that declare
 * a route are what the kit reads, and are not reported.
 */
export function nestEquivalentsOf(
  packageName: string,
  names: readonly string[],
  servedByKit = false,
): readonly NestEquivalent[] {
  if (packageName !== '@nestjs/common') {
    const equivalent = PACKAGES[packageName];

    return equivalent === undefined ? [] : [equivalent];
  }

  if (names.length === 0) {
    return [SIDE_EFFECT];
  }

  const found = names.flatMap((name) => COMMON.find(([pattern]) => pattern.test(name))?.[1] ?? []);

  return [...new Set(found.filter((equivalent) => !(servedByKit && equivalent === ROUTE)))];
}
