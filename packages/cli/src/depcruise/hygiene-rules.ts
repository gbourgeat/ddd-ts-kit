import type { Config } from '../config/index.js';
import { DISCOVERED_SUFFIXES, EDGE_SUFFIXES } from '../declared/index.js';
import type { CruiseRule } from './cruise-rule.js';
import { escapePattern } from './escape-pattern.js';
import { testFiles } from './test-files.js';

export function hygieneRules(config: Config): CruiseRule[] {
  return [
    {
      name: 'no-circular',
      severity: 'error',
      comment:
        'Two modules that need each other are one module, or hide a third concept. Extract what both use, or invert one direction with a port.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'Nothing imports this file. Delete it, or register it where its context is assembled.',
      from: { orphan: true, pathNot: orphanExceptions(config) },
      to: {},
    },
    {
      name: 'not-to-undeclared-dependency',
      severity: 'error',
      comment: 'The package is not in package.json, or cannot be resolved. Declare it, or fix the specifier.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown', 'unknown'] },
    },
    ...productionRules(config),
  ];
}

function productionRules(config: Config): CruiseRule[] {
  const production = { path: `^${escapePattern(config.sourceRoot)}/`, pathNot: testFiles(config) };

  return [
    {
      name: 'not-to-dev-dependency',
      severity: 'error',
      comment:
        'Production code imports a package listed under devDependencies: it is absent from the production image. Move it to dependencies, or keep the import in a test.',
      from: production,
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'], pathNot: ['node_modules/@types/'] },
    },
    {
      name: 'not-to-test',
      severity: 'error',
      comment:
        'Production code imports a test file (spec, fake, builder, test support). Move what is shared to the layer that owns it.',
      from: production,
      to: { path: testFiles(config) },
    },
  ];
}

/** Entry points, files loaded by a tool instead of an import, and the fakes and worlds a context keeps ready for the tests to come. */
function orphanExceptions(config: Config): string[] {
  return [
    `^${escapePattern(config.sourceRoot)}/main\\.ts$`,
    `^${escapePattern(config.sourceRoot)}/apps/[^/]+/main\\.ts$`,
    `^${escapePattern(config.platformDir)}/tracing\\.ts$`,
    `^${escapePattern(config.contextsDir)}/[^/]+/published-language/`,
    `^${escapePattern(config.contextsDir)}/[^/]+/test/fakes/`,
    `^${escapePattern(config.contextsDir)}/[^/]+/test/worlds/`,
    ...discoveredFiles(config),
    '\\.d\\.[cm]?ts$',
    '\\.(spec|test)\\.[cm]?ts$',
    '(^|/)[^/]+\\.config\\.[cm]?[jt]s$',
    '^scripts/',
  ];
}

/** Under discovery the role files of a declared context (handlers, publishers, jobs, adapters...) and its generated dependencies file are loaded at startup, by no import. */
function discoveredFiles(config: Config): string[] {
  const { style, assembly } = config.stack;

  if (style !== 'declared' || assembly !== 'discovery') {
    return [];
  }

  return [
    `^${escapePattern(config.contextsDir)}/[^/]+/(application|infrastructure)/.*\\.(${DISCOVERED_SUFFIXES.join('|')})\\.ts$`,
    `^${escapePattern(config.contextsDir)}/[^/]+/presentation/.*\\.(${EDGE_SUFFIXES.join('|')})\\.ts$`,
    `^${escapePattern(config.contextsDir)}/[^/]+/[^/]+\\.dependencies\\.ts$`,
  ];
}
