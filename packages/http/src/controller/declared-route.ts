import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { ROUTE_PATH_PATTERN } from '../route/route-path-pattern.js';
import type { ControllerSpec } from './controller-spec.js';
import type { GuardReference } from './guard-reference.js';
import { Public } from './guards/public.js';
import { presentationRegistry } from './presentation-registry.js';
import type { RouteGroupClass } from './route-group-class.js';

/** What a controller says once the groups above it are folded in. */
export interface DeclaredRoute {
  readonly path: string;
  readonly operationId: string;
  readonly tags: readonly string[];
  readonly guards: readonly GuardReference[];
  readonly errors: readonly string[];
  /** The class names of its route group and of every group above it, nearest first. */
  readonly groups: readonly string[];
}

interface Inherited {
  readonly groups: readonly string[];
  readonly prefix: string;
  readonly tags: readonly string[];
  readonly guards: readonly GuardReference[];
  readonly errors: readonly string[];
}

const NOTHING: Inherited = { groups: [], prefix: '', tags: [], guards: [], errors: [] };

/** Folds the groups of a controller into its declaration, and refuses one that cannot stand. */
export function declaredRoute(className: string, spec: ControllerSpec): DeclaredRoute {
  const inherited = spec.group === undefined ? NOTHING : inheritedFrom(className, spec.group);
  const guards = [...inherited.guards, ...(spec.guards ?? [])];
  const path = `${inherited.prefix}${spec.path === '/' && inherited.prefix !== '' ? '' : spec.path}`;

  assertPath(className, spec.path, path);
  assertAccess(className, guards);

  return {
    path,
    operationId: spec.operationId ?? operationIdOf(className),
    tags: distinct([...inherited.tags, ...(spec.tags ?? [])]),
    guards,
    errors: distinct([...inherited.errors, ...(spec.errors ?? [])]),
    groups: inherited.groups,
  };
}

function inheritedFrom(className: string, group: RouteGroupClass): Inherited {
  const options = presentationRegistry().groups.get(group);

  if (options === undefined) {
    throw new DeclarationError(`Controller ${className}: its group ${group.name} carries no @RouteGroup.`);
  }

  const above = options.parent === undefined ? NOTHING : inheritedFrom(className, options.parent);

  return {
    groups: [group.name, ...above.groups],
    prefix: `${above.prefix}${options.prefix ?? ''}`,
    tags: [...above.tags, ...(options.tags ?? [])],
    guards: [...above.guards, ...(options.guards ?? [])],
    errors: [...above.errors, ...(options.errors ?? [])],
  };
}

function assertPath(className: string, written: string, path: string): void {
  if (!ROUTE_PATH_PATTERN.test(written) || !ROUTE_PATH_PATTERN.test(path)) {
    throw new DeclarationError(
      `Controller ${className}: the path "${written}" must be made of literal segments and ":name" parameters.`,
    );
  }
}

function assertAccess(className: string, guards: readonly GuardReference[]): void {
  if (guards.length === 0) {
    throw new DeclarationError(
      `Controller ${className} names no group with guards and no guard of its own: nothing says who may call it. Name its group, or declare \`guards: [Public]\` when anybody may.`,
    );
  }

  if (guards.length > 1 && guards.includes(Public)) {
    throw new DeclarationError(
      `Controller ${className} is behind Public and another guard: a route is open or it is guarded. Move it to a group of its kind.`,
    );
  }
}

function operationIdOf(className: string): string {
  const name = className.replace(/Controller$/, '');

  return `${name.charAt(0).toLowerCase()}${name.slice(1)}`;
}

function distinct(values: readonly string[]): string[] {
  return [...new Set(values)];
}
