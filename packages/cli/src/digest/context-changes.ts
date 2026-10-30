import type { ContextDescription } from '../describe/context-description';
import { changesOf } from './changes-of';
import { type ContextEntries, contextEntries } from './context-entries';
import type { Change, ContextChanges } from './digest';
import { grantsOf } from './grants-of';
import type { ProjectTree } from './project-tree';

const NONE: ContextEntries = {
  useCases: [],
  permissions: [],
  routes: [],
  publishedEvents: [],
  consumedEvents: [],
  ports: [],
};

/**
 * How the description of each context differs between the base and HEAD, by context name: a
 * context of HEAD alone is added, one of the base alone removed. A context whose entries are the
 * same on both sides is left out.
 */
export function contextChanges(before: ProjectTree, after: ProjectTree): ContextChanges[] {
  const names = [...new Set([...after.contexts, ...before.contexts].map((context) => context.name))];

  return names.flatMap((name) => {
    const was = entriesIn(before, name);
    const is = entriesIn(after, name);
    const changes = { name, change: changeOf(was, is), ...entryChanges(was ?? NONE, is ?? NONE) };

    return isEmpty(changes) ? [] : [changes];
  });
}

function entriesIn(tree: ProjectTree, name: string): ContextEntries | undefined {
  const described = tree.contexts.find((context: ContextDescription) => context.name === name);

  if (described === undefined || tree.config === undefined || tree.grants === undefined) {
    return undefined;
  }

  return contextEntries(described, grantsOf({ ws: tree.ws, config: tree.config, grants: tree.grants }, name));
}

function changeOf(was: ContextEntries | undefined, is: ContextEntries | undefined): Change {
  if (was === undefined) {
    return 'added';
  }

  return is === undefined ? 'removed' : 'changed';
}

function entryChanges(was: ContextEntries, is: ContextEntries): Omit<ContextChanges, 'name' | 'change'> {
  return {
    useCases: changesOf(was.useCases, is.useCases, (useCase) => useCase.name),
    permissions: changesOf(was.permissions, is.permissions, (permission) => permission.name),
    routes: changesOf(was.routes, is.routes, (route) => `${route.method} ${route.path}`),
    publishedEvents: changesOf(was.publishedEvents, is.publishedEvents, (event) => event.type),
    consumedEvents: changesOf(was.consumedEvents, is.consumedEvents, (event) => `${event.type} ${event.handler}`),
    ports: changesOf(was.ports, is.ports, (port) => port.name),
  };
}

function isEmpty(changes: ContextChanges): boolean {
  return (
    changes.change === 'changed' &&
    [
      changes.useCases,
      changes.permissions,
      changes.routes,
      changes.publishedEvents,
      changes.consumedEvents,
      changes.ports,
    ].every((entries) => entries.length === 0)
  );
}
