import type { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import { executionContext, systemActor, type EventStore, type ExecutionContext } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import { failureOf } from '../failure-of';
import { eventOf } from './event-of';

/** A store given the execution scope it reads the tenant from, fresh and empty. */
export interface TenantEventStore {
  readonly scope: FixedExecutionScope;
  readonly store: EventStore;
}

/**
 * Under shared-table tenancy a stream belongs to the tenant of its first append: another tenant
 * can neither read nor extend it, platform staff elevated over the tenant can read it, work that
 * names no tenant is not scoped (a project without tenancy), and the whole store tells the tenant
 * of each event so that a projection runs it in that tenant.
 */
export class TenantSuite extends ContractSuite<TenantEventStore> {
  protected tests(): void {
    this.refusesAnotherTenant();
    this.letsStaffRead();
    this.leavesUnscopedWorkAlone();
    this.tellsTheTenantOfEachEvent();
  }

  private refusesAnotherTenant(): void {
    this.it('refuses to read a stream of another tenant, and to append to it, and keeps it as it was', async () => {
      const { scope, store } = this.subject;

      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 0, [eventOf('e1')]);
      this.expect((await store.readStream('consignment-c1')).map(({ id }) => id)).toEqual(['e1']);
      await store.append('consignment-c1', 1, [eventOf('e2')]);

      scope.enter(inTenant('globex'));

      const read = await failureOf(() => store.readStream('consignment-c1'));
      const append = await failureOf(() => store.append('consignment-c1', 2, [eventOf('e3')]));
      const empty = await failureOf(() => store.append('consignment-c1', 2, []));

      this.expect([nameOf(read), nameOf(append), nameOf(empty)]).toEqual(Array(3).fill('EventStreamTenantError'));

      scope.enter(inTenant('acme'));
      this.expect((await store.readStream('consignment-c1')).map(({ id }) => id)).toEqual(['e1', 'e2']);
    });

    this.it('keeps one stream per tenant even when two tenants use the same id', async () => {
      const { scope, store } = this.subject;

      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 0, [eventOf('e1')]);

      scope.enter(inTenant('globex'));

      this.expect(nameOf(await failureOf(() => store.append('consignment-c1', 0, [eventOf('e2')])))).toBe(
        'EventStreamTenantError',
      );

      await store.append('consignment-c2', 0, [eventOf('e3')]);
      this.expect((await store.readStream('consignment-c2')).map(({ id }) => id)).toEqual(['e3']);
    });
  }

  private letsStaffRead(): void {
    this.it('lets platform staff elevated over the tenant read its stream, and no other', async () => {
      const { scope, store } = this.subject;

      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 0, [eventOf('e1')]);

      scope.enter(elevated(['acme']));
      this.expect((await store.readStream('consignment-c1')).map(({ id }) => id)).toEqual(['e1']);

      scope.enter(elevated('all'));
      this.expect((await store.readStream('consignment-c1')).map(({ id }) => id)).toEqual(['e1']);

      scope.enter(elevated(['globex']));
      this.expect(nameOf(await failureOf(() => store.readStream('consignment-c1')))).toBe('EventStreamTenantError');

      this.expect(nameOf(await failureOf(() => store.append('consignment-c1', 1, [eventOf('e2')])))).toBe(
        'EventStreamTenantError',
      );
    });
  }

  private leavesUnscopedWorkAlone(): void {
    this.it('refuses nothing to work that names no tenant, and records none for it', async () => {
      const { scope, store } = this.subject;

      scope.enter(unscoped());
      await store.append('consignment-c1', 0, [eventOf('e1')]);

      this.expect((await store.readStream('consignment-c1'))[0]?.tenantId).toBe(undefined);

      scope.enter(inTenant('acme'));
      await store.append('consignment-c2', 0, [eventOf('e2')]);

      scope.enter(unscoped());
      this.expect((await store.readStream('consignment-c2')).map(({ id }) => id)).toEqual(['e2']);
      await store.append('consignment-c2', 1, [eventOf('e3')]);
      this.expect((await store.readStream('consignment-c2')).map(({ tenantId }) => tenantId)).toEqual(['acme', 'acme']);
    });
  }

  private tellsTheTenantOfEachEvent(): void {
    this.it('gives each event of the whole store the tenant of its stream', async () => {
      const { scope, store } = this.subject;

      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 0, [eventOf('a1')]);
      scope.enter(inTenant('globex'));
      await store.append('consignment-c2', 0, [eventOf('b1')]);
      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 1, [eventOf('a2')]);

      scope.enter(unscoped());

      const all = await store.readAll(0, 10);

      this.expect(all.map(({ id, tenantId }) => `${id}@${tenantId}`)).toEqual(['a1@acme', 'b1@globex', 'a2@acme']);
    });
  }
}

function inTenant(tenantId: string): ExecutionContext {
  return executionContext({
    correlationId: `in-${tenantId}`,
    actor: systemActor('contract'),
    origin: 'event',
    tenantId,
  });
}

function elevated(tenants: 'all' | readonly string[]): ExecutionContext {
  return executionContext({
    correlationId: 'staff',
    actor: systemActor('contract'),
    origin: 'http',
    elevation: { reason: 'SUPPORT_TICKET', tenants },
  });
}

function unscoped(): ExecutionContext {
  return executionContext({ correlationId: 'none', actor: systemActor('contract'), origin: 'event' });
}

function nameOf(failure: unknown): unknown {
  return typeof failure === 'object' && failure !== null && 'name' in failure ? failure.name : undefined;
}
