import { describe, expect, it } from 'vitest';
import { verifyChain } from '../../src';
import { gate } from './gate';
import { CHAIN, aRecord, sequencesOf, type SqlTrailSpecs } from './sql-trail-fixture';

/** Where the head of a chain is taken in a unit of work: at its commit, after every other lock. */
export function lockSpecs(specs: SqlTrailSpecs): void {
  describe(`${specs.name}: the head taken at the commit`, () => {
    it.skipIf(!specs.real)(
      'takes the head only at the commit: an append from elsewhere does not wait for a unit of work at its work',
      async () => {
        const here = await specs.create();
        const there = here.elsewhere();
        const order: string[] = [];
        const committing = gate();

        const first = here.unitOfWork.run(async () => {
          await here.trail.record(aRecord('entry-first'));
          order.push('first recorded');
          await committing.opened;
          order.push('first commits');
        });

        await expect.poll(() => order).toEqual(['first recorded']);
        await there.trail.record(aRecord('entry-second'));
        order.push('second wrote');
        committing.open();
        await first;

        expect(order).toEqual(['first recorded', 'second wrote', 'first commits']);

        expect(await sequencesOf(here.trail)).toEqual([
          { id: 'entry-second', sequence: 1 },
          { id: 'entry-first', sequence: 2 },
        ]);

        expect(await verifyChain(here.trail, { chain: CHAIN })).toEqual({ valid: true, checked: 2 });
      },
    );

    it.skipIf(!specs.real)(
      'never deadlocks two units of work that create the head of one chain and take a row in opposite orders',
      async () => {
        const here = await specs.create();
        const there = here.elsewhere();
        const recorded = gate();
        const taken = gate();

        await here.run('create table $schema."appointments" ("id" text primary key, "status" text not null)');
        await here.run(`insert into $schema."appointments" values ('apt-1', 'booked')`);

        const first = here.unitOfWork.run(async () => {
          await here.trail.record(aRecord('entry-first'));
          recorded.open();
          await taken.opened;
          await here.run(`update $schema."appointments" set "status" = 'cancelled' where "id" = 'apt-1'`);
        });

        const second = there.unitOfWork.run(async () => {
          await recorded.opened;
          await there.run(`update $schema."appointments" set "status" = 'rescheduled' where "id" = 'apt-1'`);
          taken.open();
          await there.trail.record(aRecord('entry-second'));
        });

        await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
        expect(await verifyChain(here.trail, { chain: CHAIN })).toEqual({ valid: true, checked: 2 });
      },
    );

    it.skipIf(!specs.real)(
      'never deadlocks two units of work that append to two chains in opposite orders',
      async () => {
        const here = await specs.create();
        const there = here.elsewhere();
        const firstOnAcme = gate();
        const secondOnOther = gate();

        const first = here.unitOfWork.run(async () => {
          await here.trail.record(aRecord('first-acme'));
          firstOnAcme.open();
          await secondOnOther.opened;
          await here.trail.record(aRecord('first-other', 'other'));
        });

        const second = there.unitOfWork.run(async () => {
          await firstOnAcme.opened;
          await there.trail.record(aRecord('second-other', 'other'));
          secondOnOther.open();
          await there.trail.record(aRecord('second-acme'));
        });

        await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined]);
        expect(await verifyChain(here.trail, { chain: CHAIN })).toEqual({ valid: true, checked: 2 });
        expect(await verifyChain(here.trail, { chain: 'tenant:other' })).toEqual({ valid: true, checked: 2 });
      },
    );

    it.skipIf(!specs.real)(
      'writes what a unit of work of another database recorded once it ended inside the one it was opened in',
      async () => {
        const here = await specs.create();
        const there = here.elsewhere();

        await here.unitOfWork.run(() => there.unitOfWork.run(() => there.trail.record(aRecord('entry-1'))));

        expect(await sequencesOf(here.trail)).toEqual([{ id: 'entry-1', sequence: 1 }]);
      },
    );
  });
}
