import { tenantReachOf, tenantScopeOf, type ExecutionScope, type Repository } from '@ddd-ts-kit/kernel';
import { Order, type OrderSnapshot } from './order';

interface StoredOrder {
  readonly tenantId: string;
  readonly snapshot: OrderSnapshot;
  readonly version: number;
}

/** A repository of shared storage that confines every read and write to the tenant of the work, as an adapter must. */
export class TenantOrders implements Repository<Order> {
  private readonly rows = new Map<string, StoredOrder>();

  constructor(private readonly scope: ExecutionScope) {}

  findById(id: string): Promise<Order | undefined> {
    const reach = tenantReachOf(this.scope);
    const row = this.rows.get(id);

    const reached =
      row !== undefined &&
      (reach.kind === 'tenant'
        ? row.tenantId === reach.tenantId
        : reach.tenants === 'all' || reach.tenants.includes(row.tenantId));

    if (!reached) {
      return Promise.resolve(undefined);
    }

    const order = Order.rehydrate(row.snapshot);

    order.version = row.version;

    return Promise.resolve(order);
  }

  save(order: Order): Promise<void> {
    const { tenantId } = tenantScopeOf(this.scope);
    const row = this.rows.get(order.id);
    const expected = order.version;

    if (expected === 0 ? row !== undefined : row?.tenantId !== tenantId || row.version !== expected) {
      return Promise.reject(new Error(`Order ${order.id} changed or belongs to another tenant`));
    }

    this.rows.set(order.id, { tenantId, snapshot: order.toSnapshot(), version: expected + 1 });
    order.version = expected + 1;

    return Promise.resolve();
  }
}
