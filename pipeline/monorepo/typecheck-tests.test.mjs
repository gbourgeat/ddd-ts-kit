import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { testProjects } from './typecheck-tests.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('every package has the config of its specs, found where the package keeps it', () => {
  const projects = testProjects(ROOT);
  const packages = fs.readdirSync(path.join(ROOT, 'packages')).sort();

  assert.equal(projects.length, packages.length);
  assert.ok(projects.includes(path.join('packages', 'kernel', 'tsconfig.test.json')));
  assert.ok(projects.includes(path.join('packages', 'cli', 'test', 'tsconfig.json')));
  assert.ok(projects.every((project) => fs.existsSync(path.join(ROOT, project))));
  assert.deepEqual(projects, [...projects].sort());
});
