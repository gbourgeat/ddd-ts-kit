import { ContractSuite } from '../contract-suite';
import { aJob } from './a-job';
import { LEASE_MS, NOW, QUEUE } from './job-fixtures';
import { later } from './later';
import type { JobStoreUnderContract } from './job-store-under-contract';

/** Cancellation, housekeeping and the erasure of a subject. */
export class KeepSuite extends ContractSuite<JobStoreUnderContract> {
  protected tests(): void {
    this.cancels();
    this.purges();
    this.erasesASubject();
  }

  private cancels(): void {
    this.it('cancels a waiting job: it is never handed out', async () => {
      await this.subject.add(aJob('job-1', { runAt: later(60_000) }));

      this.expect(await this.subject.cancel('job-1', NOW)).toBe(true);

      const job = await this.subject.find('job-1');

      this.expect([job?.status, job?.finishedAt]).toEqual(['cancelled', NOW]);
      this.expect(await this.claim(later(60_000))).toEqual([]);
    });

    this.it('cancels a running job: its next report is refused', async () => {
      await this.subject.add(aJob('job-1'));
      await this.claim(NOW);

      this.expect(await this.subject.cancel('job-1', NOW)).toBe(true);
      this.expect(await this.subject.heartbeat({ id: 'job-1', attempt: 1 }, later(LEASE_MS))).toBe(false);
      this.expect(await this.subject.complete({ id: 'job-1', attempt: 1 }, NOW)).toBe(false);
    });

    this.it('cannot cancel what is over or unknown', async () => {
      await this.subject.add(aJob('job-1'));
      await this.claim(NOW);
      await this.subject.complete({ id: 'job-1', attempt: 1 }, NOW);

      this.expect(await this.subject.cancel('job-1', NOW)).toBe(false);
      this.expect(await this.subject.cancel('unknown', NOW)).toBe(false);
    });
  }

  private purges(): void {
    this.it('purges what succeeded or was cancelled before the instant, and keeps the dead', async () => {
      await this.finished('job-1', (lease) => this.subject.complete(lease, NOW));
      await this.finished('job-2', (lease) => this.subject.fail(lease, { errorCode: 'X', retryAt: null, at: NOW }));
      await this.subject.add(aJob('job-3', { runAt: later(60_000) }));
      await this.subject.cancel('job-3', later(1_000));

      this.expect(await this.subject.purgeFinished(NOW)).toBe(0);
      this.expect(await this.subject.purgeFinished(later(1_001))).toBe(2);
      this.expect(await this.subject.find('job-1')).toBe(undefined);
      this.expect((await this.subject.find('job-2'))?.status).toBe('dead');
    });
  }

  private erasesASubject(): void {
    this.it('drops every job of a subject, whatever its status: none runs, none keeps its payload', async () => {
      await this.finished('job-1', (lease) => this.subject.complete(lease, NOW), 'cus-1');

      await this.finished(
        'job-2',
        (lease) => this.subject.fail(lease, { errorCode: 'X', retryAt: null, at: NOW }),
        'cus-1',
      );

      await this.subject.add(aJob('job-3', { runAt: later(60_000), subject: 'cus-1' }));
      await this.subject.add(aJob('job-4', { runAt: later(60_000), subject: 'cus-1' }));
      await this.subject.cancel('job-4', NOW);

      this.expect(await this.subject.eraseSubject('cus-1')).toBe(4);

      for (const id of ['job-1', 'job-2', 'job-3', 'job-4']) {
        this.expect(await this.subject.find(id)).toBe(undefined);
      }

      this.expect(await this.claim(later(60_000))).toEqual([]);
      this.expect(await this.subject.retryDead(['job-2'], later(60_000))).toBe(0);
      this.expect(await this.subject.stats(QUEUE)).toEqual({ waiting: 0, running: 0, dead: 0 });
    });

    this.it('stops a running job of the subject at its next report', async () => {
      await this.subject.add(aJob('job-1', { subject: 'cus-1' }));
      await this.claim(NOW);

      this.expect(await this.subject.eraseSubject('cus-1')).toBe(1);
      this.expect(await this.subject.heartbeat({ id: 'job-1', attempt: 1 }, later(LEASE_MS))).toBe(false);
      this.expect(await this.subject.complete({ id: 'job-1', attempt: 1 }, NOW)).toBe(false);
    });

    this.it(
      'leaves the jobs of another subject and those that name none, and reaches nothing the second time',
      async () => {
        await this.subject.add(aJob('job-1', { subject: 'cus-1' }));
        await this.subject.add(aJob('job-2', { subject: 'cus-2' }));
        await this.subject.add(aJob('job-3'));

        this.expect(await this.subject.eraseSubject('cus-1')).toBe(1);
        this.expect(await this.subject.eraseSubject('cus-1')).toBe(0);
        this.expect((await this.claim(NOW)).map((job) => job.id)).toEqual(['job-2', 'job-3']);
      },
    );

    this.it('frees the idempotency key of a dropped job', async () => {
      await this.subject.add(aJob('job-1', { subject: 'cus-1', idempotencyKey: 'welcome' }));
      await this.subject.eraseSubject('cus-1');

      this.expect(await this.subject.add(aJob('job-2', { idempotencyKey: 'welcome' }))).toEqual({
        id: 'job-2',
        duplicate: false,
      });
    });
  }

  private async finished(
    id: string,
    finish: (lease: { id: string; attempt: number }) => Promise<boolean>,
    subject?: string,
  ) {
    await this.subject.add(aJob(id, subject === undefined ? {} : { subject }));
    await this.claim(NOW);
    await finish({ id, attempt: 1 });
  }

  private claim(now: Date) {
    return this.subject.claim({ queue: QUEUE, limit: 10, now, leaseMs: LEASE_MS });
  }
}
