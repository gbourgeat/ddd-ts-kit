// The acceptance of a story, its lock and its verdicts: who writes them, by the editor tools and by the
// shell.

import assert from 'node:assert/strict';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { bash, decision, edit, project, put, reason, run, worker, write } from './support.mjs';

const ACCEPTANCE = 'test/acceptance/us5.acceptance.spec.ts';
const SCENARIO = `it('#US5.02 AC1 a customer places an order', pending(async () => {
  expectStatus(await client.post('/orders', {}), 201);
}));
`;

test('a sub-agent only removes pending(...) from an acceptance scenario, by edit or by rewrite', () => {
  const root = project();
  const agent = worker(root);
  const file = join(root, ACCEPTANCE);
  put(root, ACCEPTANCE, SCENARIO);
  const unwrapped = `it('#US5.02 AC1 a customer places an order', async () => {
  expectStatus(await client.post('/orders', {}), 201);
});
`;
  assert.equal(run('pre-write', edit(file, { from: SCENARIO, to: unwrapped }, agent)).output, undefined);
  assert.equal(
    run('pre-write', { tool_name: 'Write', tool_input: { file_path: file, content: unwrapped }, ...agent }).output,
    undefined,
  );
  for (const easier of [
    SCENARIO.replace('201', '404'),
    SCENARIO.replace('{}), 201', '{ lines: [] }), 201'),
    SCENARIO.replace('  expectStatus', '  // expectStatus'),
  ]) {
    const refused = run('pre-write', edit(file, { from: SCENARIO, to: easier }, agent));
    assert.equal(decision(refused), 'deny', easier);
    assert.match(reason(refused), /only removes `pending\(\.\.\.\)`/);
    assert.match(reason(refused), /the conductor has the acceptance-judge agent judge it/);
  }
  const testWriter = { agent_type: 'ddd-ts-kit:domain-test-writer' };
  assert.equal(
    decision(run('pre-write', edit(file, { from: SCENARIO, to: SCENARIO.replace('201', '200') }, testWriter))),
    'deny',
  );
  const created = run('pre-write', write(join(root, 'test/acceptance/us6.acceptance.spec.ts'), agent));
  assert.equal(decision(created), 'deny');
});

test('the conductor edits an acceptance scenario, which the lock then judges; a new spec comes from its generator', () => {
  const root = project();
  const file = join(root, ACCEPTANCE);
  put(root, ACCEPTANCE, SCENARIO);
  assert.equal(run('pre-write', edit(file, { from: SCENARIO, to: SCENARIO.replace('201', '200') })).output, undefined);
  const created = run('pre-write', write(join(root, 'test/acceptance/us6.acceptance.spec.ts')));
  assert.equal(decision(created), 'deny');
  assert.match(reason(created), /npx ddd-ts-kit generate acceptance <story> --json/);
});

