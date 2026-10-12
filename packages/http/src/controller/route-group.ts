import { DeclarationError } from '@ddd-ts-kit/kernel/declarations';
import { presentationRegistry } from './presentation-registry.js';
import type { RouteGroupClass } from './route-group-class.js';
import type { RouteGroupOptions } from './route-group-options.js';

const PREFIX_PATTERN = /^(\/(:[A-Za-z_][A-Za-z0-9_]*|[A-Za-z0-9._~-]+))*$/;

/**
 * Names a set of routes that share a prefix, tags and guards:
 * `@RouteGroup({ prefix: '/appointments', tags: ['scheduling'], guards: [Authenticated] })` on
 * an empty class. A controller names the class as its `group`; a group may refine another
 * through `parent`. The class is never built: it is the name of the set.
 */
export function RouteGroup(options: RouteGroupOptions = {}): (target: RouteGroupClass, context?: unknown) => void {
  return (target) => {
    const { groups } = presentationRegistry();

    if (groups.has(target)) {
      throw new DeclarationError(`${target.name} is declared as a route group twice.`);
    }

    if (!PREFIX_PATTERN.test(options.prefix ?? '')) {
      throw new DeclarationError(
        `Route group ${target.name}: the prefix "${options.prefix}" must be made of literal segments and ":name" parameters, with no trailing slash.`,
      );
    }

    if (options.parent !== undefined && !groups.has(options.parent)) {
      throw new DeclarationError(
        `Route group ${target.name}: its parent ${options.parent.name} carries no @RouteGroup.`,
      );
    }

    groups.set(target, Object.freeze({ ...options }));
  };
}
