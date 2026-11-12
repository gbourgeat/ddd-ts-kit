// A migration is run by the knex CLI under plain node, which resolves no alias: it names the compiled code by its path.
// A deleted row of a read model keeps its key, its network and its stamp, and NULL in every other column: the
// columns of the row accept NULL, a check constraint keeps the live rows whole, the rows deleted before are emptied.
import { keepNoDataOfADeletedRow } from '../dist/src/platform/database/keep-no-data-of-a-deleted-row.js';

export const up = (knex) => keepNoDataOfADeletedRow(knex);

export const down = () => {
  throw new Error('Migrations are forward-only: a correction is a new migration.');
};
