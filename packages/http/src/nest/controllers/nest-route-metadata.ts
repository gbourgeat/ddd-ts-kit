import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { RequestMethod } from '@nestjs/common';
import {
  EXCEPTION_FILTERS_METADATA,
  GUARDS_METADATA,
  HEADERS_METADATA,
  HTTP_CODE_METADATA,
  INTERCEPTORS_METADATA,
  METHOD_METADATA,
  PARAMTYPES_METADATA,
  PATH_METADATA,
  PIPES_METADATA,
  REDIRECT_METADATA,
  RENDER_METADATA,
  ROUTE_ARGS_METADATA,
  SSE_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import type { HttpMethod } from '../../route/http-method';
import { isRecord } from '../../support/is-record';
import { prototypeOf } from './prototype-of';
import { reflectedMetadata as metadata } from './reflected-metadata';
import type { NestControllerClass } from './nest-controller-class';
import type { NestParameter } from './nest-parameter';

/**
 * What the decorators of Nest wrote on a controller and its methods, read in this file alone. The
 * keys are those `@nestjs/common/constants` exports, which Nest's own router reads; their shape is
 * checked on each read, so that a release of Nest that changes it stops the start with a message
 * instead of serving a route read wrong (`test/nest-metadata-contract.spec.ts` holds it on the
 * installed Nest).
 */
export interface NestRouteMetadata {
  readonly method: HttpMethod;
  /** The path of the controller and of the method, as Nest joins them: `invoices/:invoiceId/issue`. */
  readonly path: string;
  readonly httpCode: number | undefined;
  readonly parameters: readonly NestParameter[];
  /** What TypeScript recorded the method returns, with `emitDecoratorMetadata`: `undefined` for `void` or without it. */
  readonly returnType: unknown;
}

/** Written by TypeScript itself under `emitDecoratorMetadata`, next to `design:paramtypes`. */
const RETURN_TYPE_METADATA = 'design:returntype';

const METHODS: ReadonlyMap<number, HttpMethod> = new Map([
  [RequestMethod.GET, 'GET'],
  [RequestMethod.POST, 'POST'],
  [RequestMethod.PUT, 'PUT'],
  [RequestMethod.PATCH, 'PATCH'],
  [RequestMethod.DELETE, 'DELETE'],
  [RequestMethod.HEAD, 'HEAD'],
  [RequestMethod.OPTIONS, 'OPTIONS'],
]);

const SOURCES: ReadonlyMap<number, NestParameter['source']> = new Map([
  [RouteParamtypes.BODY, 'body'],
  [RouteParamtypes.QUERY, 'query'],
  [RouteParamtypes.PARAM, 'params'],
  [RouteParamtypes.HEADERS, 'headers'],
]);

/** Nest features the pipeline of the kit does not run: a route that declares one would silently lose it. */
const NOT_RUN: readonly (readonly [string, string])[] = [
  [GUARDS_METADATA, '@UseGuards: name the guards of the kit in `guards` of @KitRoute or @KitRoutes'],
  [PIPES_METADATA, '@UsePipes: the schemas of the route validate its input'],
  [INTERCEPTORS_METADATA, '@UseInterceptors: a bus middleware or an aspect does that work'],
  [EXCEPTION_FILTERS_METADATA, '@UseFilters: the error mapper answers every refusal'],
  [HEADERS_METADATA, '@Header: a route of the kit declares its answer, its cache headers in `cache`'],
  [REDIRECT_METADATA, '@Redirect'],
  [RENDER_METADATA, '@Render'],
  [SSE_METADATA, '@Sse'],
  [VERSION_METADATA, '@Version: give the version in the path'],
];

/** The route Nest's decorators declare on one method of a controller. */
export function nestRouteMetadata(controller: NestControllerClass, method: string): NestRouteMetadata {
  const where = `${controller.name}.${method}`;
  const handler: unknown = Reflect.get(prototypeOf(controller), method);

  if (typeof handler !== 'function') {
    throw new DeclarationError(`${where} carries @KitRoute and is no method.`);
  }

  assertNothingNotRun(where, [controller, handler]);

  return {
    method: methodOf(where, metadata(METHOD_METADATA, handler)),
    path: [pathOf(where, metadata(PATH_METADATA, controller)), pathOf(where, metadata(PATH_METADATA, handler))]
      .filter((part) => part !== '')
      .join('/'),
    httpCode: httpCodeOf(where, metadata(HTTP_CODE_METADATA, handler)),
    parameters: parametersOf(where, controller, method),
    returnType: metadata(RETURN_TYPE_METADATA, prototypeOf(controller), method),
  };
}

function assertNothingNotRun(where: string, targets: readonly object[]): void {
  for (const [key, feature] of NOT_RUN) {
    const declared = targets.map((target) => metadata(key, target));

    if (declared.some((value) => value !== undefined && !(Array.isArray(value) && value.length === 0))) {
      throw new DeclarationError(
        `${where} declares ${feature}. The kit serves the route through its own pipeline, where Nest's does not run.`,
      );
    }
  }
}

function methodOf(where: string, value: unknown): HttpMethod {
  const method = typeof value === 'number' ? METHODS.get(value) : undefined;

  if (method === undefined) {
    throw new DeclarationError(
      `${where} carries @KitRoute and no @Get, @Post, @Put, @Patch, @Delete, @Head or @Options of Nest that the kit reads.`,
    );
  }

  return method;
}

function pathOf(where: string, value: unknown): string {
  if (value === undefined) {
    return '';
  }

  if (typeof value !== 'string') {
    throw new DeclarationError(`${where}: a route of the kit has one path, and Nest declares several.`);
  }

  return value.replace(/^\/+|\/+$/g, '');
}

function httpCodeOf(where: string, value: unknown): number | undefined {
  if (value === undefined || (typeof value === 'number' && Number.isInteger(value))) {
    return value;
  }

  throw new DeclarationError(`${where}: @HttpCode of Nest holds no status.`);
}

function parametersOf(where: string, controller: NestControllerClass, method: string): NestParameter[] {
  const written = metadata(ROUTE_ARGS_METADATA, controller, method) ?? {};
  const types = metadata(PARAMTYPES_METADATA, prototypeOf(controller), method);

  if (!isRecord(written)) {
    throw new DeclarationError(`${where}: the parameters Nest declares are not read as the kit expects them.`);
  }

  return Object.entries(written).map(([slot, argument]) => parameterOf({ where, types }, slot, argument));
}

/** One entry `<type>:<index>` of what Nest's parameter decorators write: `{ index, data, pipes }`. */
function parameterOf(
  { where, types }: { where: string; types: unknown },
  slot: string,
  argument: unknown,
): NestParameter {
  const type = Number(slot.split(':')[0]);
  const { index, data } = writtenArgument(where, slot, argument);
  const source = SOURCES.get(type);

  if (source === undefined) {
    throw new DeclarationError(
      `${where}: parameter ${String(index)} is @${RouteParamtypes[type] ?? slot} of Nest; a route of the kit reads @Body, @Query, @Param and @Headers, @CurrentActor and @RouteContext.`,
    );
  }

  return { index, source, ...(data === undefined ? {} : { key: data }), type: typeAt(types, index) };
}

/** What one parameter decorator of Nest wrote, checked: its index, the name it reads, and no pipe. */
function writtenArgument(where: string, slot: string, argument: unknown): { index: number; data?: string } {
  if (!isRecord(argument) || typeof argument['index'] !== 'number') {
    throw new DeclarationError(`${where}: the parameter ${slot} Nest declares is not read as the kit expects it.`);
  }

  const { index, data, pipes } = argument;

  if (Array.isArray(pipes) && pipes.length > 0) {
    throw new DeclarationError(`${where}: parameter ${String(index)} has pipes of Nest, which the kit does not run.`);
  }

  if (data !== undefined && typeof data !== 'string') {
    throw new DeclarationError(`${where}: parameter ${String(index)} is read by something else than a name.`);
  }

  return data === undefined ? { index } : { index, data };
}

/** The class TypeScript recorded for a parameter, when it was compiled with `emitDecoratorMetadata`. */
function typeAt(types: unknown, index: number): unknown {
  return Array.isArray(types) ? types[index] : undefined;
}
