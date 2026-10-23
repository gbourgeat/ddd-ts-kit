import { execFile } from 'node:child_process';
import { promisify, stripVTControlCharacters } from 'node:util';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LOG_LEVELS } from '@ddd-ts-kit/kernel';
import { pino } from 'pino';
import pretty from 'pino-pretty';
import { PinoLogger, createPinoLogger } from '../src';
import { MemorySink } from './support/memory-sink';

const run = promisify(execFile);
const packageRoot = fileURLToPath(new URL('..', import.meta.url));

let directory: string;

/**
 * A process with nothing else to do that logs one warning with a logger built from `options`,
 * flushes it, then says so on its standard error: what it wrote on each.
 */
async function processLogging(options: string): Promise<{ readonly stdout: string; readonly stderr: string }> {
  const program = [
    "const { createPinoLogger } = await import('./src/index.ts');",
    `const logger = createPinoLogger(${options});`,
    "logger.warn('carrier slow');",
    'await logger.flush();',
    "process.stderr.write('flushed');",
  ].join(' ');

  const { stdout, stderr } = await run(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', program], {
    cwd: packageRoot,
  });

  return { stdout: stripVTControlCharacters(stdout), stderr };
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'ddd-ts-kit-pino-'));
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
});

describe('createPinoLogger', () => {
  it('writes one JSON line per entry: level by name, ISO time, base fields, fields, message', () => {
    const sink = new MemorySink();

    const logger = createPinoLogger({
      service: 'shop',
      environment: 'production',
      base: { version: '1.4.0' },
      destination: sink.stream,
    });

    logger.info('order shipped', { context: 'shipping', shippedAt: new Date('2026-03-01T09:59:00.000Z') });

    const [line] = sink.records();

    expect(Object.keys(line ?? {})).toEqual([
      'level',
      'time',
      'service',
      'environment',
      'version',
      'context',
      'shippedAt',
      'message',
    ]);

    expect(line).toMatchObject({
      level: 'info',
      service: 'shop',
      environment: 'production',
      shippedAt: '2026-03-01T09:59:00.000Z',
    });

    expect(line?.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(sink.text().endsWith('\n')).toBe(true);
  });

  it('writes from info by default, and from the level it is given', () => {
    const quiet = new MemorySink();
    const verbose = new MemorySink();

    for (const logger of [
      createPinoLogger({ destination: quiet.stream }),
      createPinoLogger({ level: 'debug', destination: verbose.stream }),
    ]) {
      logger.debug('cache missed');
      logger.info('order shipped');
    }

    expect(quiet.records().map((line) => line.level)).toEqual(['info']);
    expect(verbose.records().map((line) => line.level)).toEqual(['debug', 'info']);
  });

  it('does not let a field forge the level or the time of the line', () => {
    const sink = new MemorySink();

    createPinoLogger({ destination: sink.stream }).warn('carrier slow', {
      level: 'debug',
      time: 'yesterday',
      carrier: 'post',
    });

    expect(sink.text().match(/"level"/g)).toHaveLength(1);
    expect(sink.text().match(/"time"/g)).toHaveLength(1);
    expect(sink.records()).toMatchObject([{ level: 'warn', carrier: 'post', message: 'carrier slow' }]);
  });

  it('writes the entry without its fields when one of them cannot be read', () => {
    const sink = new MemorySink();
    const logger = createPinoLogger({ destination: sink.stream });

    logger.info('order shipped', {
      get total(): number {
        throw new Error('unreadable');
      },
    });

    logger
      .child({
        get total(): number {
          throw new Error('unreadable');
        },
      })
      .info('parcel handed over');

    expect(sink.records()).toMatchObject([
      { message: 'order shipped', logError: 'unserializable fields' },
      { message: 'parcel handed over', logError: 'unserializable fields' },
    ]);
  });
});

describe('createPinoLogger, asynchronous and pretty destinations', () => {
  it('keeps buffered lines until the flush when it writes asynchronously', async () => {
    const file = join(directory, 'app.log');
    const logger = createPinoLogger({ asynchronous: true, destination: file });

    logger.info('order shipped');
    logger.child({ context: 'shipping' }).warn('carrier slow');
    await logger.flush();

    expect(
      readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as unknown),
    ).toMatchObject([
      { level: 'info', message: 'order shipped' },
      { level: 'warn', message: 'carrier slow', context: 'shipping' },
    ]);
  });

  it('writes lines a human reads in the pretty format, through the pino-pretty transport', async () => {
    const file = join(directory, 'pretty.log');

    const logger = createPinoLogger({
      format: 'pretty',
      service: 'shop',
      fields: () => ({ trace_id: 'trace-1' }),
      destination: file,
    });

    logger.warn('carrier slow', { carrier: 'post', token: 'never-shown' });
    await logger.flush();

    const text = stripVTControlCharacters(readFileSync(file, 'utf8'));

    expect(text).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] WARN: carrier slow$/m);
    expect(text).toContain('carrier: "post"');
    expect(text).toContain('trace_id: "trace-1"');
    expect(text).not.toContain('never-shown');
  });

  it('writes each line to its file at once when it writes synchronously, the default', () => {
    const file = join(directory, 'app.log');
    const logger = createPinoLogger({ destination: file });

    logger.info('order shipped');

    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ level: 'info', message: 'order shipped' });
  });

  it('writes to the standard output when it is given no destination, in JSON and in the pretty format', async () => {
    const [json, pretty] = await Promise.all([
      processLogging("{ service: 'shop' }"),
      processLogging("{ format: 'pretty' }"),
    ]);

    expect(JSON.parse(json.stdout)).toMatchObject({ level: 'warn', service: 'shop', message: 'carrier slow' });
    expect(pretty.stdout).toMatch(/^\[\d{2}:\d{2}:\d{2}\.\d{3}\] WARN: carrier slow$/m);
  });

  it('resolves its flush in a process with nothing else pending, the worker of the pretty format included', async () => {
    const flushes = await Promise.all(
      ["{ format: 'pretty' }", "{ format: 'pretty', asynchronous: true }", '{ asynchronous: true }'].map(
        processLogging,
      ),
    );

    expect(flushes.map(({ stderr }) => stderr)).toEqual(['flushed', 'flushed', 'flushed']);
  });

  it('refuses a stream as the destination of the pretty format', () => {
    expect(() => createPinoLogger({ format: 'pretty', destination: new MemorySink().stream })).toThrow(TypeError);
  });
});

