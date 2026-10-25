import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { controllerRoutes } from '../../controller/controller-routes';
import type { ControllerSpec } from '../../controller/controller-spec';
import type { ErasedController } from '../../controller/erased-controller';
import { presentationRegistry } from '../../controller/presentation-registry';
import type { Route } from '../../route/route';
import { argumentsOf } from './arguments-of';
import { isNestController } from './is-nest-controller';
import type { KitRouteSpec } from './kit-route-spec';
import type { NestControllerClass } from './nest-controller-class';
import type { NestControllerRoutesOptions } from './nest-controller-routes-options';
import type { NestMethod } from './nest-method';
import { nestRouteMetadata } from './nest-route-metadata';
import { nestRouteMethods } from './nest-route-methods';
import { type Injected, nestRoutesRegistry } from './nest-routes-registry';
import { prototypeOf } from './prototype-of';
import { requestSchemasOf } from './request-schemas-of';
import { schemaOf } from './schema-of';
import { summaryOf } from './summary-of';

/**
 * The routes of Nest controllers whose methods carry `@KitRoute`, for any adapter of the kit and
 * for the contract generator: each method becomes one route of the kit, its method, path,
 * parameters and status read from Nest's decorators, the rest from `@KitRoute` and `@KitRoutes`.
 * It is served as every controller of the kit is, guards, validation and problem documents
 * included; the instance that answers is the one Nest's container builds (`instanceOf`).
 */
export function nestControllerRoutes(
  controllers: readonly NestControllerClass[],
  options: NestControllerRoutesOptions = {},
): readonly Route[] {
  const entries = controllers.flatMap((controller) => routesOf(controller, options));

  return controllerRoutes(entries, {
    ...(options.resolve === undefined ? {} : { resolve: options.resolve }),
    ...(options.security === undefined ? {} : { security: options.security }),
  });
}

function routesOf(controller: NestControllerClass, options: NestControllerRoutesOptions): ErasedController[] {
  if (!isNestController(controller)) {
    throw new DeclarationError(`${controller.name} is served as a Nest controller and carries no @Controller of Nest.`);
  }

  const prototype = prototypeOf(controller);
  const declared = nestRoutesRegistry().routes.get(prototype) ?? new Map<string, KitRouteSpec>();
  const names = [...new Set([...nestRouteMethods(controller), ...declared.keys()])];

  if (names.length === 0) {
    throw new DeclarationError(
      `${controller.name} is served by the kit and no method carries a route decorator of Nest.`,
    );
  }

  const answering = lazyInstance(controller, options);
  const injected = nestRoutesRegistry().injected.get(prototype);

  return names.map((name) => {
    const written = declared.get(name) ?? {};

    const method: NestMethod = {
      controller,
      name,
      where: `${controller.name}.${name}`,
      spec: { ...written, operationId: written.operationId ?? name, summary: written.summary ?? summaryOf(name) },
      read: nestRouteMetadata(controller, name),
      injected: injected?.get(name) ?? new Map<number, Injected>(),
    };

    return synthetic(method, specOf(method, options), answering);
  });
}

/**
 * One controller of the kit per method: a class of its own, registered with its declaration, whose
 * `handle` calls the method with what its parameters ask for.
 */
function synthetic(method: NestMethod, spec: ControllerSpec, answering: () => object): ErasedController {
  const { where, name } = method;

  class Answer {
    async handle(request: Parameters<ErasedController['handle']>[0]): Promise<unknown> {
      const instance = answering();
      const handler: unknown = Reflect.get(instance, name);

      if (typeof handler !== 'function') {
        throw new DeclarationError(`What Nest built for ${method.controller.name} has no method ${name}.`);
      }

      const answer: unknown = await Reflect.apply(handler, instance, argumentsOf(method, request));

      if (answer !== undefined && spec.response.body === undefined) {
        throw new DeclarationError(
          `${where} returned a value and @KitRoute declares no response.body: the kit would answer it empty. Declare the body the route answers, or return nothing.`,
        );
      }

      return answer;
    }
  }

  // The messages of the kit name the controller of a route by its class.
  Object.defineProperty(Answer, 'name', { value: where });
  presentationRegistry().controllers.set(Answer, spec);

  return new Answer();
}

/** The declaration of the controller of the kit: Nest's method, path and status, the rest of @KitRoute over @KitRoutes. */
function specOf(method: NestMethod, options: NestControllerRoutesOptions): ControllerSpec {
  const { read, spec } = method;
  const shared = nestRoutesRegistry().controllers.get(method.controller) ?? {};
  const { response = {}, request, guards = [], tags = [], errors = [], ...declared } = spec;

  return {
    ...declared,
    ...requestSchemasOf(method, options),
    ...(shared.group === undefined ? {} : { group: shared.group }),
    method: read.method,
    path: `/${read.path}`,
    tags: [...(shared.tags ?? []), ...tags],
    guards: [...(shared.guards ?? []), ...guards],
    errors: [...(shared.errors ?? []), ...errors],
    response: responseOf(method, response, options),
  };
}

function responseOf(
  { where, read }: NestMethod,
  response: NonNullable<KitRouteSpec['response']>,
  options: NestControllerRoutesOptions,
): ControllerSpec['response'] {
  const status = response.status ?? read.httpCode ?? (read.method === 'POST' ? 201 : 200);

  if (response.body === undefined && answersAValue(read.returnType)) {
    throw new DeclarationError(
      `${where} returns ${describedType(read.returnType)} and @KitRoute declares no response.body: the kit would answer it empty. Declare the body the route answers, or return nothing.`,
    );
  }

  return {
    status,
    ...(response.description === undefined ? {} : { description: response.description }),
    ...(response.body === undefined ? {} : { body: schemaOf(where, response.body, options) }),
  };
}

/**
 * Whether the type TypeScript recorded says the method answers something: `void` is recorded as
 * nothing, and a `Promise` says nothing of what it holds, which the call then checks.
 */
function answersAValue(returnType: unknown): boolean {
  return returnType !== undefined && returnType !== Promise;
}

function describedType(returnType: unknown): string {
  return typeof returnType === 'function' && returnType.name !== '' ? returnType.name : 'a value';
}

/** The instance Nest's container built, asked once at the first call. */
function lazyInstance(controller: NestControllerClass, options: NestControllerRoutesOptions): () => object {
  let instance: object | undefined;

  return () => {
    instance ??= built(controller, options);

    return instance;
  };
}

function built(controller: NestControllerClass, options: NestControllerRoutesOptions): object {
  const instance = options.instanceOf?.(controller);

  if (typeof instance !== 'object' || instance === null) {
    throw new DeclarationError(
      `${controller.name} is called and nothing builds it: serve it through createControllersModule, or give instanceOf.`,
    );
  }

  return instance;
}
