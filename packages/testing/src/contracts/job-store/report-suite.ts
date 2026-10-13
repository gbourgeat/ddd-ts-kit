import { ContractSuite } from '../contract-suite.js';
import { aJob } from './a-job.js';
import { LEASE_MS, NOW, QUEUE } from './job-fixtures.js';
import { later } from './later.js';
import type { JobStoreUnderContract } from './job-store-under-contract.js';

const FIRST = { id: 'job-1', attempt: 1 };

/** What a worker reports of an attempt: progress and checkpoint, success, failure, release. Only the attempt that holds the job is heard. */
export class ReportSuite extends ContractSuite<JobStoreUnderContract> {
  protected tests(): void {
    this.progressAndOutcomes();
    this.deadAndRevived();
    this.releasedAndStale();
  }

  private progressAndOutcomes(): void {
    this.it('shows the progress and hands the checkpoint to the next attempt', async () => {
      await this.claimFirst();

      this.expect(await this.subject.update(FIRST, { progress: { done: 40, total: 120 } }, later(LEASE_MS))).toBe(true);
      this.expect(await this.subject.update(FIRST, { checkpoint: { after: 'c-1' } }, later(LEASE_MS))).toBe(true);
      this.expect((await this.subject.find('job-1'))?.progress).toEqual({ done: 40, total: 120 });

      const [resumed] = await this.claim(later(LEASE_MS));

      this.expect([resumed?.attempt, resumed?.checkpoint]).toEqual([2, { after: 'c-1' }]);
    });

    this.it('finishes a job that succeeded: never handed out again', async () => {
      await this.claimFirst();

      this.expect(await this.subject.complete(FIRST, later(5_000))).toBe(true);

      const job = await this.subject.find('job-1');

      this.expect([job?.status, job?.finishedAt]).toEqual(['succeeded', later(5_000)]);
      this.expect(await this.claim(later(LEASE_MS * 10))).toEqual([]);
      this.expect(await this.subject.stats(QUEUE)).toEqual({ waiting: 0, running: 0, dead: 0 });
    });

    this.it('retries a failed job at its instant, not before, with its error code', async () => {
      await this.claimFirst();

      this.expect(await this.subject.fail(FIRST, { errorCode: 'LEDGER_DOWN', retryAt: later(5_000), at: NOW })).toBe(
        true,
      );

      const waiting = await this.subject.find('job-1');

      this.expect([waiting?.status, waiting?.lastErrorCode, waiting?.runAt]).toEqual([
        'waiting',
        'LEDGER_DOWN',
        later(5_000),
      ]);

      this.expect(await this.claim(later(4_999))).toEqual([]);
      this.expect((await this.claim(later(5_000)))[0]?.attempt).toBe(2);
    });
  }

  private deadAndRevived(): void {
    this.it('sets a dead job aside, then revives it with a fresh attempt budget', async () => {
      await this.claimFirst();
      await this.subject.fail(FIRST, { errorCode: 'LEDGER_DOWN', retryAt: null, at: NOW });

      this.expect((await this.subject.find('job-1'))?.status).toBe('dead');
      this.expect(await this.subject.stats(QUEUE)).toEqual({ waiting: 0, running: 0, dead: 1 });
      this.expect(await this.claim(later(LEASE_MS * 10))).toEqual([]);
      this.expect(await this.subject.retryDead([], later(1_000))).toBe(0);
      this.expect(await this.subject.retryDead(['job-1', 'unknown'], later(1_000))).toBe(1);

      const [revived] = await this.claim(later(1_000));

      this.expect(revived?.attempt).toBe(1);
    });
  }

  private releasedAndStale(): void {
    this.it('takes a released job back without counting the attempt', async () => {
      await this.claimFirst();

      this.expect(await this.subject.release(FIRST, NOW)).toBe(true);
      this.expect((await this.subject.find('job-1'))?.status).toBe('waiting');
      this.expect((await this.claim(NOW))[0]?.attempt).toBe(1);
    });

    this.it('ignores an attempt whose lease was taken over', async () => {
      await this.claimFirst();
      await this.claim(later(LEASE_MS));

      this.expect(await this.subject.update(FIRST, { progress: { done: 1 } }, later(LEASE_MS * 2))).toBe(false);
      this.expect(await this.subject.complete(FIRST, later(LEASE_MS))).toBe(false);
      this.expect(await this.subject.fail(FIRST, { errorCode: 'X', retryAt: null, at: NOW })).toBe(false);
      this.expect(await this.subject.release(FIRST, NOW)).toBe(false);
      this.expect((await this.subject.find('job-1'))?.status).toBe('running');
      this.expect(await this.subject.complete({ id: 'job-1', attempt: 2 }, later(LEASE_MS))).toBe(true);
    });
  }

  private async claimFirst(): Promise<void> {
    await this.subject.add(aJob('job-1'));
    await this.claim(NOW);
  }

  private claim(now: Date) {
    return this.subject.claim({ queue: QUEUE, limit: 10, now, leaseMs: LEASE_MS });
  }
}
