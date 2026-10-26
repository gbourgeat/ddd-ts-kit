import type { StackFlags } from '../helpers';

/** What a developer of Nest writes: Nest controllers, class-validator, and the bearer tokens verified by a strategy of Passport. */
export const NEST_WITH_PASSPORT: StackFlags = {
  http: 'nest',
  validation: 'class-validator',
  di: 'nest',
  tests: 'vitest',
  orm: 'knex',
  events: 'outbox',
  authn: 'passport',
};
