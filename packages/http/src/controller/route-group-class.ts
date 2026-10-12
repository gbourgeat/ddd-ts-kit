/** A class decorated with `@RouteGroup`: it is never built, it names a set of routes. */
export type RouteGroupClass = abstract new (...args: never) => unknown;
