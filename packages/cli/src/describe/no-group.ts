import type { RouteGroupFact } from './route-group-fact';

/** What a route that names no group gets from one: nothing. */
export const NO_GROUP: RouteGroupFact = { name: '', prefix: '', guards: [], errors: [], tags: [] };
