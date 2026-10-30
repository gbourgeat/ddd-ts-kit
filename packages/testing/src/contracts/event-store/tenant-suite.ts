import type { FixedExecutionScope } from '@ddd-ts-kit/kernel';
import { executionContext, systemActor, type EventStore, type ExecutionContext } from '@ddd-ts-kit/kernel';
import { ContractSuite } from '../contract-suite';
import { failureOf } from '../failure-of';
import { Consignment } from './consignment';
import { Consignments } from './consignments';
import { eventOf } from './event-of';

/** A store given the execution scope it reads the tenant from, fresh and empty. */
export interface TenantEventStore {
  readonly scope: FixedExecutionScope;
  readonly store: EventStore;
}

/**
 * Under shared-table tenancy a stream belongs to the tenant of its first append: another tenant
 * can neither read nor extend it, platform staff elevated over the tenant can read it, work that
 * names no tenant is refused before it reads or appends, and the whole store tells the tenant of
 * each event so that a projection runs it in that tenant. The repository of an aggregate answers
 * a stream of another tenant as it answers an id nobody saved.
 */
export class TenantSuite extends ContractSuite<TenantEventStore> {
  protected tests(): void {
    this.refusesAnotherTenant();
    this.letsStaffRead();
    this.refusesWorkThatNamesNoTenant();
    this.answersAsAnUnknownId();
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

    this.it('refuses to read a stream of another tenant from any version, past its end included', async () => {
      const { scope, store } = this.subject;

      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 0, [eventOf('e1')]);

      scope.enter(inTenant('globex'));

      const read = await failureOf(() => store.readStream('consignment-c1', 1));

      this.expect(nameOf(read)).toBe('EventStreamTenantError');
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
    });

    this.it('refuses an append to staff elevated over every tenant: a write names one tenant', async () => {
      const { scope, store } = this.subject;

      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 0, [eventOf('e1')]);

      scope.enter(elevated('all'));

      const held = await failureOf(() => store.append('consignment-c1', 1, [eventOf('e2')]));
      const fresh = await failureOf(() => store.append('consignment-c2', 0, [eventOf('e3')]));

      this.expect([nameOf(held), nameOf(fresh)]).toEqual(Array(2).fill('NoCurrentTenantError'));

      scope.enter(inTenant('acme'));
      this.expect((await store.readStream('consignment-c1')).map(({ id }) => id)).toEqual(['e1']);
      this.expect(await store.readStream('consignment-c2')).toEqual([]);
    });
  }

  private refusesWorkThatNamesNoTenant(): void {
    this.it('refuses a read and an append to work that names no tenant, and keeps the store as it was', async () => {
      const { scope, store } = this.subject;

      scope.enter(inTenant('acme'));
      await store.append('consignment-c1', 0, [eventOf('e1')]);

      scope.enter(unscoped());

      const failures = [
        await failureOf(() => store.readStream('consignment-c1')),
        await failureOf(() => store.readStream('consignment-unknown')),
        await failureOf(() => store.append('consignment-c1', 1, [eventOf('e2')])),
        await failureOf(() => store.append('consignment-c1', 1, [])),
        await failureOf(() => store.append('consignment-unknown', 0, [eventOf('e3')])),
      ];

      this.expect(failures.map(nameOf)).toEqual(Array(5).fill('NoCurrentTenantError'));

      this.expect((await store.readAll(0, 10)).map(({ id }) => id)).toEqual(['e1']);
    });

    this.it('refuses a read and an append outside any execution scope', async () => {
      const { store } = this.subject;

      const read = await failureOf(() => store.readStream('consignment-c1'));
      const append = await failureOf(() => store.append('consignment-c1', 0, [eventOf('e1')]));

      this.expect([nameOf(read), nameOf(append)]).toEqual(Array(2).fill('NoCurrentTenantError'));
      this.expect(await store.head()).toBe(0);
    });
  }

  private answersAsAnUnknownId(): void {
    this.it('answers an aggregate of another tenant as it answers an id nobody saved', async () => {
      const { scope, store } = this.subject;
      const consignments = new Consignments(store);

      scope.enter(inTenant('acme'));
      await consignments.save(Consignment.register('c1'));
      this.expect((await consignments.findById('c1'))?.id).toBe('c1');

      scope.enter(inTenant('globex'));
      this.expect(await consignments.findById('c1')).toBe(undefined);
      this.expect(await consignments.findById('nobody-saved-it')).toBe(undefined);

      scope.enter(unscoped());
      this.expect(nameOf(await failureOf(() => consignments.findById('c1')))).toBe('NoCurrentTenantError');
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
