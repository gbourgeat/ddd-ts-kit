/** The dialect clients knex ships without types: the MySQL2 one, extended by the fake of the specs. */
declare module 'knex/lib/dialects/mysql2' {
  import type { Knex } from 'knex';

  const ClientMySQL2: typeof Knex.Client;

  export default ClientMySQL2;
}
