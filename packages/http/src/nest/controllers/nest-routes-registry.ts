import type { Schema } from '@ddd-ts-kit/validation';
import type { DtoType } from './dto-type';
import type { KitRouteSpec } from './kit-route-spec';
import type { KitRoutesOptions } from './kit-routes-options';

/** What a parameter decorator of the kit asks for: the caller, or the context of the request. */
export type Injected = 'actor' | 'context';

export interface NestRoutesRegistry {
  /** By prototype of a controller, the routes of its methods. */
  readonly routes: WeakMap<object, Map<string, KitRouteSpec>>;
  /** By controller class, what its routes share. */
  readonly controllers: WeakMap<object, KitRoutesOptions>;
  /** By prototype, method and index, what the kit hands a parameter. */
  readonly injected: WeakMap<object, Map<string, Map<number, Injected>>>;
  /** By controller class and method, the body read from its signature by `ddd-ts-kit`; `null` when it answers none. */
  readonly answers: WeakMap<object, ReadonlyMap<string, Schema<unknown> | DtoType | null>>;
}

/* One registry per process, whatever the number of copies of this package it loaded, as the registry of the presentation. */
const REGISTRY = Symbol.for('@ddd-ts-kit/http/nest-controllers/v2');

export function nestRoutesRegistry(): NestRoutesRegistry {
  const existing: unknown = Reflect.get(globalThis, REGISTRY);

  if (isRegistry(existing)) {
    return existing;
  }

  const created: NestRoutesRegistry = {
    routes: new WeakMap(),
    controllers: new WeakMap(),
    injected: new WeakMap(),
    answers: new WeakMap(),
  };

  Reflect.set(globalThis, REGISTRY, created);

  return created;
}

function isRegistry(value: unknown): value is NestRoutesRegistry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return ['routes', 'controllers', 'injected', 'answers'].every((key) => Reflect.get(value, key) instanceof WeakMap);
}
