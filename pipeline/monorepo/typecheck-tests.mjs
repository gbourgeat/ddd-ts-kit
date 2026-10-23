#!/usr/bin/env node
// The type check of the specs of every package: one compiler per package, as many at a time as
// the machine has cores, where a loop ran them one after the other. A project that fails prints
// its diagnostics, and the run fails once every project has answered.
//
//   node pipeline/monorepo/typecheck-tests.mjs
//
// A package is checked by its tsconfig.test.json, or by test/tsconfig.json when that is where
// it keeps the config of its specs. Run after the build: the specs import the built packages.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const COMPILER = path.join(ROOT, 'node_modules/@typescript/native/bin/tsc');
const CONFIGS = ['tsconfig.test.json', 'test/tsconfig.json'];

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}

async function main() {
  const projects = testProjects(ROOT);
  const results = await atMost(
    availableParallelism(),
    projects.map((project) => () => check(project)),
  );
  const failed = results.filter((result) => result.code !== 0);

  for (const { project, output } of failed) {
    console.error(`${project}:\n${output}`);
  }

  console.log(`${projects.length} projects type-checked, ${failed.length} failed.`);

  return failed.length === 0 ? 0 : 1;
}

/** The config of the specs of every package, where the package keeps it; sorted, so that a run reads the same way twice. */
export function testProjects(root) {
  return fs
    .readdirSync(path.join(root, 'packages'))
    .sort()
    .flatMap((name) => {
      const found = CONFIGS.map((file) => path.join('packages', name, file)).find((file) =>
        fs.existsSync(path.join(root, file)),
      );

      return found === undefined ? [] : [found];
    });
}

function check(project) {
  return new Promise((resolve) => {
    const compiler = spawn(process.execPath, [COMPILER, '-p', project], { cwd: ROOT });
    let output = '';

    compiler.stdout.on('data', (chunk) => {
      output += chunk;
    });
    compiler.stderr.on('data', (chunk) => {
      output += chunk;
    });
    compiler.on('close', (code) => resolve({ project, code: code ?? 1, output }));
  });
}

/** Runs the tasks at most `count` at a time, in their order, and answers their results in that order. */
async function atMost(count, tasks) {
  const results = new Array(tasks.length);
  let next = 0;

  const worker = async () => {
    for (let index = next++; index < tasks.length; index = next++) {
      results[index] = await tasks[index]();
    }
  };

  await Promise.all(Array.from({ length: Math.min(count, tasks.length) }, worker));

  return results;
}
