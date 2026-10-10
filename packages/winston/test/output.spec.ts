import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LOG_LEVELS } from '@ddd-ts-kit/kernel';
import winston from 'winston';
import { WinstonLogger, createWinstonLogger } from '../src/index.js';
import { MemorySink } from './support/memory-sink.js';
import { memoryTransport } from './support/memory-transport.js';

const ANSI_COLOURS = new RegExp(`${String.fromCharCode(27)}\\[\\d+m`, 'g');

describe('createWinstonLogger', () => {
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'ddd-ts-kit-winston-'));
  });

  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
  });

  it('writes one JSON line per entry: fields, level by name, message, base fields, ISO time', () => {
    const sink = new MemorySink();
    const logger = createWinstonLogger({ service: 'shop', environment: 'production', base: { version: '1.4.0' }, transports: [memoryTransport(sink)] });

    logger.info('order shipped', { context: 'shipping', shippedAt: new Date('2026-03-01T09:59:00.000Z') });

    const [line] = sink.records();

    expect(Object.keys(line ?? {}).sort()).toEqual(['context', 'environment', 'level', 'message', 'service', 'shippedAt', 'time', 'version']);
    expect(line).toMatchObject({ level: 'info', message: 'order shipped', service: 'shop', shippedAt: '2026-03-01T09:59:00.000Z' });
    expect(line?.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(sink.text().endsWith('\n')).toBe(true);
  });

  it('writes from info by default, and from the level it is given', () => {
    const quiet = new MemorySink();
    const verbose = new MemorySink();

    const loggers = [
      createWinstonLogger({ transports: [memoryTransport(quiet)] }),
      createWinstonLogger({ level: 'debug', transports: [memoryTransport(verbose)] }),
    ];

    for (const logger of loggers) {
      logger.debug('cache missed');
      logger.info('order shipped');
    }

    expect(quiet.records().map((line) => line.level)).toEqual(['info']);
    expect(verbose.records().map((line) => line.level)).toEqual(['debug', 'info']);
  });

  it('does not let a field forge the level, the message or the time, nor format the message', () => {
    const sink = new MemorySink();

    createWinstonLogger({ transports: [memoryTransport(sink)] }).warn('carrier %s slow', {
      level: 'debug',
      message: 'forged',
      time: 'yesterday',
      carrier: 'post',
    });

    expect(sink.records()).toMatchObject([{ level: 'warn', carrier: 'post', message: 'carrier %s slow' }]);
    expect(sink.records()[0]?.time).not.toBe('yesterday');
  });

  it('writes the entry without its fields when one of them cannot be read', () => {
    const sink = new MemorySink();
    const logger = createWinstonLogger({ transports: [memoryTransport(sink)] });

    logger.info('order shipped', { get total(): number { throw new Error('unreadable'); } });
    logger.child({ get total(): number { throw new Error('unreadable'); } }).info('parcel handed over');
    logger.warn('carrier slow', { quote: { get total(): number { throw new Error('unreadable'); } } });

    expect(sink.records()).toMatchObject([
      { message: 'order shipped', logError: 'unserializable fields' },
      { message: 'parcel handed over', logError: 'unserializable fields' },
      { level: 'warn', message: 'carrier slow', logError: 'unserializable fields', time: expect.any(String) },
    ]);
  });

  it('has written every line to its transports once the flush resolves, and drops what follows', async () => {
    const file = join(directory, 'app.log');
    const logger = createWinstonLogger({ transports: [new winston.transports.File({ filename: file })] });
    const child = logger.child({ context: 'shipping' });

    for (let line = 0; line < 500; line += 1) child.info(`parcel ${String(line)} handed over`);

    await logger.flush();
    child.error('logged after the end');
    logger.info('logged after the end');
    await child.flush();

    const written = readFileSync(file, 'utf8').split('\n').filter(Boolean);

    expect(written).toHaveLength(500);
    expect(JSON.parse(written[499] ?? '{}')).toMatchObject({ message: 'parcel 499 handed over', context: 'shipping' });
  });

  it('writes one line a human reads in the pretty format', () => {
    const sink = new MemorySink();
    const logger = createWinstonLogger({ format: 'pretty', service: 'shop', fields: () => ({ trace_id: 'trace-1' }), transports: [memoryTransport(sink)] });

    logger.warn('carrier slow', { carrier: 'post', token: 'never-shown' });
    logger.info('order shipped');

    const [first, second] = sink.text().replace(ANSI_COLOURS, '').split('\n');

    expect(first).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3} warn carrier slow \{ carrier: 'post', token: '\[redacted\]', service: 'shop', trace_id: 'trace-1' \}$/);
    expect(second).toMatch(/^\d{2}:\d{2}:\d{2}\.\d{3} info order shipped \{ service: 'shop', trace_id: 'trace-1' \}$/);
    expect(sink.text()).toMatch(ANSI_COLOURS);
  });
});

