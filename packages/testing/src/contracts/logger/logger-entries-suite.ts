import { LOG_LEVELS, type LogFields, type LogValue } from '@ddd-ts-kit/kernel';
import type { ContractRunner } from '../contract-runner.js';
import { ContractSuite } from '../contract-suite.js';
import type { CreateLogger } from './create-logger.js';
import type { LoggerUnderContract } from './logger-under-contract.js';
import { unreadableTotal } from './unreadable-total.js';

/** The fields the default subject reads at each entry; a test changes them between two entries. */
interface WorkInProgress {
  fields: LogFields;
}

/** Levels, fields, children, the fields of the work in progress, and fields that cannot be written. */
export class LoggerEntriesSuite extends ContractSuite<LoggerUnderContract> {
  private readonly work: WorkInProgress;

  constructor(
    runner: ContractRunner,
    private readonly createLogger: CreateLogger,
  ) {
    const work: WorkInProgress = { fields: {} };

    super(runner, () => {
      work.fields = {};

      return createLogger({ level: 'debug', scrubMessages: false, fields: () => work.fields });
    });

    this.work = work;
  }

  protected tests(): void {
    this.writes();
    this.binds();
    this.correlates();
    this.filters();
    this.survives();
  }

  private writes(): void {
    this.it('writes an entry of every level with its message', async () => {
      this.subject.logger.debug('cache missed');
      this.subject.logger.info('order shipped');
      this.subject.logger.warn('carrier slow');
      this.subject.logger.error('carrier failed');

      this.expect((await this.subject.lines()).map(({ level, message }) => ({ level, message }))).toEqual([
        { level: 'debug', message: 'cache missed' },
        { level: 'info', message: 'order shipped' },
        { level: 'warn', message: 'carrier slow' },
        { level: 'error', message: 'carrier failed' },
      ]);
    });

    this.it('carries the fields of the entry, whatever their shape', async () => {
      this.subject.logger.info('order shipped', SHIPMENT);

      this.expect(await this.written(Object.keys(SHIPMENT))).toEqual([SHIPMENT]);
    });

    this.it('keeps its level and its message whatever the fields are named', async () => {
      this.subject.logger.info('order shipped', { level: 'error', message: 'forged' });

      const [line] = await this.subject.lines();

      this.expect({ level: line?.level, message: line?.message }).toEqual({ level: 'info', message: 'order shipped' });
    });
  }

  private binds(): void {
    this.it('adds the fields of a child to every entry of that child, and to no other', async () => {
      const shipping = this.subject.logger.child({ context: 'shipping' });

      shipping.info('order shipped', { orderId: 'order-1' });
      shipping.warn('carrier slow');
      this.subject.logger.info('order placed');

      this.expect(await this.written(['context', 'orderId'])).toEqual([
        { context: 'shipping', orderId: 'order-1' },
        { context: 'shipping' },
        {},
      ]);
    });

    this.it('nests children: the closest binding of a key wins, and the entry wins over all', async () => {
      const shipping = this.subject.logger.child({ context: 'shipping', carrier: 'post' });
      const parcel = shipping.child({ carrier: 'express', parcelId: 'parcel-1' });

      parcel.info('parcel handed over');
      parcel.info('parcel rerouted', { carrier: 'bike' });
      shipping.info('order shipped');

      this.expect(await this.written(['context', 'carrier', 'parcelId'])).toEqual([
        { context: 'shipping', carrier: 'express', parcelId: 'parcel-1' },
        { context: 'shipping', carrier: 'bike', parcelId: 'parcel-1' },
        { context: 'shipping', carrier: 'post' },
      ]);
    });
  }

