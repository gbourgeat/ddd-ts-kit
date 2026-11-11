import { describe, expect, it } from 'vitest';
import {
  AsyncLocalStorageExecutionScope,
  InMemoryDomainEventDispatcher,
  InMemoryUnitOfWork,
  dispatchingOnSave,
  executionContext,
  systemActor,
  type DomainEventPhase,
  type ExecutionContext,
} from '../src';
import { Cart } from './support/shop/cart';
import { InMemoryCarts } from './support/shop/in-memory-carts';

const inTenant = (tenantId?: string): ExecutionContext =>
  executionContext({
    correlationId: 'relay',
    actor: systemActor('relay'),
    origin: 'schedule',
    ...(tenantId === undefined ? {} : { tenantId }),
  });

/** A shop whose handlers note the tenant of the work in progress when an event reaches them. */
function aShop(phase: DomainEventPhase, scoped = true) {
  const scope = new AsyncLocalStorageExecutionScope();
  const dispatcher = new InMemoryDomainEventDispatcher();
  const unitOfWork = new InMemoryUnitOfWork();
  const tenants: (string | undefined)[] = [];

  const carts = scoped
    ? dispatchingOnSave(
        new InMemoryCarts(),
        () => dispatcher,
        () => scope,
      )
    : dispatchingOnSave(new InMemoryCarts(), () => dispatcher);

  dispatcher.on('shop.cart.opened', async () => void tenants.push(scope.current()?.tenantId), { phase });

  /** A work for a tenant, as a command run inside the work in progress, in its unit of work. */
  const openFor = (tenantId: string, id: string): Promise<void> =>
    scope.run(inTenant(tenantId), () => unitOfWork.run(() => carts.save(Cart.open(id))));

  return { scope, unitOfWork, carts, tenants, openFor };
}

describe('the domain events of a save made in another execution context than the one of its unit of work', () => {
  it.each<DomainEventPhase>(['before-commit', 'after-commit'])(
    'reach their %s handlers in the execution context of the save',
    async (phase) => {
      const shop = aShop(phase);

      await shop.scope.run(inTenant(), () =>
        shop.unitOfWork.run(async () => {
          await shop.openFor('tenant-a', 'cart-1');
          await shop.openFor('tenant-b', 'cart-2');
        }),
      );

      expect(shop.tenants).toEqual(['tenant-a', 'tenant-b']);
    },
  );

  it('reach their handlers in the context of the unit of work when the repository is given no execution scope', async () => {
    const shop = aShop('before-commit', false);

    await shop.scope.run(inTenant(), () => shop.unitOfWork.run(() => shop.openFor('tenant-a', 'cart-1')));

    expect(shop.tenants).toEqual([undefined]);
  });

  it('leave together when two saves of the same execution context follow each other', async () => {
    const shop = aShop('before-commit');
    const batches: number[] = [];
    const counting = { dispatch: async (events: readonly unknown[]) => void batches.push(events.length) };

    const carts = dispatchingOnSave(
      new InMemoryCarts(),
      () => counting,
      () => shop.scope,
    );

    await shop.scope.run(inTenant('tenant-a'), () =>
      shop.unitOfWork.run(async () => {
        await carts.save(Cart.open('cart-1'));
        await carts.save(Cart.open('cart-2'));
      }),
    );

    expect(batches).toEqual([2, 2]);
  });

  it('reach their handlers outside of any execution context when the save had none', async () => {
    const shop = aShop('before-commit');

    await shop.unitOfWork.run(() => shop.carts.save(Cart.open('cart-1')));

    expect(shop.tenants).toEqual([undefined]);
  });
});
