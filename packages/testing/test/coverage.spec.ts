import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { governedCoverage, governedJestCoverage, REFERENCE_COVERAGE, unaffectedContexts } from '../src/coverage.js';

const workspace = mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-coverage-'));

afterAll(() => {
  rmSync(workspace, { recursive: true, force: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/** A project on disk: its config file and some files, given from its root. */
function projectWith(config: object, files: readonly string[]): string {
  const root = mkdtempSync(path.join(workspace, 'project-'));

  writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), JSON.stringify(config));

  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), 'export const written = true;\n');
  }

  return root;
}

const BILLING = [
  'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
  'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts',
  'src/contexts/billing/infrastructure/persistence/knex-invoice.repository.ts',
];

describe('governedCoverage(), what a Vitest run measures and is held to', () => {
  it('measures the four layers of every context and holds each layer that has a source to the reference', () => {
    const root = projectWith({}, [...BILLING, 'src/contexts/shipping/domain/value-objects/parcel.vo.ts']);

    const { include, thresholds } = governedCoverage('test', root);

    expect(include).toEqual([
      'src/contexts/*/domain/**/*.ts',
      'src/contexts/*/application/**/*.ts',
      'src/contexts/*/presentation/**/*.ts',
      'src/contexts/*/infrastructure/**/*.ts',
    ]);

    expect(thresholds).toEqual({
      'src/contexts/billing/domain/**/*.ts': REFERENCE_COVERAGE.domain,
      'src/contexts/billing/application/**/*.ts': REFERENCE_COVERAGE.application,
      'src/contexts/billing/infrastructure/**/*.ts': REFERENCE_COVERAGE.infrastructure,
      'src/contexts/shipping/domain/**/*.ts': REFERENCE_COVERAGE.domain,
    });
  });

  it('never holds a run to a layer it does not execute: the unit run leaves the adapters, the integration run keeps them alone', () => {
    const root = projectWith({}, BILLING);

    expect(Object.keys(governedCoverage('unit', root).thresholds)).toEqual([
      'src/contexts/billing/domain/**/*.ts',
      'src/contexts/billing/application/**/*.ts',
    ]);

    expect(governedCoverage('integration', root)).toEqual({
      include: ['src/contexts/*/infrastructure/**/*.ts'],
      thresholds: { 'src/contexts/billing/infrastructure/**/*.ts': REFERENCE_COVERAGE.infrastructure },
    });
  });

  it('holds an empty layer to nothing, and to its threshold from its first source file: a spec or a document is not one', () => {
    const empty = projectWith({}, [
      'src/contexts/billing/CONTEXT.md',
      'src/contexts/billing/presentation/http/README.md',
      'src/contexts/billing/domain/aggregates/invoice.aggregate.spec.ts',
    ]);

    const started = projectWith({}, ['src/contexts/billing/presentation/http/issue-invoice.route.ts']);

    expect(governedCoverage('test', empty).thresholds).toEqual({});
    expect(governedCoverage('test', projectWith({}, [])).thresholds).toEqual({});

    expect(governedCoverage('test', started).thresholds).toEqual({
      'src/contexts/billing/presentation/**/*.ts': REFERENCE_COVERAGE.presentation,
    });
  });

  it('reads the thresholds and the place of the contexts from the config file, rate by rate over the reference', () => {
    const config = {
      contextsDir: 'app/modules',
      coverage: { domain: { branches: 95 }, infrastructure: { statements: 50, lines: 'many', functions: 140 } },
    };

    const root = projectWith(config, [
      'app/modules/billing/domain/aggregates/invoice.aggregate.ts',
      'app/modules/billing/infrastructure/persistence/knex-invoice.repository.ts',
    ]);

    expect(governedCoverage('test', root).thresholds).toEqual({
      'app/modules/billing/domain/**/*.ts': { ...REFERENCE_COVERAGE.domain, branches: 95 },
      'app/modules/billing/infrastructure/**/*.ts': { ...REFERENCE_COVERAGE.infrastructure, statements: 50 },
    });
  });

  it('reads a config file that holds no object as one that sets nothing: the reference, under src/contexts', () => {
    const root = projectWith({}, BILLING);

    writeFileSync(path.join(root, 'ddd-ts-kit.config.json'), 'null');

    expect(governedCoverage('test', root).thresholds).toEqual({
      'src/contexts/billing/domain/**/*.ts': REFERENCE_COVERAGE.domain,
      'src/contexts/billing/application/**/*.ts': REFERENCE_COVERAGE.application,
      'src/contexts/billing/infrastructure/**/*.ts': REFERENCE_COVERAGE.infrastructure,
    });
  });

  it('refuses to measure a directory that is not a project: the thresholds would be nobody knows which', () => {
    expect(() => governedCoverage('test', workspace)).toThrow('ddd-ts-kit.config.json was not found');
  });
});

