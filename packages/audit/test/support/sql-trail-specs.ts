import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, unitOfWorkMiddleware, type UnitOfWork } from '@ddd-ts-kit/kernel';
import {
  auditMiddleware,
  verifyChain,
  type AuditCheckpoint,
  type AuditRecord,
  type AuditTrailOptions,
} from '../../src/index.js';
import type { AuditTrailUnderContract } from '../../src/testing.js';
import { NOW, aSource, ada } from './fixtures.js';
import { CancelAppointmentCommand } from './scheduling/application/commands/cancel-appointment.command.js';
import { AppointmentAlreadyCancelled } from './scheduling/domain/errors/appointment-already-cancelled.js';

/** What a spec of a SQL store gives: a fresh schema with the tables and the guard, per call. */
export interface SqlTrailFixture {
  readonly trail: AuditTrailUnderContract;
  readonly unitOfWork: UnitOfWork;
  /** Runs one statement on the connection of the unit of work in progress, or on the database. `$table` names the entries table. */
  run(statement: string): Promise<{ readonly rows: readonly Record<string, unknown>[] }>;
  /** The same trail and unit of work on a pool of their own, as another process would have. */
  elsewhere(): { readonly trail: AuditTrailUnderContract; readonly unitOfWork: UnitOfWork };
}

export interface SqlTrailSpecs {
  readonly name: string;
  /** True when the tests run on a real server: several connections, real concurrency. */
  readonly real: boolean;
  create(options?: AuditTrailOptions): Promise<SqlTrailFixture>;
}

export const REAL_SERVER = (process.env['DDD_TS_KIT_TEST_DATABASE_URL'] ?? '') !== '';

export function aRecord(id: string, tenantId = 'acme'): AuditRecord {
  return {
    id,
    occurredAt: NOW,
    category: 'data-access',
    action: 'scheduling.appointments.export',
    outcome: 'succeeded',
    actor: { id: 'ada', type: 'user', tenantId },
    tenantId,
    correlationId: 'correlation-1',
    origin: 'http',
  };
}

const CHAIN = 'tenant:acme';

/** The SQLSTATE a statement failed with, whether the driver error comes bare (knex) or as the cause of another (drizzle). */
async function sqlStateOf(statement: Promise<unknown>): Promise<unknown> {
  const failure: { code?: unknown; cause?: { code?: unknown } } | undefined = await statement.then(
    () => undefined,
    (error: unknown) => error as { code?: unknown },
  );

  return failure?.code ?? failure?.cause?.code;
}

/** What both SQL stores are held to beyond the contract of the port: the database itself. */
export function sqlTrailSpecs(specs: SqlTrailSpecs): void {
  appendOnlySpecs(specs);
  unitOfWorkSpecs(specs);
  concurrencySpecs(specs);
}

function appendOnlySpecs(specs: SqlTrailSpecs): void {
  describe(`${specs.name}: append-only at the database level`, () => {
    for (const [what, statement] of [
      ['an UPDATE', `update $table set "action" = 'forged'`],
      ['a DELETE', 'delete from $table'],
      ['a TRUNCATE', 'truncate table $table'],
    ] as const) {
      it(`refuses ${what} of the entries, whoever asks`, async () => {
        const { trail, run } = await specs.create();

        await trail.record(aRecord('entry-1'));

        expect(await sqlStateOf(run(statement))).toBe('23001');

        expect((await run('select "action" from $table')).rows).toEqual([{ action: 'scheduling.appointments.export' }]);
      });
    }

    it('refuses a second entry with the id of one it holds', async () => {
      const { trail } = await specs.create();

      await trail.record(aRecord('entry-1'));

      expect(await sqlStateOf(trail.record(aRecord('entry-1')))).toBe('23505');

      expect(await verifyChain(trail, { chain: CHAIN })).toEqual({ valid: true, checked: 1 });
    });
  });
}

