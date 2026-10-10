import { createTables } from '{{alias.platform}}/database/schema.js';

export const up = (knex) => createTables(knex);

export const down = () => {
  throw new Error('The initial migration is not reverted: drop the database instead.');
};
