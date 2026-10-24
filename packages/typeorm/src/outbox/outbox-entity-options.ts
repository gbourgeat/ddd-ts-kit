import type { EntityOptions } from './entity-options';

export interface OutboxEntityOptions extends EntityOptions {
  /**
   * Adds `tenant_id`, nullable, which `TypeOrmOutboxStore` fills from the tenant of each event
   * so that its consumers run in that tenant: the outbox of a multi-tenant project. A project
   * that becomes multi-tenant turns it on and generates the migration that adds the column.
   * Default false.
   */
  readonly tenant?: boolean;
}
