import { describe, expect, it } from 'vitest';
import { cli, read } from './helpers';
import { importGenerated } from './support/import-generated';
import { initFailure } from './support/init-failure';
import { initProject } from './support/init-project';
import { jsonAt } from './support/json-at';
import { readJson } from './support/read-json';
import { textsAt } from './support/texts-at';
import { KIT_RANGE } from './support/kit-range';

const platform = (root: string, file: string): string => read(root, `src/platform/${file}`);
const logger = (root: string): string => platform(root, 'observability/create-logger.ts');
const dependencies = (root: string): Record<string, string> => textsAt(readJson(root, 'package.json'), 'dependencies');

describe('init --logger', () => {
  it('is an option of init, recorded as stack.logger, JSON lines on the standard output unless asked otherwise', () => {
    const root = initProject();

    expect(cli(root, '--help').stdout).toContain('[--logger stdout|pino|winston]');
    expect(jsonAt(readJson(root, 'ddd-ts-kit.config.json'), 'stack', 'logger')).toBe('stdout');
    expect(jsonAt(readJson(initProject('--logger', 'pino'), 'ddd-ts-kit.config.json'), 'stack', 'logger')).toBe('pino');
    expect(initFailure('--logger', 'bunyan').message).toBe('Unknown value "bunyan" for --logger.');
  });

  it('writes the adapter of the choice, each with the correlation fields of the execution scope and of the active trace', () => {
    const stdout = logger(initProject());
    const pino = logger(initProject('--logger', 'pino'));
    const winston = logger(initProject('--logger', 'winston'));

    expect(stdout).toContain(
      'return new StdoutLogger({\n    level,\n    base: { service, environment },\n    scrubMessages,\n    fields: () => traceLogFields(scope),\n  });',
    );

    expect(pino).toContain('return createPinoLogger({ ...settings, fields: () => traceLogFields(scope) });');
    expect(winston).toContain('return createWinstonLogger({ ...settings, fields: () => traceLogFields(scope) });');

    for (const written of [stdout, pino, winston]) {
      expect(written).toContain('if (settings === undefined) {\n    return new NoopLogger();\n  }');
      expect(written).toContain('  readonly scrubMessages: boolean;');
    }
  });

  it('installs the adapter and its library, and only them', () => {
    const pino = dependencies(initProject('--logger', 'pino'));
    const winston = dependencies(initProject('--logger', 'winston'));

    expect(pino).toMatchObject({ '@ddd-ts-kit/pino': KIT_RANGE, pino: '^10.4.0', 'pino-pretty': '^13.2.0' });
    expect(winston).toMatchObject({ '@ddd-ts-kit/winston': KIT_RANGE, winston: '^3.19.0' });
    expect(Object.keys(pino)).not.toContain('winston');
    expect(Object.keys(dependencies(initProject())).filter((name) => /pino|winston/.test(name))).toEqual([]);
  });

  it('validates LOG_FORMAT, and refuses pretty to the logger that has no pretty format', () => {
    const stdout = platform(initProject(), 'config/load-config.ts');
    const pino = platform(initProject('--logger', 'pino'), 'config/load-config.ts');

    expect(stdout).toContain(
      "if ((env.optional('LOG_FORMAT') ?? 'json') !== 'json') {\n    env.problem('LOG_FORMAT must be json: the stdout logger has no pretty format');\n  }",
    );

    expect(pino).toContain("format: env.oneOf('LOG_FORMAT', ['json', 'pretty'], 'json'),");

    expect(pino).toContain("scrubMessages: env.flag('LOG_SCRUB_MESSAGES', false),");
    expect(platform(initProject(), 'config/app-config.ts')).toContain("  readonly format: 'json';\n");

    expect(platform(initProject('--logger', 'winston'), 'config/app-config.ts')).toContain(
      "  readonly format: 'json' | 'pretty';\n",
    );
  });

  it('hands the validated settings to the composition root in every entry point', () => {
    const root = initProject('--logger', 'pino', '--context', 'billing:core');

    cli(root, 'generate', 'worker');
    cli(root, 'generate', 'service', 'billing');

    for (const entry of ['main.ts', 'apps/worker/main.ts', 'apps/billing/main.ts']) {
      expect(read(root, `src/${entry}`), entry).toContain(
        'log: { ...config.log, service: config.serviceName, environment: config.environment },',
      );

      expect(read(root, `src/${entry}`), entry).toContain('traceConsumers: config.tracing.consumers,');
    }
  });
});

