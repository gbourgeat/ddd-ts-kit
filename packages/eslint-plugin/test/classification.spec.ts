import { describe, expect, it } from 'vitest';
import { isTestFile as cliIsTestFile, locate as cliLocate, resolveImport as cliResolveImport } from '../../cli/src/check/project.js';
import { parallelNames as cliParallelNames } from '../../cli/src/check/standard-interfaces.js';
import { parseConfig as cliParseConfig } from '../../cli/src/config.js';
import { isTestFile, locate, resolveImport } from '../src/project/classify.js';
import { parseConfig } from '../src/project/config.js';
import { parallelNames } from '../src/support/standard-interfaces.js';

const RAW_CONFIGS: readonly Record<string, unknown>[] = [
  {},
  { sourceRoot: 'app', importAlias: '~/' },
  { contextsDir: './modules/', sharedKernelDir: 'libs\\shared', platformDir: 'src/infra-platform', importAlias: '' },
  { stack: { validation: 'class-validator' }, domainAllowedPackages: ['@ddd-ts-kit/kernel', 'decimal.js'], limits: { maxParameters: 4, maxFunctionLines: 0 } },
  { stack: { validation: 'none' }, publishedLanguageAllowedPackages: ['valibot'], rules: { 'clean/stepdown': 'warn' } },
  { standardInterfaces: { TenantInfo: 'TenantScoped', CurrentUser: false, Empty: '', Wrong: true, Count: 3 } },
  { standardInterfaces: ['ILogger'] },
  { contexts: { billing: { classification: 'core', upstreams: ['catalog', { context: 'identity', relationship: 'conformist' }, 42], extraDirectories: ['jobs', { path: './sagas/', reason: 'long flows' }] } } },
];

const PATHS = [
  'src/main.ts',
  'src/other.ts',
  'src/shared-kernel/money.vo.ts',
  'src/platform/database/database.ts',
  'src/contexts',
  'src/contexts/billing',
  'src/contexts/billing/billing.module.ts',
  'src/contexts/billing/CONTEXT.md',
  'src/contexts/billing/published-language',
  'src/contexts/billing/published-language.ts',
  'src/contexts/billing/published-language/index.ts',
  'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
  'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts',
  'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.spec.ts',
  'src/contexts/billing/infrastructure/persistence/invoice.mapper.ts',
  'src/contexts/billing/presentation/http/issue-invoice.route.ts',
  'src/contexts/billing/test/fakes/invoice.repository.fake.ts',
  'src/contexts/billing/jobs/nightly.ts',
  'src/contexts/billing/other.module.ts',
  'app/contexts/billing/domain/x.ts',
  'app/main.ts',
  'modules/billing/domain/x.ts',
  'libs/shared/money.ts',
  'src/infra-platform/config.ts',
  'test/e2e/issue-invoice.e2e.spec.ts',
  'scripts/openapi.test.ts',
];

const SPECIFIERS = [
  './sibling.js',
  '../value-objects/amount.vo.js',
  '../../../catalog/published-language/index.js',
  '../../../catalog/published-language',
  '../../infrastructure/persistence/billing.schema',
  './data.json',
  './legacy.cjs',
  '@/contexts/catalog/domain/aggregates/product.aggregate.js',
  '@/shared-kernel/money.vo.js',
  '~/platform/config.js',
  '@ddd-ts-kit/kernel',
  '@ddd-ts-kit/validation/zod',
  'zod',
  'drizzle-orm/pg-core',
  'node:fs/promises',
  'fs',
  'path/posix',
  'crypto',
];

describe('the plugin classifies files exactly like the CLI checker', () => {
  it.each(RAW_CONFIGS)('reads the config %j the same way', (raw) => {
    const read = parseConfig(raw);
    expect(read).toEqual(keysReadByThePlugin(cliParseConfig(raw), read));
  });

  it.each(RAW_CONFIGS)('names the same home-made copies of standard interfaces under %j', (raw) => {
    const names = parallelNames(parseConfig(raw).standardInterfaces);
    expect([...names]).toEqual([...cliParallelNames(cliParseConfig(raw).standardInterfaces)]);
    expect(names.get('ILogger')).toBe('Logger');
  });

  it.each(RAW_CONFIGS)('locates every sample path the same way under %j', (raw) => {
    for (const file of PATHS) {
      expect(locate(parseConfig(raw), file), file).toEqual(cliLocate(cliParseConfig(raw), file));
      expect(isTestFile(file, locate(parseConfig(raw), file)), file).toBe(cliIsTestFile(file, cliLocate(cliParseConfig(raw), file)));
    }
  });

  it.each(RAW_CONFIGS)('resolves every sample import the same way under %j', (raw) => {
    for (const from of PATHS.filter((file) => file.endsWith('.ts'))) {
      for (const specifier of SPECIFIERS) {
        expect(resolveImport(parseConfig(raw), from, specifier), `${specifier} from ${from}`).toEqual(cliResolveImport(cliParseConfig(raw), from, specifier));
      }
    }
  });
});

/**
 * The CLI config narrowed to what the plugin reads: the generator and the checker know keys
 * (stack choices, deployment, deviations) that a linter has no use for, at any depth.
 */
function keysReadByThePlugin(cli: unknown, plugin: unknown): unknown {
  if (Array.isArray(cli) && Array.isArray(plugin)) return cli.map((item: unknown, index) => keysReadByThePlugin(item, plugin[index]));
  if (!isPlainObject(cli) || !isPlainObject(plugin)) return cli;
  return Object.fromEntries(Object.keys(plugin).map((key) => [key, keysReadByThePlugin(cli[key], plugin[key])]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
