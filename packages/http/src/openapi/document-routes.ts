import type { Route } from '../route/route.js';

/** The routes of one document of the contract. */
export interface DocumentRoutes {
  readonly name: string;
  readonly title?: string;
  readonly routes: readonly Route[];
}
