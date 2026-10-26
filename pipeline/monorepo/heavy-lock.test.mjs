import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

const SCRIPT = path.resolve(import.meta.dirname, 'heavy-lock.sh');
const HAS_FLOCK = spawnSync('sh', ['-c', 'command -v flock']).status === 0;

test('runs the command and answers its exit code', { skip: !HAS_FLOCK }, () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heavy-lock-'));
  const ok = spawnSync('bash', [SCRIPT, 'sh', '-c', 'echo ran'], { env: environment(directory), encoding: 'utf8' });
  const failing = spawnSync('bash', [SCRIPT, 'sh', '-c', 'exit 7'], { env: environment(directory) });

  assert.equal(ok.stdout.trim(), 'ran');
  assert.equal(failing.status, 7);
});

test('refuses to run nothing', () => {
  assert.equal(spawnSync('bash', [SCRIPT]).status, 2);
});

test('runs at once in a pipeline', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heavy-lock-'));
  const result = spawnSync('bash', [SCRIPT, 'sh', '-c', 'echo ran'], {
    env: environment(directory, { CI: 'true' }),
    encoding: 'utf8',
  });

  assert.equal(result.stdout.trim(), 'ran');
  assert.deepEqual(fs.readdirSync(directory), []);
});

test('lets two commands hold a slot and makes a third wait for one', { skip: !HAS_FLOCK }, async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'heavy-lock-'));
  const env = environment(directory);
  const release = path.join(directory, 'release');
  const hold = `while [ ! -e ${release} ]; do sleep 0.1; done`;
  const started = (name) => path.join(directory, name);
  const run = (name, command) =>
    new Promise((resolve) => {
      const child = spawn('bash', [SCRIPT, 'sh', '-c', `touch ${started(name)}; ${command}`], { env, stdio: 'ignore' });

      child.on('close', resolve);
    });
  const until = async (file) => {
    for (let waited = 0; !fs.existsSync(file) && waited < 100; waited += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  const first = run('first', hold);
  const second = run('second', hold);

  await until(started('first'));
  await until(started('second'));

  const third = run('third', 'true');

  await new Promise((resolve) => setTimeout(resolve, 1000));
  assert.equal(fs.existsSync(started('third')), false, 'the third command started with two slots taken');

  fs.writeFileSync(release, '');
  await Promise.all([first, second, third]);

  assert.equal(fs.existsSync(started('third')), true);
});

function environment(directory, more = {}) {
  const env = { ...process.env, XDG_RUNTIME_DIR: directory, DDD_TS_KIT_HEAVY_SLOTS: '2' };

  Reflect.deleteProperty(env, 'CI');

  return { ...env, ...more };
}
