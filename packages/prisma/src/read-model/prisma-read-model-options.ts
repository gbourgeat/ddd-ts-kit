import type { PrismaReadModelDelegate } from './prisma-read-model-delegate';
import type { PrismaReadModelTenant } from './prisma-read-model-tenant';

export interface PrismaReadModelOptions<Row, Tx> {
  /** How to reach the model from a client: `(client) => client.appointmentRow`. */
  readonly delegate: (client: Tx) => PrismaReadModelDelegate;
  /** The table of the model (`@@map`), and its schema (`@@schema`): the rebuild works on the table. */
  readonly table: string;
  readonly schema?: string;
  /** The column of every field of the row (`@map`): `{ startsAt: 'starts_at' }`. */
  readonly columns: Readonly<Record<keyof Row & string, string>>;
  /** The field of the key, which is the `@id` of the model. Default `id`. */
  readonly key?: keyof Row & string;
  /** For a read model of tenant data: the scope that names the tenant of the work, and the field that holds it. */
  readonly tenant?: PrismaReadModelTenant;
}