  private correlates(): void {
    this.it('reads the fields of the work in progress at each entry, for a child too', async () => {
      const shipping = this.subject.logger.child({ context: 'shipping' });

      this.work.fields = { correlationId: 'request-1' };
      this.subject.logger.info('order placed');
      this.work.fields = { correlationId: 'request-2', tenantId: 'acme' };
      shipping.info('order shipped');

      this.expect(await this.written(['correlationId', 'tenantId', 'context'])).toEqual([
        { correlationId: 'request-1' },
        { correlationId: 'request-2', tenantId: 'acme', context: 'shipping' },
      ]);
    });

    this.it('lets the fields of the entry win over those of the work in progress', async () => {
      this.work.fields = { correlationId: 'request-1', tenantId: 'acme' };

      this.subject.logger.info('replayed', { correlationId: 'replay-7' });

      this.expect(await this.written(['correlationId', 'tenantId'])).toEqual([
        { correlationId: 'replay-7', tenantId: 'acme' },
      ]);
    });

    this.it('still writes the entry when the fields of the work in progress cannot be read', async () => {
      const subject = await this.createLogger({ level: 'debug', scrubMessages: false, fields: unreadable });

      subject.logger.info('order placed', { orderId: 'order-1' });

      this.expect((await subject.lines()).map(({ message, fields }) => ({ message, orderId: fields.orderId }))).toEqual([
        { message: 'order placed', orderId: 'order-1' },
      ]);
    });
  }

  private filters(): void {
    this.it('drops an entry below its level without reading any field for it', async () => {
      let read = 0;
      const subject = await this.createLogger({ level: 'warn', scrubMessages: false, fields: () => ({ read: (read += 1) }) });

      subject.logger.debug('cache missed');
      subject.logger.info('order shipped');
      subject.logger.child({ context: 'shipping' }).info('parcel handed over');

      this.expect(read).toBe(0);

      subject.logger.warn('carrier slow');
      subject.logger.child({ context: 'shipping' }).error('carrier failed');

      this.expect((await subject.lines()).map(({ level, message }) => ({ level, message }))).toEqual([
        { level: 'warn', message: 'carrier slow' },
        { level: 'error', message: 'carrier failed' },
      ]);

      this.expect(read).toBe(2);
    });

    this.it('says which levels it writes, for a child too, as it writes them', async () => {
      const subject = await this.createLogger({ level: 'warn', scrubMessages: false, fields: () => ({}) });
      const loggers = [this.subject.logger, subject.logger, subject.logger.child({ context: 'shipping' })];

      for (const level of LOG_LEVELS) subject.logger[level]('carrier asked');

      this.expect(loggers.map((logger) => LOG_LEVELS.filter((level) => logger.isLevelEnabled(level)))).toEqual([
        LOG_LEVELS,
        ['warn', 'error'],
        ['warn', 'error'],
      ]);

      this.expect((await subject.lines()).map(({ level }) => level)).toEqual(['warn', 'error']);
    });
  }

  private survives(): void {
    this.it('never throws on fields that cannot be written, and writes the entries that follow', async () => {
      this.subject.logger.info('looped', circular());
      this.subject.logger.child(circular()).warn('bound to a loop');
      this.subject.logger.error('unreadable', { payload: unreadableTotal() });
      this.subject.logger.error('unreadable at the top', unreadableTotal());
      this.subject.logger.child(unreadableTotal()).warn('bound to the unreadable');
      this.subject.logger.info('order shipped', { orderId: 'order-1' });

      const lines = await this.subject.lines();

      this.expect(lines.map(({ level, message }) => ({ level, message }))).toEqual([
        { level: 'info', message: 'looped' },
        { level: 'warn', message: 'bound to a loop' },
        { level: 'error', message: 'unreadable' },
        { level: 'error', message: 'unreadable at the top' },
        { level: 'warn', message: 'bound to the unreadable' },
        { level: 'info', message: 'order shipped' },
      ]);

      this.expect(lines[5]?.fields.orderId).toBe('order-1');
    });
  }

  private async written(keys: readonly string[]): Promise<Record<string, unknown>[]> {
    return (await this.subject.lines()).map(({ fields }) =>
      Object.fromEntries(keys.filter((key) => fields[key] !== undefined).map((key) => [key, fields[key]])),
    );
  }
}

const SHIPMENT: LogFields = {
  context: 'shipping',
  orderId: 'order-1',
  durationMs: 12.5,
  attempt: 0,
  express: false,
  note: '',
  carrier: null,
  parcels: ['parcel-1', 'parcel-2'],
  destination: { country: 'FR', zone: 3 },
};

function circular(): LogFields {
  const loop: Record<string, LogValue> = { name: 'loop' };

  loop.self = loop;

  return loop;
}

function unreadable(): LogFields {
  throw new Error('no active span');
}
