const fs = require('node:fs');
const path = require('node:path');

const PACKAGES = 'packages';
const SOURCE = `^${PACKAGES}/([^/]+)/src/`;
const TEST_FILES = [`^${PACKAGES}/[^/]+/test/`, '\\.(spec|test)\\.[cm]?ts$'];
/** Tests whose purpose is to hold two packages to the same behaviour: they read both sources. */
const CROSS_PACKAGE_PINS = [`^${PACKAGES}/eslint-plugin/test/classification\\.spec\\.ts$`];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Two modules that need each other are one module, or hide a third concept. Extract what both use, or invert one direction with an interface.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'error',
      comment: 'Nothing imports this source and it is not an entry of its package. Delete it, or export it from an entry.',
      from: { orphan: true, path: SOURCE, pathNot: ['\\.d\\.[cm]?ts$', ...packageEntries()] },
      to: {},
    },
    {
      name: 'not-to-dev-dependency',
      severity: 'error',
      comment: 'A published source imports a package listed under devDependencies: it is absent once the package is installed. Move it to dependencies or peerDependencies.',
      from: { path: SOURCE },
      to: { dependencyTypes: ['npm-dev'], dependencyTypesNot: ['type-only', 'npm', 'npm-peer', 'npm-optional'], pathNot: ['node_modules/@types/'] },
    },
    {
      name: 'not-to-undeclared-dependency',
      severity: 'error',
      comment: 'A published source imports a package its own package.json does not declare (hoisting hides it here, not at the consumer), or a module that cannot be resolved.',
      from: { path: SOURCE },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown', 'unknown'], dependencyTypesNot: ['npm', 'npm-peer', 'npm-optional', 'npm-dev'] },
    },
    {
      name: 'not-to-test',
      severity: 'error',
      comment: 'A published source imports a test file. Move what is shared to src/, or to @ddd-ts-kit/testing.',
      from: { path: SOURCE },
      to: { path: TEST_FILES },
    },
    {
      name: 'no-relative-import-across-packages',
      severity: 'error',
      comment: 'A package reaches into another package by path. Import it by its package name and declare it in package.json.',
      from: { path: `^${PACKAGES}/([^/]+)/`, pathNot: CROSS_PACKAGE_PINS },
      to: { path: `^${PACKAGES}/(?!$1/)[^/]+/` },
    },
  ],
  options: {
    doNotFollow: { path: ['node_modules'] },
    exclude: { path: [`^${PACKAGES}/[^/]+/(dist|templates|node_modules)/`, `^${PACKAGES}/[^/]+/test/generated/`] },
    // A workspace package then resolves under node_modules, as it does at the consumer, and a relative path into it stands out.
    preserveSymlinks: true,
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    skipAnalysisNotInRules: true,
  },
};

/** Sources published through `exports` or `bin`: nothing inside the package imports them. */
function packageEntries() {
  return fs
    .readdirSync(path.join(__dirname, PACKAGES))
    .filter((name) => fs.existsSync(manifestOf(name)))
    .flatMap((name) => publishedFiles(JSON.parse(fs.readFileSync(manifestOf(name), 'utf8'))).map((file) => `^${PACKAGES}/${name}/${sourceOf(file)}$`));
}

function manifestOf(name) {
  return path.join(__dirname, PACKAGES, name, 'package.json');
}

function publishedFiles(manifest) {
  const binaries = typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {});
  return [...leaves(manifest.exports ?? {}), ...binaries].filter((file) => file.endsWith('.js'));
}

function leaves(value) {
  return typeof value === 'string' ? [value] : Object.values(value).flatMap(leaves);
}

function sourceOf(built) {
  return built.replace(/^\.\//, '').replace(/^dist\//, 'src/').replace(/\.js$/, '\\.ts');
}