describe('the tracing configuration init writes', () => {
  it('is validated before the instrumentation starts, by a reader that imports nothing', () => {
    const root = initProject();
    const tracing = platform(root, 'observability/tracing.ts');

    expect(tracing.split('\n')[0]).toBe("import { initTracing } from '@ddd-ts-kit/tracing/node';");

    expect(tracing).toContain(
      'const env = new Environment(process.env);\nconst settings = readTracing(env);\n\nenv.assertValid();',
    );

    expect(tracing).toContain('...(settings.sampleRatio === undefined ? {} : { sampleRatio: settings.sampleRatio }),');
    expect(platform(root, 'config/read-tracing.ts')).not.toMatch(/^import (?!type )/m);
    expect(platform(root, 'config/load-config.ts')).toContain('tracing: readTracing(env),');
  });

  it('reads the OTLP endpoint, the sampling ratio and the consumer mode, which continues the trace by default', async () => {
    const root = initProject();

    const Environment = jsonAt(
      await importGenerated(root, 'src/platform/config/environment.ts'),
      'Environment',
    ) as new (
      variables: Record<string, string>,
    ) => { readonly problems: readonly string[] };

    const readTracing = jsonAt(await importGenerated(root, 'src/platform/config/read-tracing.ts'), 'readTracing') as (
      env: InstanceType<typeof Environment>,
    ) => unknown;

    const empty = new Environment({});

    const given = new Environment({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://127.0.0.1:4318',
      TRACE_SAMPLE_RATIO: '0.25',
      TRACE_CONSUMERS: 'link',
    });

    const wrong = new Environment({
      OTEL_EXPORTER_OTLP_ENDPOINT: 'jaeger',
      TRACE_SAMPLE_RATIO: '2',
      TRACE_CONSUMERS: 'fork',
    });

    expect(readTracing(empty)).toEqual({ consumers: 'continue' });
    expect(readTracing(given)).toEqual({ endpoint: 'http://127.0.0.1:4318', sampleRatio: 0.25, consumers: 'link' });
    expect([...empty.problems, ...given.problems]).toEqual([]);

    readTracing(wrong);

    expect(wrong.problems).toEqual([
      'OTEL_EXPORTER_OTLP_ENDPOINT must be a URL, or empty to export nothing',
      'TRACE_SAMPLE_RATIO must be a number between 0 and 1',
      'TRACE_CONSUMERS must be one of continue, link',
    ]);
  });

  it('runs Jaeger in the observability profile of the compose file, bound to the loopback interface', () => {
    const compose = read(initProject(), 'docker-compose.yml');

    expect(compose).toContain(
      '  jaeger:\n    image: jaegertracing/jaeger:2.22.0\n    profiles: [observability]\n    ports:\n      - "127.0.0.1:${JAEGER_UI_PORT:-16686}:16686"\n      - "127.0.0.1:${OTLP_HTTP_PORT:-4318}:4318"',
    );

    expect(read(initProject(), '.env.example')).toContain('# TRACE_CONSUMERS=continue');
  });
});

describe('a generated command handler', () => {
  it('saves and returns: the events of the aggregate leave with the save, in both styles and in the module wired by hand', () => {
    for (const flags of [[], ['--style', 'explicit'], ['--di', 'manual']]) {
      const root = initProject(...flags, '--context', 'billing:core');

      cli(root, 'generate', 'aggregate', 'billing', 'Invoice', '--term', 'Invoice=A request for payment');

      cli(
        root,
        'generate',
        'command',
        'billing',
        'IssueInvoice',
        '--creates',
        '--aggregate',
        'Invoice',
        '--permission',
        'invoice.issue',
        '--term',
        'Issue=To make an invoice final',
      );

      const handler = read(root, 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts');

      expect(handler, flags.join(' ')).toContain(
        '    await this.invoiceRepository.save(invoice);\n\n    return invoice.id;',
      );

      expect(handler, flags.join(' ')).not.toMatch(/pullEvents|DomainEventDispatcher/);
    }
  });

  it('wired by hand, is given a repository that dispatches on save, inside its span', () => {
    const create = platform(initProject('--di', 'manual'), 'composition/create-platform.ts');

    expect(create).toContain(
      "const saving = info.kind === 'repository' ? dispatchingOnSave(resilient, () => domainEvents) : resilient;",
    );

    expect(create).toContain("return traced.binding(saving, { ...info, context: info.context ?? 'platform' });");
  });
});
