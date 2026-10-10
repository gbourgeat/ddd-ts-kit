/**
 * The methods the read model calls on its model: `client.appointmentRow` fits as is on the
 * databases where Prisma offers `skipDuplicates` (PostgreSQL, MySQL, CockroachDB). The
 * arguments are built from the fields of the row at run time, which the generated types
 * cannot follow: they are typed as objects, and it is the model that validates them.
 */
export interface PrismaReadModelDelegate {
  /** `{ where, orderBy, take, skip }` */
  findMany(args?: object): Promise<object[]>;
  /** `{ where }` */
  count(args?: object): Promise<number>;
  /** `{ data: [row], skipDuplicates: true }` */
  createMany(args?: object): Promise<{ count: number }>;
  /** `{ where, data }` */
  updateMany(args?: object): Promise<{ count: number }>;
}
