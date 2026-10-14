#!/usr/bin/env node
/**
 * Packs every publishable workspace package the way `npm publish` would and checks the tarball:
 * publint for the manifest (exports, files, types), Are the Types Wrong for type resolution, and
 * the MIT notice, which travels in each package as the LICENSE of the repository, and the notes of
 * the CLI: its CHANGELOG.md, which an agent reads in node_modules to move past a version.
 * Build first: the tarballs hold `dist/`.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '../..');
const PACKAGES = path.join(ROOT, 'packages');
const BIN = path.join(ROOT, 'node_modules/.bin');
const LICENSE = fs.readFileSync(path.join(ROOT, 'LICENSE'), 'utf8');
const CHANGELOG = fs.readFileSync(path.join(ROOT, 'CHANGELOG.md'), 'utf8');
const CLI = 'ddd-ts-kit';

process.exit(main());

function main() {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'package-check-'));
  try {
    const failures = publishablePackages().flatMap((entry) => check(entry, destination));
    console.log(
      failures.length === 0
        ? '\nEvery package passes publint and attw, and carries the LICENSE; the CLI carries the CHANGELOG.'
        : `\n${failures.length} failed check(s):\n${failures.map((failure) => `  ${failure}`).join('\n')}`,
    );
    return failures.length === 0 ? 0 : 1;
  } finally {
    fs.rmSync(destination, { recursive: true, force: true });
  }
}

function publishablePackages() {
  return fs
    .readdirSync(PACKAGES)
    .map((name) => path.join(PACKAGES, name))
    .filter((directory) => fs.existsSync(path.join(directory, 'package.json')))
    .map((directory) => ({
      directory,
      manifest: JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')),
    }))
    .filter(({ manifest }) => manifest.private !== true);
}

function check({ directory, manifest }, destination) {
  console.log(`\n== ${manifest.name}`);
  if (!fs.existsSync(path.join(directory, 'dist'))) {
    return [`${manifest.name}: no dist/ directory, run the build first`];
  }
  const packed = pack(directory, destination);
  if (packed === undefined) {
    return [`${manifest.name}: npm pack failed`];
  }
  const { tarball, files } = packed;
  const licensed = files.includes('LICENSE') && fs.readFileSync(path.join(directory, 'LICENSE'), 'utf8') === LICENSE;
  const noted =
    manifest.name !== CLI ||
    (files.includes('CHANGELOG.md') && fs.readFileSync(path.join(directory, 'CHANGELOG.md'), 'utf8') === CHANGELOG);
  const tools = [
    { name: 'publint', args: ['run', tarball, '--strict'] },
    // A package without typed exports (the CLI: a binary only) has no type resolution to check.
    ...(hasTypedExports(manifest)
      ? [{ name: 'attw', args: [tarball, '--profile', 'esm-only', '--format', 'ascii', '--no-emoji', '--no-color'] }]
      : []),
  ];
  return [
    ...(licensed ? [] : [`${manifest.name}: no LICENSE identical to the one of the repository in the tarball`]),
    ...(noted ? [] : [`${manifest.name}: no CHANGELOG.md identical to the one of the repository in the tarball`]),
    ...tools.filter((tool) => !passes(tool)).map((tool) => `${manifest.name}: ${tool.name}`),
  ];
}

function pack(directory, destination) {
  const result = spawnSync('npm', ['pack', '--json', '--pack-destination', destination], {
    cwd: directory,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    console.error(result.stderr);
    return undefined;
  }
  const [{ filename, files }] = JSON.parse(result.stdout);
  return { tarball: path.join(destination, filename), files: files.map((file) => file.path) };
}

function hasTypedExports(manifest) {
  return JSON.stringify(manifest.exports ?? {}).includes('"types"') || typeof manifest.types === 'string';
}

function passes({ name, args }) {
  return spawnSync(path.join(BIN, name), args, { cwd: ROOT, stdio: 'inherit' }).status === 0;
}
