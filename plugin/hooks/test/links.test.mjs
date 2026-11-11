// A file a worker writes is the file it reaches: a link inside its scope to a file outside, a folder
// of its scope that is a link, a file with another name elsewhere, and a link of the temp directory
// into the project are judged where they land.

import assert from 'node:assert/strict';
import { linkSync, mkdirSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { bash, committed, decision, guardTemp, put, reason, run, worker, write } from './support.mjs';

test('a worker writes through no link to a place outside its scope, by the editor tools or by the shell', () => {
  const root = committed({ worktrees: 'advised' });
  const agent = worker(root, 'ordering');
  const context = join(root, 'src/contexts/ordering');
  symlinkSync('../../platform', join(context, 'platform'));
  symlinkSync('../../main.ts', join(context, 'main.ts'));
  symlinkSync('../../platform/new.ts', join(context, 'new.ts'));
  linkSync(join(root, 'package.json'), join(context, 'package.json'));
  symlinkSync(join(guardTemp, 'away.ts'), join(context, 'away.ts'));
  for (const file of ['platform/extra.ts', 'main.ts', 'new.ts', 'package.json', 'away.ts']) {
    const written = run('pre-write', write(join(context, file), agent));
    assert.equal(decision(written), 'deny', file);
    const redirected = run('pre-bash', bash(root, `echo x > src/contexts/ordering/${file}`, agent));
    assert.equal(decision(redirected), 'deny', file);
  }
  assert.match(reason(run('pre-write', write(join(context, 'main.ts'), agent))), /src\/main\.ts/);
  assert.match(reason(run('pre-write', write(join(context, 'away.ts'), agent))), new RegExp(`link to ${guardTemp}`));
  assert.match(reason(run('pre-write', write(join(context, 'package.json'), agent))), /another name/);
  symlinkSync(join(root, 'src/main.ts'), join(guardTemp, 'main-link.ts'));
  assert.equal(decision(run('pre-bash', bash(root, `echo x > ${guardTemp}/main-link.ts`, agent))), 'deny');
  mkdirSync(join(root, '.ddd-ts-kit'), { recursive: true });
  symlinkSync('../src/main.ts', join(root, '.ddd-ts-kit/report.md'));
  assert.equal(decision(run('pre-write', write(join(root, '.ddd-ts-kit/report.md'), agent))), 'deny');
});

test('a link of a worker that stays inside its scope is written freely', () => {
  const root = committed({ worktrees: 'advised' });
  const agent = worker(root, 'ordering');
  put(root, 'src/contexts/ordering/domain/order.ts', 'export {};\n');
  symlinkSync('domain', join(root, 'src/contexts/ordering/model'));
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/model/order.ts'), agent)).output, undefined);
  assert.equal(run('pre-bash', bash(root, 'echo x > src/contexts/ordering/model/notes.md', agent)).output, undefined);
  assert.equal(run('pre-bash', bash(root, `echo x > ${guardTemp}/out.txt`, agent)).output, undefined);
});

test('a folder of the scope of a worker is no hard link: it is moved, removed and copied into as its files are', () => {
  const root = committed({ worktrees: 'advised' });
  const agent = worker(root, 'ordering');
  put(root, 'src/contexts/ordering/domain/order.ts', 'export {};\n');
  mkdirSync(join(root, 'src/contexts/ordering/domain/old/inner'), { recursive: true });
  for (const command of [
    'git mv src/contexts/ordering/domain/old src/contexts/ordering/domain/new',
    'mv src/contexts/ordering/domain/old src/contexts/ordering/domain/new',
    'rmdir src/contexts/ordering/domain/old/inner',
    'rm -r src/contexts/ordering/domain/old',
    'cp src/contexts/ordering/domain/order.ts src/contexts/ordering/domain/old/',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  // A folder outside the scope stays outside it, and a file with two names is still a hard link.
  assert.equal(decision(run('pre-bash', bash(root, 'rm -r src/platform', agent))), 'deny');
  linkSync(join(root, 'package.json'), join(root, 'src/contexts/ordering/domain/old/package.json'));
  const linked = run('pre-bash', bash(root, 'rm src/contexts/ordering/domain/old/package.json', agent));
  assert.equal(decision(linked), 'deny');
});

test('a command given a folder of the scope is judged by what it brings and by the files it lands on there', () => {
  const root = committed({ worktrees: 'advised' });
  const agent = worker(root, 'ordering');
  const domain = 'src/contexts/ordering/domain';
  put(root, `${domain}/order.ts`, 'export {};\n');
  put(root, `${domain}/package.json`, '{}\n');
  put(root, `${domain}/main.ts`, 'export {};\n');
  put(root, `${domain}/tree/leaf.ts`, 'export {};\n');
  for (const folder of ['clean', 'held/deep', 'linked']) {
    mkdirSync(join(root, domain, folder), { recursive: true });
  }
  // A link or a whole tree is not brought from outside the scope into a folder of it.
  for (const command of [
    `ln package.json ${domain}/clean/`,
    `ln -t ${domain}/clean package.json`,
    `ln -s ${root}/package.json ${domain}/clean/`,
    `cp -l package.json ${domain}/clean/`,
    `cp --link package.json ${domain}/clean/`,
    `cp -al src/platform ${domain}/clean/`,
    `cp -r src/platform ${domain}/clean/`,
    `cp --target-directory=${domain}/clean -R src/platform`,
    `rsync -a src/platform ${domain}/clean/`,
    `rsync --link-dest=${root} package.json ${domain}/clean/`,
    `cp -r "$SOURCE" ${domain}/clean/`,
  ]) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(
      reason(refused),
      /brings .*, outside your scope, into src\/contexts\/ordering\/domain\/clean/,
      command,
    );
  }
  // A folder that holds a file with another name elsewhere takes no file, at any depth.
  linkSync(join(root, 'package.json'), join(root, domain, 'held/deep/package.json'));
  for (const command of [
    `cp ${domain}/package.json ${domain}/held/deep/`,
    `cp ${domain}/order.ts ${domain}/held/`,
    `cp -r ${domain}/tree ${domain}/held/`,
    `mv ${domain}/order.ts ${domain}/held/`,
    `ln ${domain}/order.ts ${domain}/held/`,
    `install ${domain}/package.json ${domain}/held/deep/`,
    `install -t ${domain}/held/deep ${domain}/package.json`,
    `rsync -a ${domain}/tree ${domain}/held/`,
  ]) {
    const refused = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(refused), 'deny', command);
    assert.match(reason(refused), /holds a file that has another name elsewhere \(a hard link\)/, command);
  }
  // A file that lands on a link out of the scope is the file the link reaches.
  symlinkSync(join(root, 'src/main.ts'), join(root, domain, 'linked/main.ts'));
  const landed = run('pre-bash', bash(root, `cp ${domain}/main.ts ${domain}/linked/`, agent));
  assert.match(reason(landed), /`cp` changes src\/contexts\/ordering\/domain\/linked\/main\.ts/);
  // Inside the scope, with no link on the way, a folder takes files and trees.
  for (const command of [
    `cp ${domain}/order.ts ${domain}/clean/`,
    `cp -r ${domain}/tree ${domain}/clean/`,
    `mv ${domain}/order.ts ${domain}/clean/`,
    `install ${domain}/order.ts ${domain}/clean/`,
    `rsync -a ${domain}/tree ${domain}/clean/`,
    `ln ${domain}/order.ts ${domain}/clean/`,
    `cp ${domain}/*.ts ${domain}/clean/`,
    `cp package.json ${domain}/clean/`,
    `install -d ${domain}/clean/more`,
    `cp ${domain}/order.ts`,
    `cp -t ${domain}/clean`,
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});