describe('governedJestCoverage(), the same in the options of Jest', () => {
  it('collects the four layers and sums each context and layer under its directory', () => {
    const root = projectWith({ coverage: { application: { lines: 100 } } }, BILLING);

    expect(governedJestCoverage(root)).toEqual({
      collectCoverageFrom: [
        '<rootDir>/src/contexts/*/domain/**/*.ts',
        '<rootDir>/src/contexts/*/application/**/*.ts',
        '<rootDir>/src/contexts/*/presentation/**/*.ts',
        '<rootDir>/src/contexts/*/infrastructure/**/*.ts',
      ],
      coverageThreshold: {
        './src/contexts/billing/domain/': REFERENCE_COVERAGE.domain,
        './src/contexts/billing/application/': { ...REFERENCE_COVERAGE.application, lines: 100 },
        './src/contexts/billing/infrastructure/': REFERENCE_COVERAGE.infrastructure,
      },
    });
  });
});

/** billing, catalog and shipping, each with a domain; shipping also has an adapter. */
const THREE_CONTEXTS = [
  'src/contexts/billing/domain/aggregates/invoice.aggregate.ts',
  'src/contexts/catalog/domain/aggregates/item.aggregate.ts',
  'src/contexts/shipping/domain/aggregates/parcel.aggregate.ts',
  'src/contexts/shipping/infrastructure/persistence/knex-parcel.repository.ts',
];

describe('a partial run, which DDD_TS_KIT_AFFECTED narrows to the contexts a pull request reaches', () => {
  it('leaves nothing out when the variable is unset or empty: the default branch runs everything', () => {
    const root = projectWith({}, THREE_CONTEXTS);

    expect(unaffectedContexts(root)).toEqual([]);

    vi.stubEnv('DDD_TS_KIT_AFFECTED', ' , ');

    expect(unaffectedContexts(root)).toEqual([]);
    expect(governedCoverage('test', root).include).toContain('src/contexts/*/domain/**/*.ts');
  });

  it('names the directory of every context it leaves out, wherever the project keeps its contexts', () => {
    vi.stubEnv('DDD_TS_KIT_AFFECTED', 'billing, shipping');

    expect(unaffectedContexts(projectWith({}, THREE_CONTEXTS))).toEqual(['src/contexts/catalog/']);

    expect(
      unaffectedContexts(
        projectWith({ contextsDir: 'app/modules' }, [
          'app/modules/billing/domain/a.ts',
          'app/modules/catalog/domain/b.ts',
        ]),
      ),
    ).toEqual(['app/modules/catalog/']);
  });

  it('measures the contexts it names and holds each of them to its whole threshold, the others to nothing', () => {
    const root = projectWith({}, THREE_CONTEXTS);

    vi.stubEnv('DDD_TS_KIT_AFFECTED', 'shipping');

    expect(governedCoverage('integration', root)).toEqual({
      include: ['src/contexts/shipping/infrastructure/**/*.ts'],
      thresholds: { 'src/contexts/shipping/infrastructure/**/*.ts': REFERENCE_COVERAGE.infrastructure },
    });

    expect(Object.keys(governedCoverage('unit', root).thresholds)).toEqual(['src/contexts/shipping/domain/**/*.ts']);

    expect(governedJestCoverage(root)).toMatchObject({
      collectCoverageFrom: expect.arrayContaining(['<rootDir>/src/contexts/shipping/domain/**/*.ts']),
      coverageThreshold: {
        './src/contexts/shipping/domain/': REFERENCE_COVERAGE.domain,
        './src/contexts/shipping/infrastructure/': REFERENCE_COVERAGE.infrastructure,
      },
    });

    expect(governedJestCoverage(root).collectCoverageFrom).not.toContain(
      '<rootDir>/src/contexts/billing/domain/**/*.ts',
    );
  });

  it('holds the same floor on a partial run as on a run of everything: a context is never held to less', () => {
    const root = projectWith({ coverage: { domain: { lines: 100 } } }, THREE_CONTEXTS);
    const whole = governedCoverage('test', root).thresholds;

    vi.stubEnv('DDD_TS_KIT_AFFECTED', 'billing');

    const partial = governedCoverage('test', root).thresholds;

    expect(partial).toEqual({ 'src/contexts/billing/domain/**/*.ts': whole['src/contexts/billing/domain/**/*.ts'] });
    expect(partial['src/contexts/billing/domain/**/*.ts']).toMatchObject({ lines: 100 });
  });
});