function unitOfWorkSpecs(specs: SqlTrailSpecs): void {
  describe(`${specs.name}: on the transaction of the unit of work`, () => {
    it('rolls the entry back with the unit of work, and reuses its position', async () => {
      const { trail, unitOfWork } = await specs.create();

      await trail.record(aRecord('entry-1'));

      const failing = unitOfWork.run(async () => {
        await trail.record(aRecord('entry-2'));
        throw new Error('The handler failed after the entry was written');
      });

      await expect(failing).rejects.toThrow('The handler failed');
      await unitOfWork.run(() => trail.record(aRecord('entry-3')));

      const { items } = await trail.search({}, { kind: 'offset', offset: 0, limit: 10, sort: [] });

      expect(items.map(({ id, sequence }) => ({ id, sequence }))).toEqual([
        { id: 'entry-1', sequence: 1 },
        { id: 'entry-3', sequence: 2 },
      ]);

      expect(await verifyChain(trail, { chain: CHAIN })).toEqual({ valid: true, checked: 2 });
    });

    it('keeps the entry of a failed command and drops what the command wrote', async () => {
      const { trail, unitOfWork, run } = await specs.create();

      const commands = new InMemoryCommandBus()
        .use(auditMiddleware(trail, { ...aSource(), unitOfWork }))
        .use(unitOfWorkMiddleware(unitOfWork))
        .register(CancelAppointmentCommand, {
          execute: async (command) => {
            await trail.record(aRecord(`export-before-${command.appointmentId}`));

            if (command.appointmentId === 'apt-gone') {
              throw new AppointmentAlreadyCancelled('Already cancelled');
            }
          },
        });

      await commands.execute(new CancelAppointmentCommand(ada, 'apt-1'));

      await expect(commands.execute(new CancelAppointmentCommand(ada, 'apt-gone'))).rejects.toThrow(
        AppointmentAlreadyCancelled,
      );

      const rows = (await run('select "id", "action", "outcome", "reason" from $table order by "sequence"')).rows;

      expect(rows).toEqual([
        { id: 'export-before-apt-1', action: 'scheduling.appointments.export', outcome: 'succeeded', reason: null },
        { id: 'audit-1', action: 'CancelAppointmentCommand', outcome: 'succeeded', reason: null },
        {
          id: 'audit-2',
          action: 'CancelAppointmentCommand',
          outcome: 'failed',
          reason: 'APPOINTMENT_ALREADY_CANCELLED',
        },
      ]);

      expect(await verifyChain(trail, { chain: CHAIN })).toEqual({ valid: true, checked: 3 });
    });

    it('hands the checkpoint over inside the unit of work, where an outbox would take it', async () => {
      const sealed: { checkpoint: AuditCheckpoint; visible: number }[] = [];

      const fixture = await specs.create({
        sealing: {
          every: 2,
          onSeal: async (checkpoint) => {
            const { rows } = await fixture.run('select count(*)::int as "visible" from $table');

            sealed.push({ checkpoint, visible: Number(rows[0]?.['visible']) });
          },
        },
      });

      const { trail, unitOfWork } = fixture;

      await unitOfWork.run(async () => {
        for (const id of ['entry-1', 'entry-2', 'entry-3']) {
          await trail.record(aRecord(id));
        }
      });

      const { items } = await trail.search({ chain: CHAIN }, { kind: 'offset', offset: 0, limit: 10, sort: [] });

      expect(sealed).toEqual([{ checkpoint: { chain: CHAIN, sequence: 2, hash: items[1]?.hash }, visible: 2 }]);
    });
  });
}

function concurrencySpecs(specs: SqlTrailSpecs): void {
  describe(`${specs.name}: concurrent appends`, () => {
    it.skipIf(!specs.real)('never forks a chain under appends from several connections and processes', async () => {
      const here = await specs.create();
      const there = here.elsewhere();
      const records = Array.from({ length: 60 }, (_, index) => aRecord(`entry-${index}`));

      await Promise.all(records.map((record, index) => (index % 2 === 0 ? here.trail : there.trail).record(record)));

      const { items } = await here.trail.search(
        { chain: CHAIN },
        { kind: 'offset', offset: 0, limit: 100, sort: [{ field: 'sequence', direction: 'asc' }] },
      );

      expect(items.map((entry) => entry.sequence)).toEqual(records.map((_, index) => index + 1));
      expect(await verifyChain(here.trail, { chain: CHAIN })).toEqual({ valid: true, checked: 60 });
    });

    it.skipIf(!specs.real)('leaves no gap when concurrent units of work commit and roll back', async () => {
      const here = await specs.create();
      const there = here.elsewhere();

      const work = Array.from({ length: 30 }, (_, index) => {
        const { trail, unitOfWork } = index % 2 === 0 ? here : there;

        return unitOfWork
          .run(async () => {
            await trail.record(aRecord(`entry-${index}`));
            await trail.record(aRecord(`entry-${index}-bis`));

            if (index % 3 === 0) {
              throw new Error('rolled back on purpose');
            }
          })
          .then(
            () => 'committed',
            () => 'rolled back',
          );
      });

      const outcomes = await Promise.all(work);

      const committed = outcomes.filter((outcome) => outcome === 'committed').length * 2;

      expect(committed).toBe(40);
      expect(await verifyChain(here.trail, { chain: CHAIN })).toEqual({ valid: true, checked: committed });

      expect(await verifyChain(here.trail, { chain: CHAIN, to: committed + 1 })).toMatchObject({
        valid: false,
        break: { kind: 'missing-entry' },
      });
    });

    it.skipIf(!specs.real)(
      'makes a second append wait for the transaction that holds the head of the chain',
      async () => {
        const here = await specs.create();
        const there = here.elsewhere();
        const order: string[] = [];
        let release: () => void = () => undefined;

        const held = new Promise<void>((resolve) => {
          release = resolve;
        });

        const first = here.unitOfWork.run(async () => {
          await here.trail.record(aRecord('entry-first'));
          order.push('first wrote');
          await held;
          order.push('first commits');
        });

        await expect.poll(() => order).toEqual(['first wrote']);
        const second = there.trail.record(aRecord('entry-second')).then(() => order.push('second wrote'));
        const other = there.trail.record(aRecord('entry-other', 'other')).then(() => order.push('other tenant wrote'));

        await other;
        release();
        await Promise.all([first, second]);

        expect(order).toEqual(['first wrote', 'other tenant wrote', 'first commits', 'second wrote']);
        expect(await verifyChain(here.trail, { chain: CHAIN })).toEqual({ valid: true, checked: 2 });
      },
    );
  });
}
