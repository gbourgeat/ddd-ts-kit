// A migration is run by the knex CLI under plain node, which resolves no alias: it names the compiled code by its path.
// Every table of the contexts holds the data of one network of practices (ADR-0003). On a database created before,
// the rows already there go to the network named by NETWORK_OF_EXISTING_ROWS; a table that holds rows and no
// network named is refused, and nothing changes.
import process from 'node:process';
import { keepTheNetworkOfEveryRow } from '../dist/src/platform/database/keep-the-network-of-every-row.js';

export const up = (knex) => keepTheNetworkOfEveryRow(knex, process.env.NETWORK_OF_EXISTING_ROWS);

export const down = () => {
  throw new Error('Migrations are forward-only: a correction is a new migration.');
};
