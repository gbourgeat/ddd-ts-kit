import { describe, expect, it } from 'vitest';
import { InMemoryCommandBus, atCommit, unitOfWorkMiddleware } from '@ddd-ts-kit/kernel';
import { auditMiddleware, verifyChain, type AuditCheckpoint } from '../../src';
import { aSource, ada } from './fixtures';
import { CancelAppointmentCommand } from './scheduling/application/commands/cancel-appointment.command';
import { AppointmentAlreadyCancelled } from './scheduling/domain/errors/appointment-already-cancelled';
import { lockSpecs } from './sql-trail-lock-specs';
import { CHAIN, aRecord, sequencesOf, type SqlTrailSpecs } from './sql-trail-fixture';

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
  atCommitSpecs(specs);
  concurrencySpecs(specs);
  lockSpecs(specs);
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

function atCommitSpecs(specs: SqlTrailSpecs): void {
  describe(`${specs.name}: written at the commit of the unit of work`, () => {
    it('writes what a unit of work recorded at its commit, each chain in the order of its records', async () => {
      const { trail, unitOfWork } = await specs.create();

      const beforeTheCommit = await unitOfWork.run(async () => {
        await trail.record(aRecord('acme-1'));
        await trail.record(aRecord('other-1', 'other'));
        await trail.record(aRecord('acme-2'));

        return sequencesOf(trail);
      });

      expect(beforeTheCommit).toEqual([]);

      expect(await sequencesOf(trail)).toEqual([
        { id: 'acme-1', sequence: 1 },
        { id: 'acme-2', sequence: 2 },
      ]);

      expect(await sequencesOf(trail, 'tenant:other')).toEqual([{ id: 'other-1', sequence: 1 }]);
    });

    it('writes a record made at the commit, once the others were written', async () => {
      const { trail, unitOfWork } = await specs.create();

      await unitOfWork.run(async () => {
        await trail.record(aRecord('entry-1'));
        await atCommit({ apply: () => trail.record(aRecord('entry-2')), undo: async () => undefined });
      });

      expect(await sequencesOf(trail)).toEqual([
        { id: 'entry-1', sequence: 1 },
        { id: 'entry-2', sequence: 2 },
      ]);

      expect(await verifyChain(trail, { chain: CHAIN })).toEqual({ valid: true, checked: 2 });
    });

    it('leaves no entry when a step after the entries fails the commit', async () => {
      const { trail, unitOfWork } = await specs.create();

      const failing = unitOfWork.run(async () => {
        await trail.record(aRecord('entry-1'));

        await atCommit({
          apply: () => Promise.reject(new Error('The step after the entries failed')),
          undo: async () => undefined,
        });
      });

      await expect(failing).rejects.toThrow('The step after the entries failed');
      expect(await sequencesOf(trail)).toEqual([]);
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
  });
}
