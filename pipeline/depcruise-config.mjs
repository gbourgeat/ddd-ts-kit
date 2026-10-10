import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const PROJECT_CONFIG = 'ddd-ts-kit.config.json';

/** @type {import('dependency-cruiser').IConfiguration} */
export default buildConfiguration(readProjectConfig());

function readProjectConfig() {
  const file = path.join(import.meta.dirname, PROJECT_CONFIG);
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const sourceRoot = posix(raw.sourceRoot ?? 'src');
  const kernel = ['@ddd-ts-kit/kernel'];
  return {
    sourceRoot,
    contextsDir: posix(raw.contextsDir ?? `${sourceRoot}/contexts`),
    sharedKernelDir: posix(raw.sharedKernelDir ?? `${sourceRoot}/shared-kernel`),
    upstreams: upstreamsByContext(raw.contexts ?? {}),
    domainPackages: raw.domainAllowedPackages ?? kernel,
    applicationPackages: raw.applicationAllowedPackages ?? kernel,
    contractPackages: raw.publishedLanguageAllowedPackages ?? [...kernel, '@ddd-ts-kit/events', '@ddd-ts-kit/validation', ...schemaLibraries(raw.stack?.validation ?? 'zod')],
  };
}

function posix(value) {
  return value.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '');
}

function upstreamsByContext(contexts) {
  return Object.fromEntries(Object.entries(contexts).map(([name, context]) => [name, (context.upstreams ?? []).map(upstreamName).filter(Boolean)]));
}

function upstreamName(upstream) {
  return typeof upstream === 'string' ? upstream : upstream?.context;
}

function schemaLibraries(validation) {
  if (validation === 'zod') return ['zod'];
  return validation === 'class-validator' ? ['class-validator', 'class-transformer'] : [];
}

function buildConfiguration(project) {
  return {
    forbidden: [...layerRules(project), ...contextRules(project), ...hygieneRules(project)],
    options: cruiseOptions(chooseParser()),
  };
}

/**
 * dependency-cruiser reads TypeScript through the compiler API of `typescript` 2 to 6, which
 * also tells type-only imports apart. A project whose only `typescript` is the native version 7
 * has no such API: sources are then parsed with `@swc/core`. Without either, dependency-cruiser
 * reads no TypeScript file and reports zero violation, a silent pass, hence the error.
 */
function chooseParser() {
  const require = createRequire(path.join(import.meta.dirname, 'package.json'));
  if (installedMajor(require, 'typescript') < 7) return 'tsc';
  if (installedMajor(require, '@swc/core') < Infinity) return 'swc';
  throw new Error('dependency-cruiser cannot read TypeScript here. Install `typescript@6` (the version typescript-eslint needs too) or `@swc/core` as a dev dependency.');
}

function installedMajor(require, name) {
  try {
    return Number(require(`${name}/package.json`).version.split('.')[0]);
  } catch {
    return Infinity;
  }
}

function layerRules(project) {
  const context = `^${escape(project.contextsDir)}/([^/]+)`;
  const own = (layer) => `^${escape(project.contextsDir)}/$1/${layer}(/|\\.ts$)`;
  const sharedKernel = `^${escape(project.sharedKernelDir)}/`;
  const otherContexts = `^${escape(project.contextsDir)}/(?!$1/)[^/]+/`;
  return [
    {
      name: 'layer-domain-purity',
      severity: 'error',
      comment: 'domain/ imports only its own domain/, the shared kernel and the allowed kernel packages. Invert the dependency: declare the need as a port, an abstract class in domain/repositories or application/ports.',
      from: { path: `${context}/domain/`, pathNot: testFiles(project) },
      to: { pathNot: [own('domain'), sharedKernel, internalsOf(project), ...packages(project.domainPackages)] },
    },
    {
      name: 'layer-application-inward',
      severity: 'error',
      comment: 'application/ imports domain/, application/, published languages and the allowed kernel packages. Depend on a port and let the composition root bind the adapter.',
      from: { path: `${context}/application/`, pathNot: testFiles(project) },
      to: { pathNot: [own('domain'), own('application'), own('published-language'), sharedKernel, otherContexts, ...packages(project.applicationPackages)] },
    },
    sideways({ project, from: 'presentation', to: 'infrastructure', instead: 'Go through the command or query bus; the adapter is bound in the module file.' }),
    sideways({ project, from: 'infrastructure', to: 'presentation', instead: 'Move the shared type to application/ and let both sides import it from there.' }),
  ];
}

function sideways({ project, from, to, instead }) {
  const contexts = `^${escape(project.contextsDir)}`;
  return {
    name: `layer-${from}-no-${to}`,
    severity: 'error',
    comment: `${from}/ never imports ${to}/. ${instead}`,
    from: { path: `${contexts}/([^/]+)/${from}/`, pathNot: testFiles(project) },
    to: { path: `${contexts}/$1/${to}(/|\\.ts$)` },
  };
}