test('the lock of an acceptance is written by the CLI only, and locking is refused to a sub-agent', () => {
  const root = project();
  const lock = run('pre-write', write(join(root, 'test/acceptance/us5.acceptance.lock.json')));
  assert.equal(decision(lock), 'deny');
  assert.match(reason(lock), /npx ddd-ts-kit acceptance <story> --lock` writes it/);
  const agent = worker(root);
  for (const command of [
    'npx ddd-ts-kit acceptance US5 --lock',
    'npx ddd-ts-kit acceptance US5 --lock --json',
    'pnpm exec ddd-ts-kit acceptance US5 --lock',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, agent))), 'deny', command);
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
  assert.equal(run('pre-bash', bash(root, 'npx ddd-ts-kit acceptance US5 --gate written', agent)).output, undefined);
  assert.equal(decision(run('pre-bash', bash(root, 'npx ddd-ts-kit generate acceptance US5', agent))), 'deny');
});

test('a verdict on a locked acceptance is written by the acceptance judge alone, and the judge writes nothing else', () => {
  const root = project();
  const judge = { agent_type: 'ddd-ts-kit:acceptance-judge' };
  const verdictFile = join(root, 'test/acceptance/verdicts/us5-3f1c0a9b2d4e5f60.md');
  assert.equal(run('pre-write', write(verdictFile, judge)).output, undefined);
  for (const writer of [
    {},
    { agent_type: 'ddd-ts-kit:context-builder' },
    { agent_type: 'ddd-ts-kit:domain-test-writer' },
  ]) {
    const refused = run('pre-write', write(verdictFile, writer));
    assert.equal(decision(refused), 'deny');
    assert.match(reason(refused), /the acceptance-judge agent alone writes it/);
  }
  for (const elsewhere of [
    ACCEPTANCE,
    'test/acceptance/us5.acceptance.lock.json',
    'src/contexts/ordering/CONTEXT.md',
  ]) {
    assert.equal(decision(run('pre-write', write(join(root, elsewhere), judge))), 'deny', elsewhere);
  }
});

test('the shell only reads, versions or checks the lock and the verdicts of an acceptance, and the judge only reads', () => {
  const root = project();
  for (const command of [
    'echo "Verdict: amend" > test/acceptance/verdicts/us5-1.md',
    "node -e \"require('fs').writeFileSync('test/acceptance/verdicts/us5-1.md', '')\"",
    'cp /tmp/forged.json test/acceptance/us5.acceptance.lock.json',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command))), 'deny', command);
  }
  for (const command of [
    'git add test/acceptance/us5.acceptance.lock.json test/acceptance/verdicts/us5-1.md',
    'cat test/acceptance/verdicts/us5-1.md',
  ]) {
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
  const judge = { agent_type: 'ddd-ts-kit:acceptance-judge' };
  assert.equal(
    run('pre-bash', bash(root, 'git show HEAD:test/acceptance/us5.acceptance.spec.ts', judge)).output,
    undefined,
  );
  assert.equal(
    decision(run('pre-bash', bash(root, 'sed -i s/201/200/ test/acceptance/us5.acceptance.spec.ts', judge))),
    'deny',
  );
  assert.equal(decision(run('pre-bash', bash(root, 'npx ddd-ts-kit acceptance US5 --lock', judge))), 'deny');
});

test('a command that moves to a worktree or checks a path before it reads or versions a verdict is not a write', () => {
  const root = project();
  const verdict = 'test/acceptance/verdicts/us5-1.md';
  // The session stands above the worktree, as the main checkout stands above .worktrees/<name>.
  const into = `cd ${basename(root)}`;
  const above = (command) => bash(dirname(root), command);
  for (const input of [
    above(`${into} && git add ${verdict} && git commit -m x`),
    above(`${into} && sed -n 1p ${verdict}`),
    above(`${into} && sed -n '/^Verdict/p' ${verdict}`),
    above(`pushd ${basename(root)} && test -f ${verdict} && pwd && popd && true`),
    bash(root, `[ -f ${verdict} ] && jq . test/acceptance/us5.acceptance.lock.json`),
    bash(root, `awk 'NR == 1' ${verdict}`),
    bash(root, `less -N ${verdict}`),
  ]) {
    assert.equal(run('pre-bash', input).output, undefined, input.tool_input.command);
  }
  for (const input of [
    above(`${into} && echo x > ${verdict}`),
    above(`pushd ${basename(root)} && sed -n 1p ${verdict} > ${verdict}.bak`),
    bash(root, `sed -i s/a/b/ ${verdict}`),
    bash(root, `sed --in-place=.bak s/a/b/ ${verdict}`),
    bash(root, `sed -n 'w ${verdict}' /tmp/forged.md`),
    bash(root, `sed 's/a/b/w ${verdict}' /tmp/forged.md`),
    bash(root, `sed -f /tmp/script.sed ${verdict}`),
    bash(root, `awk '{ print > "${verdict}" }' /tmp/forged.md`),
    bash(root, `less -o ${verdict} /tmp/forged.md`),
  ]) {
    assert.equal(decision(run('pre-bash', input)), 'deny', input.tool_input.command);
  }
});

const VERDICT = 'test/acceptance/verdicts/us5-1.md';

// Each prints a verdict, its script given by an option or not: a `w` it holds is in a pattern, an operand,
// a text or a label, never a command.
const SED_READINGS = [
  `sed -n -e 1p --expression=2p ${VERDICT}`,
  `sed -n '\\%^Verdict: w%p' ${VERDICT}`,
  `sed -n '/Verdict\\/w/p' ${VERDICT}`,
  `sed 'y/vw/VW/' ${VERDICT}`,
  `sed '1a A wise line' ${VERDICT}`,
  `sed -n ':wait;/^Verdict/p;t wait' ${VERDICT}`,
  // An option left without its script reads as no script.
  `sed -n 1p ${VERDICT} -e`,
];

test('a sed script that only prints reads a verdict, and one given by -e that writes it does not', () => {
  const root = project();
  for (const command of SED_READINGS) {
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
  }
  const writing = bash(root, `sed -n -e 1p -e 'w ${VERDICT}' /tmp/forged.md`);
  assert.equal(decision(run('pre-bash', writing)), 'deny');
});
