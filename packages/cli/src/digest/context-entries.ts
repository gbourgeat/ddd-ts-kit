import type { ContextDescription } from '../describe/context-description';
import type {
  ConsumedEventEntry,
  PermissionEntry,
  PortEntry,
  PublishedEventEntry,
  RouteEntry,
  UseCaseEntry,
} from './digest';

/** What a digest compares of one context: the facts a reviewer reads first, without the paths. */
export interface ContextEntries {
  readonly useCases: readonly UseCaseEntry[];
  readonly permissions: readonly PermissionEntry[];
  readonly routes: readonly RouteEntry[];
  readonly publishedEvents: readonly PublishedEventEntry[];
  readonly consumedEvents: readonly ConsumedEventEntry[];
  readonly ports: readonly PortEntry[];
}

/** The entries of a context as `describe` reads it, each permission with the roles that hold it. */
export function contextEntries(described: ContextDescription, grants: (key: string) => string[]): ContextEntries {
  return {
    useCases: described.useCases.map(({ kind, name, permission }) => ({ kind, name, permission })),
    permissions: described.permissions.map((name) => ({ name, grants: grants(name) })),
    routes: described.routes.map(({ method, path, useCase, permission, errors }) => ({
      method,
      path,
      useCase,
      permission,
      errors,
    })),
    publishedEvents: described.publishedEvents.map(({ type, versions }) => ({ type, versions })),
    consumedEvents: described.consumedEvents.map(({ type, from, handler }) => ({ type, from, handler })),
    ports: described.ports.map(({ name, kind, adapters }) => ({ name, kind, adapters })),
  };
}
