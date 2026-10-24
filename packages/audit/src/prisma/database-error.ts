/**
 * The error of PostgreSQL behind a Prisma error, with its SQLSTATE as `code`, as the other stores
 * of the trail answer it (`23505` for a second entry with one id, `23001` from the guard): Prisma
 * reports a raw statement that failed as `P2010` and keeps the code of the database in its
 * metadata. Any other error is answered as it is.
 */
export function databaseError(error: unknown): unknown {
  const cause: unknown = Reflect.get(
    Object(Reflect.get(Object(Reflect.get(Object(error), 'meta')), 'driverAdapterError')),
    'cause',
  );

  const code: unknown = Reflect.get(Object(cause), 'originalCode');
  const message: unknown = Reflect.get(Object(cause), 'originalMessage');

  if (typeof code !== 'string') {
    return error;
  }

  return Object.assign(
    new Error(typeof message === 'string' ? message : `PostgreSQL error ${code}`, { cause: error }),
    {
      code,
    },
  );
}