/** Another context reached outside its published language: context-published-language-only reports it, once. */
function internalsOf(project) {
  return `^${escape(project.contextsDir)}/(?!$1/)[^/]+/(?!published-language(/|\\.ts$))`;
}

function contextRules(project) {
  const contexts = `^${escape(project.contextsDir)}`;
  const publishedLanguage = `${contexts}/[^/]+/published-language(/|\\.ts$)`;
  return [
    {
      name: 'context-published-language-only',
      severity: 'error',
      comment: "A file imports from another context only through that context's published-language/. Publish the missing contract there or react to an integration event.",
      from: { path: `${contexts}/([^/]+)/` },
      to: { path: `${contexts}/[^/]+/`, pathNot: [`${contexts}/$1/`, publishedLanguage] },
    },
    ...Object.entries(project.upstreams).map(([name, upstreams]) => declaredRelationship({ contexts, name, upstreams })),
    {
      name: 'context-declared-relationship',
      severity: 'error',
      comment: `A context missing from ${PROJECT_CONFIG} declares no upstream. Add it to "contexts" with its upstreams.`,
      from: { path: `${contexts}/([^/]+)/`, pathNot: Object.keys(project.upstreams).map((name) => `${contexts}/${escape(name)}/`) },
      to: { path: publishedLanguage, pathNot: `${contexts}/$1/` },
    },
    {
      name: 'context-published-language-is-a-contract',
      severity: 'error',
      comment: 'published-language/ imports only its allowed packages and other published languages. Declare the contract with plain serializable types written in that folder.',
      from: { path: publishedLanguage, pathNot: testFiles(project) },
      to: { pathNot: [publishedLanguage, ...packages(project.contractPackages)] },
    },
  ];
}

function declaredRelationship({ contexts, name, upstreams }) {
  const declared = [name, ...upstreams].map(escape).join('|');
  return {
    name: 'context-declared-relationship',
    severity: 'error',
    comment: `"${name}" imports the published language of a context that is not one of its upstreams. Declare the relationship under contexts.${name}.upstreams in ${PROJECT_CONFIG}, after checking that the direction is intended.`,
    from: { path: `${contexts}/${escape(name)}/` },
    to: { path: `${contexts}/[^/]+/published-language(/|\\.ts$)`, pathNot: `${contexts}/(${declared})/` },
  };
}

function hygieneRules(project) {
  return [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Two modules that need each other are one module, or hide a third concept. Extract what both use, or invert one direction with a port.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'Nothing imports this file. Delete it, or register it where its context is assembled.',
      from: { orphan: true, pathNot: orphanExceptions(project) },
      to: {},
    },
    {
      name: 'not-to-undeclared-dependency',
      severity: 'error',
      comment: 'The package is not in package.json, or cannot be resolved. Declare it, or fix the specifier.',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown', 'unknown'] },
    },
    ...productionRules(project),
  ];
}

function productionRules(project) {
  const production = { path: `^${escape(project.sourceRoot)}/`, pathNot: testFiles(project) };
  return [
    {
      name: 'not-to-dev-dependency',
      severity: 'error',
      comment: 'Production code imports a package listed under devDependencies: it is absent from the production image. Move it to dependencies, or keep the import in a test.',
      from: production,
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only'], pathNot: ['node_modules/@types/'] },
    },
    {
      name: 'not-to-test',
      severity: 'error',
      comment: 'Production code imports a test file (spec, fake, builder, test support). Move what is shared to the layer that owns it.',
      from: production,
      to: { path: testFiles(project) },
    },
  ];
}

function testFiles(project) {
  return [`^${escape(project.contextsDir)}/[^/]+/test/`, '\\.(spec|test)\\.[cm]?ts$', '(^|/)open-test-database\\.ts$', '^test/'];
}

/** Entry points and files loaded by a tool instead of an import. */
function orphanExceptions(project) {
  return [
    `^${escape(project.sourceRoot)}/main\\.ts$`,
    `^${escape(project.sourceRoot)}/platform/tracing\\.ts$`,
    `^${escape(project.contextsDir)}/[^/]+/published-language/`,
    '\\.d\\.[cm]?ts$',
    '\\.(spec|test)\\.[cm]?ts$',
    '(^|/)[^/]+\\.config\\.[cm]?[jt]s$',
    '^scripts/',
  ];
}

/** A package as resolved in node_modules, as a linked workspace, or as written when it is not installed. */
function packages(names) {
  return names.flatMap((name) => [`(^|/)node_modules/${escape(name)}/`, `^${escape(name)}(/|$)`]);
}

function escape(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cruiseOptions(parser) {
  return {
    parser,
    doNotFollow: { path: ['node_modules'] },
    exclude: { path: ['^dist/', '^coverage/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
    reporterOptions: { text: { highlightFocused: true } },
  };
}
