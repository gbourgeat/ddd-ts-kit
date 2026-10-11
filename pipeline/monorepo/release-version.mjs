#!/usr/bin/env node
/**
 * The packages are released together, under one version. Without an argument, checks that
 * every place that states the version agrees and prints it; `--expect <version>` also fails
 * when it is another one (the release workflow passes the tag); `--set <version>` writes the
 * new version everywhere, after which `npm install --package-lock-only` refreshes the lockfile.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const KIT = /^(@ddd-ts-kit\/|ddd-ts-kit$)/;
const SECTIONS = ['dependencies', 'peerDependencies', 'devDependencies', 'optionalDependencies'];
const SOURCES = ['packages/cli/src/version.ts', 'packages/cli/src/init/manifest/versions.ts'];
const MANIFESTS = ['packages/cli/templates/pipeline/package-scripts.json', 'examples/scheduling/package.json'];

process.exit(main(process.argv.slice(2)));

function main([flag, value]) {
  if (flag === '--set') {
    return set(value);
  }

  const found = stated();
  const versions = [...new Set(found.map((entry) => entry.version))];

  if (versions.length !== 1 || (flag === '--expect' && versions[0] !== value)) {
    console.error(
      `The release version is not stated once:\n${found.map((entry) => `  ${entry.version}  ${entry.where}`).join('\n')}`,
    );

    return 1;
  }

  console.log(versions[0]);

  return 0;
}

function set(version) {
  if (!SEMVER.test(version ?? '')) {
    console.error('Usage: release-version.mjs --set <major.minor.patch>');

    return 2;
  }

  const [current] = [...new Set(stated().map((entry) => entry.version))];

  for (const file of [...packageManifests(), ...MANIFESTS, ...SOURCES]) {
    const absolute = path.join(ROOT, file);

    fs.writeFileSync(absolute, restated(fs.readFileSync(absolute, 'utf8'), current, version));
  }

  console.log(`${current} -> ${version}. Run: npm install --package-lock-only`);

  return 0;
}

/** Only the version of the kit is replaced: a line that states it names the kit or is the `version` of a kit package. */
function restated(text, current, version) {
  return text
    .split('\n')
    .map((line) => (statesTheKit(line) ? line.replaceAll(current, version) : line))
    .join('\n');
}

function statesTheKit(line) {
  return /ddd-ts-kit|"version"|VERSION/.test(line);
}

function stated() {
  return [...packageManifests().flatMap(ofPackage), ...MANIFESTS.flatMap(ofDependencies), ...SOURCES.flatMap(ofSource)];
}

function packageManifests() {
  return fs.readdirSync(path.join(ROOT, 'packages')).map((directory) => `packages/${directory}/package.json`);
}

function ofPackage(file) {
  const manifest = read(file);

  return [{ version: manifest.version, where: `${file} version` }, ...ofDependencies(file)];
}

function ofDependencies(file) {
  const manifest = read(file);

  return SECTIONS.flatMap((section) =>
    Object.entries(manifest[section] ?? {})
      .filter(([name]) => KIT.test(name))
      .map(([name, range]) => ({ version: range.replace(/^[\^~]/, ''), where: `${file} ${section} ${name}` })),
  );
}

function ofSource(file) {
  const text = fs.readFileSync(path.join(ROOT, file), 'utf8');

  return [...text.matchAll(/'[\^~]?(\d+\.\d+\.\d+[0-9A-Za-z.-]*)'/g)]
    .filter((match) => statesTheKit(text.slice(text.lastIndexOf('\n', match.index) + 1, match.index)))
    .map((match) => ({ version: match[1], where: file }));
}

function read(file) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}