describe('WinstonLogger', () => {
  it('writes each level of the port at the winston level of the same name', () => {
    const sink = new MemorySink();
    const logger = new WinstonLogger(winston.createLogger({ level: 'silly', transports: [memoryTransport(sink)] }));

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(sink.records().map((line) => line.level)).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('writes at the levels the project maps, for an instance on other levels', () => {
    const sink = new MemorySink();
    const instance = winston.createLogger({ levels: winston.config.syslog.levels, level: 'info', transports: [memoryTransport(sink)] });
    const logger = new WinstonLogger(instance, { levels: { warn: 'warning' } });

    logger.debug('a');
    logger.warn('c');
    logger.error('d');

    expect(sink.records().map((line) => line.level)).toEqual(['warning', 'error']);
  });

  it('keeps what the instance of the project was configured with', () => {
    const sink = new MemorySink();

    const instance = winston.createLogger({
      level: 'warn',
      defaultMeta: { app: 'shop' },
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [memoryTransport(sink)],
    });

    const logger = new WinstonLogger(instance).child({ context: 'billing' });

    logger.info('invoice drafted');
    logger.error('transfer refused');

    expect(sink.records()).toMatchObject([{ app: 'shop', context: 'billing', message: 'transfer refused', timestamp: expect.any(String) }]);
    expect(sink.records()).toHaveLength(1);
  });

  it('follows the level of the instance when it changes while running', () => {
    const sink = new MemorySink();
    const instance = winston.createLogger({ level: 'info', transports: [memoryTransport(sink)] });
    const child = new WinstonLogger(instance).child({ context: 'shipping' });

    child.debug('before');
    instance.level = 'debug';
    child.debug('after');

    expect(sink.records().map((line) => line.message)).toEqual(['after']);
  });

  it('resolves its flush on a logger without transport', async () => {
    const logger = new WinstonLogger(winston.createLogger({ silent: true }));

    await expect(logger.flush()).resolves.toBeUndefined();
  });

  it('says which levels it writes, for a child too', () => {
    const sink = new MemorySink();
    const child = createWinstonLogger({ level: 'warn', transports: [memoryTransport(sink)] }).child({ context: 'shipping' });

    expect(LOG_LEVELS.filter((level) => child.isLevelEnabled(level))).toEqual(['warn', 'error']);
  });

  it('says it writes no level once it was flushed, and takes what is logged then without a throw', async () => {
    const sink = new MemorySink();
    const logger = createWinstonLogger({ transports: [memoryTransport(sink)] });
    const child = logger.child({ context: 'shipping' });

    logger.info('order shipped');
    await child.flush();
    child.error('logged after the end', { error: new Error('too late') });

    expect([logger.isLevelEnabled('error'), child.isLevelEnabled('error')]).toEqual([false, false]);
    expect(sink.records()).toMatchObject([{ message: 'order shipped' }]);
    expect(sink.records()).toHaveLength(1);
  });

  it('asks the levels the project maps', () => {
    const instance = winston.createLogger({ levels: winston.config.syslog.levels, level: 'warning', transports: [memoryTransport(new MemorySink())] });
    const logger = new WinstonLogger(instance, { levels: { warn: 'warning' } });

    expect(LOG_LEVELS.filter((level) => logger.isLevelEnabled(level))).toEqual(['warn', 'error']);
  });
});
