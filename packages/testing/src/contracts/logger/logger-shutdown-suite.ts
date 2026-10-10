import { DomainError, SCRUBBED_MESSAGE } from '@ddd-ts-kit/kernel';
import type { ContractRunner } from '../contract-runner.js';
import { ContractSuite } from '../contract-suite.js';
import type { CreateLogger } from './create-logger.js';
import { errorOutlineOf } from './error-outline-of.js';
import type { LoggerUnderContract } from './logger-under-contract.js';

/** How many errors of a chain of causes a logger writes: the first and seven causes. */
const DEEPEST_CAUSE = 8;

class ParcelLost extends DomainError {
  readonly code = 'PARCEL_LOST';
}

/** An error passed as a field, and the flush that ends the life of a logger. */
export class LoggerShutdownSuite extends ContractSuite<LoggerUnderContract> {
  constructor(
    runner: ContractRunner,
    private readonly createLogger: CreateLogger,
  ) {
    super(runner, () => createLogger({ level: 'debug', scrubMessages: false, fields: () => ({}) }));
  }

  protected tests(): void {
    this.describes();
    this.scrubs();
    this.flushes();
  }

  private describes(): void {
    this.it('writes an error passed as a field as its class, its message and its own stack, then its cause', async () => {
      const failure = new RangeError('weight out of range', { cause: new TypeError('socket closed') });

      this.subject.logger.error('carrier failed', { error: failure });
      this.subject.logger.child({ lastFailure: failure }).warn('retrying');

      const [failed, retrying] = await this.subject.lines();
      const cause = { type: 'TypeError', code: undefined, message: 'socket closed', stack: 'titled', cause: undefined };
      const described = { type: 'RangeError', code: undefined, message: 'weight out of range', stack: 'titled', cause };

      this.expect(errorOutlineOf(failed?.fields.error)).toEqual(described);
      this.expect(errorOutlineOf(retrying?.fields.lastFailure)).toEqual(described);
    });

    this.it('writes the code of a DomainError, and stops at a chain of causes that loops', async () => {
      const refusal = new ParcelLost('Parcel parcel-1 is lost');

      refusal.cause = refusal;
      this.subject.logger.warn('delivery refused', { error: refusal });

      const [line] = await this.subject.lines();
      let depth = 0;

      for (let one = errorOutlineOf(line?.fields.error); one !== undefined; one = one.cause) depth += 1;

      this.expect(errorOutlineOf(line?.fields.error)?.code).toBe('PARCEL_LOST');
      this.expect(depth).toBe(DEEPEST_CAUSE);
    });
  }

  private scrubs(): void {
    this.it('replaces the message of an unexpected error when it scrubs, in its stack too, and keeps the one of a DomainError', async () => {
      const subject = await this.createLogger({ level: 'debug', scrubMessages: true, fields: () => ({}) });
      const refusal = new ParcelLost('Parcel parcel-1 is lost', { cause: new Error('row (ada@example.org) refused') });

      subject.logger.error('delivery failed', { error: refusal });

      const [line] = await subject.lines();

      this.expect(errorOutlineOf(line?.fields.error)).toEqual({
        type: 'ParcelLost',
        code: 'PARCEL_LOST',
        message: 'Parcel parcel-1 is lost',
        stack: 'titled',
        cause: { type: 'Error', code: undefined, message: SCRUBBED_MESSAGE, stack: 'frames', cause: undefined },
      });
    });
  }

  private flushes(): void {
    this.it('has handed every entry to its sink once the flush resolves, and takes what follows without a throw', async () => {
      const shipping = this.subject.logger.child({ context: 'shipping' });

      this.subject.logger.info('order shipped');
      shipping.warn('carrier slow');

      await this.subject.logger.flush();

      this.expect((await this.subject.lines()).map(({ message }) => message)).toEqual(['order shipped', 'carrier slow']);

      this.subject.logger.error('logged after the flush');
      shipping.info('logged after the flush');
      shipping.isLevelEnabled('info');
      await shipping.flush();

      this.expect((await this.subject.lines()).slice(0, 2).map(({ message }) => message)).toEqual(['order shipped', 'carrier slow']);
    });
  }
}
