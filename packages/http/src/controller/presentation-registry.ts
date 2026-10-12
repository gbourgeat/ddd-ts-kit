import type { ControllerClass } from './controller-class.js';
import type { ControllerSpec } from './controller-spec.js';
import type { RouteGroupClass } from './route-group-class.js';
import type { RouteGroupOptions } from './route-group-options.js';

export interface PresentationRegistry {
  readonly controllers: WeakMap<ControllerClass, ControllerSpec>;
  readonly groups: WeakMap<RouteGroupClass, RouteGroupOptions>;
}

/*
 * One registry per process, whatever the number of copies of this package it loaded, as the
 * registry of declarations of the kernel: the global symbol registry is what they all share.
 */
const REGISTRY = Symbol.for('@ddd-ts-kit/http/presentation/v1');

export function presentationRegistry(): PresentationRegistry {
  const existing: unknown = Reflect.get(globalThis, REGISTRY);

  if (isRegistry(existing)) {
    return existing;
  }

  const created: PresentationRegistry = { controllers: new WeakMap(), groups: new WeakMap() };

  Reflect.set(globalThis, REGISTRY, created);

  return created;
}

function isRegistry(value: unknown): value is PresentationRegistry {
  if (typeof value !== 'object' || value === null || !('controllers' in value) || !('groups' in value)) {
    return false;
  }

  return value.controllers instanceof WeakMap && value.groups instanceof WeakMap;
}