describe('PinoLogger', () => {
  it('writes each level of the port at the pino level of the same name', () => {
    const sink = new MemorySink();
    const logger = new PinoLogger(pino({ level: 'trace' }, sink.stream));

    logger.debug('a');
    logger.info('b');
    logger.warn('c');
    logger.error('d');

    expect(sink.records().map((line) => line.level)).toEqual([
      pino.levels.values.debug,
      pino.levels.values.info,
      pino.levels.values.warn,
      pino.levels.values.error,
    ]);
  });

  it('keeps what the instance of the project was configured with', () => {
    const sink = new MemorySink();
    const instance = pino({ level: 'warn', base: { app: 'shop' }, redact: ['iban'] }, sink.stream);
    const logger = new PinoLogger(instance).child({ context: 'billing' });

    logger.info('invoice drafted');
    logger.error('transfer refused', { iban: 'FR76 3000 6000 0112 3456 7890 189' });

    expect(sink.records()).toMatchObject([
      { app: 'shop', context: 'billing', iban: '[Redacted]', msg: 'transfer refused' },
    ]);

    expect(sink.records()).toHaveLength(1);
  });

  it('follows the level of the instance when it changes while running', () => {
    const sink = new MemorySink();
    const instance = pino({ level: 'info' }, sink.stream);
    const logger = new PinoLogger(instance);
    const child = logger.child({ context: 'shipping' });

    child.debug('before');
    instance.level = 'debug';
    child.debug('after');

    expect(sink.records().map((line) => line.msg)).toEqual(['after']);
  });

  it('writes pretty lines to a stream when the project builds the instance on pino-pretty itself', () => {
    const sink = new MemorySink();
    const instance = pino({ level: 'debug' }, pretty({ destination: sink.stream, colorize: false, sync: true }));

    new PinoLogger(instance).child({ context: 'shipping' }).debug('cache missed', { key: 'quote:EUR/USD' });

    expect(sink.text()).toMatch(/DEBUG \(\d+\): cache missed\n\s+context: "shipping"\n\s+key: "quote:EUR\/USD"/);
  });

  it('resolves its flush on a destination that has nothing to flush', async () => {
    const logger = createPinoLogger({ destination: new MemorySink().stream });

    await expect(logger.flush()).resolves.toBeUndefined();
  });

  it('never fails the code that logs, nor its flush, when its destination throws', async () => {
    const failing = {
      write(): never {
        throw new Error('disk gone');
      },
      flush(): never {
        throw new Error('disk gone');
      },
    };

    const logger = new PinoLogger(pino({}, failing));

    expect(() => {
      logger.info('order shipped', { orderId: 'o-1' });
    }).not.toThrow();

    await expect(logger.flush()).resolves.toBeUndefined();
  });

  it('holds the process ten seconds at most for a flush that never answers', () => {
    vi.useFakeTimers();

    try {
      const silent = { write: () => true, flush: () => undefined };

      void new PinoLogger(pino({}, silent)).flush();

      expect(vi.getTimerCount()).toBe(1);
      vi.advanceTimersByTime(10_000);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('says which levels it writes, for a child too', () => {
    const sink = new MemorySink();
    const child = createPinoLogger({ level: 'warn', destination: sink.stream }).child({ context: 'shipping' });

    expect(LOG_LEVELS.filter((level) => child.isLevelEnabled(level))).toEqual(['warn', 'error']);
  });

  it('keeps writing after its flush', async () => {
    const sink = new MemorySink();
    const logger = createPinoLogger({ destination: sink.stream });

    await logger.flush();
    logger.child({ context: 'shipping' }).info('logged after the flush');

    expect(sink.records()).toMatchObject([{ message: 'logged after the flush', context: 'shipping' }]);
  });
});
