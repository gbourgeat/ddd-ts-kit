import { ContractSuite } from '../contract-suite.js';
import { aJob } from './a-job.js';
import { LEASE_MS, NOW, QUEUE } from './job-fixtures.js';
import { later } from './later.js';
import type { JobStoreUnderContract } from './job-store-under-contract.js';

/** What `add` keeps and what `claim` hands out: due jobs of the queue, earliest first, each to one claim. */
export class ClaimSuite extends ContractSuite<JobStoreUnderContract> {
  protected tests(): void {
    this.handsOutWhatWasAdded();
    this.respectsTheInstant();
    this.dropsDuplicates();
    this.keepsTheKeysOfTenantsApart();
    this.leasesWhatItHandsOut();
  }

  private handsOutWhatWasAdded(): void {
    this.it('starts empty', async () => {
      this.expect(await this.subject.stats(QUEUE)).toEqual({ waiting: 0, running: 0, dead: 0 });
      this.expect(await this.claimedIds(10, NOW)).toEqual([]);
      this.expect(await this.subject.find('unknown')).toBe(undefined);
    });

    this.it('hands out the job exactly as added, the attempt counted, and shows it running', async () => {
      const added = await this.subject.add(aJob('job-1'));
      const [claimed] = await this.claim(10, NOW);
      const { enqueuedBy, payload, name } = aJob('job-1');

      this.expect(added).toEqual({ id: 'job-1', duplicate: false });

      this.expect(claimed).toEqual({
        id: 'job-1',
        name,
        queue: QUEUE,
        payload,
        enqueuedBy,
        enqueuedAt: NOW,
        attempt: 1,
      });

      this.expect((await this.subject.find('job-1'))?.status).toBe('running');
      this.expect(await this.subject.stats(QUEUE)).toEqual({ waiting: 0, running: 1, dead: 0 });
    });

    this.it('hands out the earliest first and only the jobs of the queue asked', async () => {
      await this.subject.add(aJob('job-1', { runAt: later(-1_000) }));
      await this.subject.add(aJob('job-2', { runAt: later(-3_000) }));
      await this.subject.add(aJob('job-3', { name: 'audit.verify-chain', queue: 'audit' }));
      await this.subject.add(aJob('job-4', { runAt: later(-1_000) }));

      this.expect(await this.claimedIds(10, NOW)).toEqual(['job-2', 'job-1', 'job-4']);
    });
  }

  private respectsTheInstant(): void {
    this.it('keeps a job due later until its instant', async () => {
      await this.subject.add(aJob('job-1', { runAt: later(60_000) }));

      this.expect(await this.claimedIds(10, later(59_999))).toEqual([]);
      this.expect(await this.claimedIds(10, later(60_000))).toEqual(['job-1']);
    });

    this.it('honours the limit and leaves the rest to the next claim', async () => {
      await this.addMany(['job-1', 'job-2', 'job-3']);

      this.expect(await this.claimedIds(2, NOW)).toEqual(['job-1', 'job-2']);
      this.expect(await this.claimedIds(2, NOW)).toEqual(['job-3']);
    });
  }

  private dropsDuplicates(): void {
    this.it('answers the job already kept for the same name and idempotency key, and adds nothing', async () => {
      await this.subject.add(aJob('job-1', { idempotencyKey: 'feb' }));

      const again = await this.subject.add(aJob('job-2', { idempotencyKey: 'feb' }));

      const otherName = await this.subject.add(
        aJob('job-3', { idempotencyKey: 'feb', name: 'billing.send-statements' }),
      );

      this.expect(again).toEqual({ id: 'job-1', duplicate: true });
      this.expect(otherName).toEqual({ id: 'job-3', duplicate: false });
      this.expect(await this.subject.find('job-2')).toBe(undefined);
    });
  }

  private keepsTheKeysOfTenantsApart(): void {
    this.it('keeps the idempotency keys of two tenants, and of work without a tenant, apart', async () => {
      await this.subject.add(aJob('job-1', { idempotencyKey: 'feb' }));

      const otherTenant = await this.subject.add(aJob('job-2', { idempotencyKey: 'feb', tenantId: 'tenant-4' }));
      const noTenant = await this.subject.add(aJob('job-3', { idempotencyKey: 'feb', tenantId: null }));
      const noTenantAgain = await this.subject.add(aJob('job-4', { idempotencyKey: 'feb', tenantId: null }));

      this.expect([otherTenant, noTenant, noTenantAgain]).toEqual([
        { id: 'job-2', duplicate: false },
        { id: 'job-3', duplicate: false },
        { id: 'job-3', duplicate: true },
      ]);
    });

    this.it('shows the tenant and the subject of a job, never its payload', async () => {
      await this.subject.add(aJob('job-1', { subject: 'customer-9' }));
      await this.subject.add(aJob('job-2', { tenantId: null }));

      const [first, second] = [await this.subject.find('job-1'), await this.subject.find('job-2')];

      this.expect([first?.tenantId, first?.subject, first !== undefined && 'payload' in first]).toEqual([
        'tenant-3',
        'customer-9',
        false,
      ]);

      this.expect([second?.tenantId, second?.subject]).toEqual([undefined, undefined]);
    });
  }

  private leasesWhatItHandsOut(): void {
    this.it('hides a claimed job until its lease ends, then hands it out again, one attempt more', async () => {
      await this.subject.add(aJob('job-1'));
      await this.claim(10, NOW);

      this.expect(await this.claimedIds(10, later(LEASE_MS - 1))).toEqual([]);
      const [again] = await this.claim(10, later(LEASE_MS));

      this.expect(again?.attempt).toBe(2);
    });

    this.it('keeps a job hidden while its heartbeats extend the lease', async () => {
      await this.subject.add(aJob('job-1'));
      await this.claim(10, NOW);

      this.expect(await this.subject.heartbeat({ id: 'job-1', attempt: 1 }, later(LEASE_MS * 2))).toBe(true);
      this.expect(await this.claimedIds(10, later(LEASE_MS))).toEqual([]);
      this.expect(await this.subject.heartbeat({ id: 'job-1', attempt: 2 }, later(LEASE_MS * 3))).toBe(false);
    });

    this.it('never hands the same job to two concurrent claims', async () => {
      await this.addMany(['job-1', 'job-2', 'job-3', 'job-4', 'job-5', 'job-6']);

      const batches = await Promise.all([this.claimedIds(4, NOW), this.claimedIds(4, NOW)]);
      const ids = batches.flat();

      this.expect(ids.length).toBe(6);
      this.expect(new Set(ids).size).toBe(6);
    });
  }

  private async addMany(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      await this.subject.add(aJob(id));
    }
  }

  private claim(limit: number, now: Date) {
    return this.subject.claim({ queue: QUEUE, limit, now, leaseMs: LEASE_MS });
  }

  private async claimedIds(limit: number, now: Date): Promise<string[]> {
    return (await this.claim(limit, now)).map((job) => job.id);
  }
}
