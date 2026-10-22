import { describe, expect, it } from 'vitest';
import { isTestFile as cliIsTestFile } from '../../cli/src/check/project/is-test-file';
import { locate as cliLocate } from '../../cli/src/check/project/locate';
import { resolveImport as cliResolveImport } from '../../cli/src/check/project/resolve-import';
import { parallelNames as cliParallelNames } from '../../cli/src/check/standard/parallel-names';
import {
  aliasRoots as cliAliasRoots,
  specifierSuffix as cliSpecifierSuffix,
  toAlias as cliToAlias,
} from '../../cli/src/alias';
import { parseConfig as cliParseConfig } from '../../cli/src/config/parse-config';
import { isTestFile } from '../src/project/is-test-file';
import { locate } from '../src/project/locate';
import { resolveImport } from '../src/project/resolve-import';
import { specifierSuffix } from '../src/project/specifier-suffix';
import { aliasRoots } from '../src/project/alias-roots';
import { parseConfig } from '../src/project/parse-config';
import { toAlias } from '../src/project/to-alias';
import { parallelNames } from '../src/support/standard-interfaces/parallel-names';

const RAW_CONFIGS: readonly Record<string, unknown>[] = [
  {},
  { sourceRoot: 'app', importAlias: '~/' },
  { contextsDir: './modules/', sharedKernelDir: 'libs\\shared', platformDir: 'src/infra-platform', importAlias: '' },
  {
    stack: { validation: 'class-validator' },
    domainAllowedPackages: ['@ddd-ts-kit/kernel', 'decimal.js'],
    limits: { maxParameters: 4, maxFunctionLines: 0 },
  },
  { stack: { validation: 'none' }, publishedLanguageAllowedPackages: ['valibot'], rules: { 'clean/stepdown': 'warn' } },
  { standardInterfaces: { TenantInfo: 'TenantScoped', CurrentUser: false, Empty: '', Wrong: true, Count: 3 } },
  { standardInterfaces: ['ILogger'] },
  { limits: { maxParameters: 2, maxFunctionLines: 500 } },
  {
    onePerFile: {
      allow: [
        { file: './src/platform/collaborators.ts', reason: ' the defaults of one runtime ' },
        { file: 'src/**/x.ts', reason: ' ' },
        { file: 'src/a.ts' },
        { reason: 'no file' },
        'src/b.ts',
        7,
      ],
    },
  },
  { onePerFile: ['src/a.ts'] },
  { stack: { style: 'declared' } },
  { stack: { style: 'declared', assembly: 'discovery' } },
  { stack: { style: 'explicit', orm: 'none' } },
  { importAlias: '$app/' },
  { importExtension: 'none' },
  { sdk: { name: '@acme/{document}', access: 'public' } },
  { sdk: {} },
  { sdk: true },
  { importExtension: 'js', importAlias: '$app/' },
  { importExtension: 'ts' },
  { importExtension: 7 },
  { stack: { orm: 'prisma' }, sourceRoot: 'apps/api/src' },
  {
    contexts: {
      billing: {
        classification: 'core',
        upstreams: ['catalog', { context: 'identity', relationship: 'conformist' }, 42],
        extraDirectories: ['jobs', { path: './sagas/', reason: 'long flows' }],
      },
    },
  },
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
  '@/shared-kernel/money.vo',
  '@/contexts/catalog/domain/aggregates/product.aggregate',
  '@/contexts/catalog/published-language',
  '@/contexts/catalog/published-language',
  '$test/e2e/support/start-application',
  '../value-objects/amount.vo',
  '@/platform/config.ts',
  '@/platform/worker.mjs',
  '$app/shared-kernel/money.vo.js',
  '$test/e2e/support/start-application.js',
  '$scripts/openapi.js',
  '$generated/prisma/client.js',
  '@/../package.js',
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

      expect(isTestFile(file, locate(parseConfig(raw), file)), file).toBe(
        cliIsTestFile(file, cliLocate(cliParseConfig(raw), file)),
      );
    }
  });

  it.each(RAW_CONFIGS)('names every sample path by the same alias under %j', (raw) => {
    const roots = aliasRoots(parseConfig(raw));
    const cliRoots = cliAliasRoots(cliParseConfig(raw));

    expect(roots).toEqual(cliRoots.map(({ prefix, directory }) => ({ prefix, directory })));

    const suffix = specifierSuffix(parseConfig(raw).importExtension);

    expect(suffix).toBe(cliSpecifierSuffix(cliParseConfig(raw).importExtension));
    expect(suffix).toBe(raw['importExtension'] === 'none' ? '' : '.js');

    for (const file of PATHS) {
      expect(toAlias(roots, file, suffix), file).toBe(cliToAlias(cliRoots, file, suffix));
    }
  });

  it('names the same source file whether the import carries its extension or not, dots of the file name included', () => {
    const config = parseConfig({ contexts: { catalog: { classification: 'core', upstreams: [] } } });
    const from = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';
    const resolved = (specifier: string): unknown => resolveImport(config, from, specifier);

    for (const bare of [
      '@/contexts/catalog/domain/aggregates/product.aggregate',
      '../../../domain/events/issued.event',
    ]) {
      expect(resolved(bare)).toEqual(resolved(`${bare}.js`));
      expect(resolved(bare)).toEqual(resolved(`${bare}.ts`));
    }

    expect(resolved('@/contexts/catalog/domain/aggregates/product.aggregate')).toMatchObject({
      kind: 'file',
      path: 'src/contexts/catalog/domain/aggregates/product.aggregate.ts',
      location: { area: 'context', context: 'catalog', layer: 'domain' },
    });

    expect(resolved('@/platform/data.json')).toMatchObject({ kind: 'file', path: 'src/platform/data.json' });
    expect(resolved('zod/v4/core.js')).toEqual({ kind: 'package', name: 'zod' });
    expect(resolved('@scope/package/file.js')).toEqual({ kind: 'package', name: '@scope/package' });
  });

  it.each(RAW_CONFIGS)('resolves every sample import the same way under %j', (raw) => {
    for (const from of PATHS.filter((file) => file.endsWith('.ts'))) {
      for (const specifier of SPECIFIERS) {
        expect(resolveImport(parseConfig(raw), from, specifier), `${specifier} from ${from}`).toEqual(
          cliResolveImport(cliParseConfig(raw), from, specifier),
        );
      }
    }
  });
});

/**
 * The CLI config narrowed to what the plugin reads: the generator and the checker know keys
 * (stack choices, deployment, deviations) that a linter has no use for, at any depth.
 */
function keysReadByThePlugin(cli: unknown, plugin: unknown): unknown {
  if (Array.isArray(cli) && Array.isArray(plugin)) {
    return cli.map((item: unknown, index) => keysReadByThePlugin(item, plugin[index]));
  }

  if (!isPlainObject(cli) || !isPlainObject(plugin)) {
    return cli;
  }

  return Object.fromEntries(Object.keys(plugin).map((key) => [key, keysReadByThePlugin(cli[key], plugin[key])]));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
