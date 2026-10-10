// A migration is run by the knex CLI under plain node, which resolves no alias: it names the compiled schema by its path.
import { createTables } from '../dist/{{config.platformDir}}/database/schema.js';

export const up = (knex) => createTables(knex);

export const down = () => {
  throw new Error('The initial migration is not reverted: drop the database instead.');
};
