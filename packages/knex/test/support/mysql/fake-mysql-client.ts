import ClientMySQL2 from 'knex/lib/dialects/mysql2';

/** One statement the kit sent, as knex handed it to the driver. */
export interface SentStatement {
  readonly sql: string;
  readonly bindings: readonly unknown[];
}

/** A query as knex hands it to a dialect client, and the response the client writes on it. */
interface Query {
  readonly sql: string;
  readonly bindings?: readonly unknown[];
  response?: unknown;
}

/**
 * The MySQL2 client of knex over a driver of the spec: the SQL compilers of knex write the
 * statements of the MySQL dialect, which are recorded instead of sent, and each is answered
 * with the result header a MySQL driver returns (`affectedRows`), as the spec sets it. No
 * server, no `mysql2` module: the driver, the connections and the query are the fake's.
 */
export class FakeMySqlClient extends ClientMySQL2 {
  readonly statements: SentStatement[] = [];

  /** What the header of the next answers says was written. */
  affectedRows = 1;

  /** The rows a select is answered with. */
  rows: readonly object[] = [];

  _driver(): object {
    return {};
  }

  override acquireRawConnection(): Promise<object> {
    return Promise.resolve({});
  }

  override destroyRawConnection(): Promise<void> {
    return Promise.resolve();
  }

  override validateConnection(): Promise<boolean> {
    return Promise.resolve(true);
  }

  _query(_connection: object, query: Query): Promise<Query> {
    this.statements.push({ sql: query.sql, bindings: query.bindings ?? [] });

    query.response = /^\s*select\b/i.test(query.sql)
      ? [this.rows, []]
      : [{ affectedRows: this.affectedRows, insertId: 0, warningStatus: 0 }, []];

    return Promise.resolve(query);
  }
}
