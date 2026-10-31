import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const WORKFLOW = fs.readFileSync(path.resolve(import.meta.dirname, '../../.github/workflows/release.yml'), 'utf8');

test('the job that installs and builds holds no publishing identity', () => {
  for (const job of jobs().filter((entry) => /run: npm (ci|install)\b/.test(entry.text))) {
    assert.doesNotMatch(
      job.text,
      /id-token:\s*write/,
      `${job.id} installs dependencies and asks for an identity token`,
    );
  }
});

test('the job that holds the publishing identity installs and builds nothing', () => {
  const holders = jobs().filter((entry) => /id-token:\s*write/.test(entry.text));

  assert.ok(holders.length > 0);

  for (const job of holders) {
    assert.doesNotMatch(job.text, /npm (ci|install|run build)\b/, `${job.id} installs or builds`);
    assert.match(job.text, /environment: npm/);
  }
});

function jobs() {
  const [, body] = WORKFLOW.split(/^jobs:\n/m);

  return body
    .split(/^ {2}(?=[a-z][\w-]*:\n)/m)
    .filter((block) => /^[a-z][\w-]*:\n/.test(block))
    .map((block) => ({ id: block.split(':')[0], text: block }));
}
