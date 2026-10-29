// A context worker: what it writes and what its commands change, inside its bounded context only.

import assert from 'node:assert/strict';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  bash,
  committed,
  decision,
  directory,
  git,
  launcher,
  patchConfig,
  project,
  put,
  reason,
  run,
  worker,
  write,
} from './support.mjs';

test('a context worker writes inside its bounded context and its end-to-end specs only', () => {
  const root = project();
  const agent = worker(root);
  put(root, 'test/e2e/place-order.e2e.spec.ts');
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent)).output, undefined);
  assert.equal(
    run('pre-write', write(join(root, 'src/contexts/ordering/infrastructure/persistence/order.mapper.ts'), agent))
      .output,
    undefined,
  );
  assert.equal(run('pre-write', write(join(root, 'test/e2e/place-order.e2e.spec.ts'), agent)).output, undefined);
  assert.equal(run('pre-write', write(join(root, '.ddd-ts-kit/report.md'), agent)).output, undefined);
  const neighbour = run('pre-write', write(join(root, 'src/contexts/billing/CONTEXT.md'), agent));
  assert.equal(decision(neighbour), 'deny');
  assert.match(reason(neighbour), /another bounded context/);
  assert.match(reason(neighbour), /report the need to the conductor/);
});

test('a context worker keeps the support of its end-to-end specs in a folder named after its context', () => {
  const root = project();
  const agent = worker(root);
  for (const path of ['test/e2e/support/ordering/order-world.ts', 'test/e2e/support/ordering/sign-in-buyer.ts']) {
    assert.equal(run('pre-write', write(join(root, path), agent)).output, undefined, path);
  }
  const shared = run('pre-write', write(join(root, 'test/e2e/support/billing/invoice-world.ts'), agent));
  assert.equal(decision(shared), 'deny');
  assert.match(reason(shared), /test\/e2e\/support\/ordering\//);
  assert.match(reason(shared), /shared file .* conductor/);
});

test('a context worker never writes a shared file', () => {
  const root = project();
  const agent = worker(root);
  for (const path of [
    'ddd-ts-kit.config.json',
    'src/main.ts',
    'src/platform/composition/compose-application.ts',
    'package.json',
    'package-lock.json',
    'docs/context-map.md',
    'docs/architecture/plan.md',
    'migrations/0002_orders.js',
    'test/e2e/support/start-application.ts',
    '.ddd-ts-kit/worker.json',
  ]) {
    const result = run('pre-write', write(join(root, path), agent));
    assert.equal(decision(result), 'deny', path);
    assert.match(reason(result), /shared file .* conductor/, path);
  }
  const barrel = run('pre-write', write(join(root, 'src/contexts/ordering/ordering.declarations.ts'), agent));
  assert.equal(decision(barrel), 'deny');
});

test('the worker scope comes from the scope file or the environment, and binds the worker agent only', () => {
  const root = project();
  const shared = join(root, 'src/platform/composition/compose-application.ts');
  const agent = { agent_type: 'ddd-ts-kit:context-builder' };
  assert.equal(run('pre-write', write(shared, agent)).output, undefined);
  assert.equal(decision(run('pre-write', write(shared, agent), { DDD_TS_KIT_WORKER_CONTEXT: 'billing' })), 'deny');
  worker(root);
  assert.equal(run('pre-write', write(shared)).output, undefined);
  assert.equal(run('pre-write', write(shared, { agent_type: 'ddd-ts-kit:architecture-reviewer' })).output, undefined);
  put(root, '.ddd-ts-kit/worker.json', 'not json');
  assert.equal(run('pre-write', write(shared, agent)).output, undefined);
});

test('in advise mode the worker scope asks, and off silences it', () => {
  const advised = project({ guard: 'advise' });
  assert.equal(decision(run('pre-write', write(join(advised, 'src/main.ts'), worker(advised)))), 'ask');
  const silent = project({ guard: 'off' });
  assert.equal(run('pre-write', write(join(silent, 'src/main.ts'), worker(silent))).output, undefined);
});

test('a context worker does not run a generator that writes shared files or another context', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npx ddd-ts-kit generate repository ordering Order --json',
    'npx ddd-ts-kit g integration-event ordering Order Placed',
    'npx ddd-ts-kit generate context shipping --classification core',
    'npx ddd-ts-kit@latest generate job ordering ExpireOrders --every 1h --command PlaceOrder',
  ]) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /conductor runs it on the trunk/, command);
  }
  const neighbour = run('pre-bash', bash(root, 'npx ddd-ts-kit generate value-object billing Money --json', agent));
  assert.match(reason(neighbour), /another context/);
  const implied = run(
    'pre-bash',
    bash(
      root,
      'npx ddd-ts-kit generate command ordering PlaceOrder --aggregate PurchaseOrder --permission order.place',
      agent,
    ),
  );
  assert.match(reason(implied), /repository of PurchaseOrder/);
});

test('a context worker generates freely inside its context, and reads anywhere', () => {
  const root = project();
  const agent = worker(root);
  put(root, 'src/contexts/ordering/domain/repositories/purchase-order.repository.ts');
  for (const command of [
    'npx ddd-ts-kit generate value-object ordering Money --json',
    'npx ddd-ts-kit generate command ordering PlaceOrder --aggregate PurchaseOrder --permission order.place',
    'npx ddd-ts-kit list --json',
    'npx ddd-ts-kit check --changed-since main',
    'npm install',
    'npm ci',
    'npm test -- ordering',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('a context worker records a decision of its slices, and no deviation', () => {
  const root = committed();
  const agent = worker(root);
  const record = 'npx ddd-ts-kit generate adr "Rounding of late fees" --number 0402';
  assert.equal(run('pre-bash', bash(root, record, agent)).output, undefined);
  const deviation = run('pre-bash', bash(root, `${record} --deviation clean/file-size`, agent));
  assert.equal(decision(deviation), 'deny');
  assert.match(reason(deviation), /ddd-ts-kit\.config\.json/);
  put(root, 'docs/adr/0402-rounding-of-late-fees.md', '# ADR-0402: Rounding of late fees\n');
  const own = join(root, 'docs/adr/0402-rounding-of-late-fees.md');
  assert.equal(run('pre-write', write(own, agent)).output, undefined);
  put(root, 'docs/adr/0001-record-architecture-decisions.md', '# ADR-0001\n');
  git(root, 'add', 'docs/adr/0001-record-architecture-decisions.md');
  git(root, 'commit', '--quiet', '--no-verify', '--message', 'docs: a record of the trunk');
  const trunk = run('pre-write', write(join(root, 'docs/adr/0001-record-architecture-decisions.md'), agent));
  assert.equal(decision(trunk), 'deny');
  assert.equal(decision(run('pre-write', write(join(root, 'docs/adr/notes/draft.md'), agent))), 'deny');
});

test('a context worker writes its working migration, and no other migration', () => {
  const root = project();
  const agent = worker(root);
  for (const path of [
    'migrations/20261015101500_working-add-orders.sql',
    'migrations/20261015101500_working-add-orders.ts',
    'migrations/1791829645467-working-add-orders.ts',
    'prisma/migrations/20261015101500_working_add_orders/migration.sql',
    'db/migrations/20261015101500_working-add-orders.sql',
  ]) {
    assert.equal(run('pre-write', write(join(root, path), agent)).output, undefined, path);
  }
  for (const path of [
    'migrations/20261015101500_add-orders.sql',
    'migrations/meta/_journal.json',
    'src/platform/migrations/20261015101500_working-add-orders.ts',
    'src/contexts/billing/migrations/20261015101500_working-add-orders.ts',
  ]) {
    assert.equal(decision(run('pre-write', write(join(root, path), agent))), 'deny', path);
  }
});

test('a context worker changes the Prisma models of its context, and no other file of the schema', () => {
  const root = project();
  const agent = worker(root);
  assert.equal(run('pre-write', write(join(root, 'prisma/schema/ordering.prisma'), agent)).output, undefined);
  put(root, 'prisma/schema/ordering.prisma', 'model OrderingOrder {\n  id String @id\n}\n');
  assert.equal(
    run('pre-bash', bash(root, 'sed -i s/String/Text/ prisma/schema/ordering.prisma', agent)).output,
    undefined,
  );
  const neighbour = run('pre-write', write(join(root, 'prisma/schema/billing.prisma'), agent));
  assert.equal(decision(neighbour), 'deny');
  assert.match(reason(neighbour), /another bounded context/);
  for (const path of ['prisma/schema/schema.prisma', 'prisma/schema.prisma', 'prisma/schema/ordering/extra.prisma']) {
    const shared = run('pre-write', write(join(root, path), agent));
    assert.equal(decision(shared), 'deny', path);
    assert.match(reason(shared), /shared file .* conductor/, path);
  }
});

test('a context worker generates a working migration only', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npm run db:generate working-add-orders',
    'npm run db:generate -- working_add_orders',
    'npm run db:generate migrations/working-add-orders',
    'npm run db:migrate',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  const real = run('pre-bash', bash(root, 'npm run db:generate add-orders', agent));
  assert.equal(decision(real), 'deny');
  assert.match(reason(real), /db:generate working-add-orders/);
  assert.equal(run('pre-bash', bash(root, 'npm run db:generate add-orders')).output, undefined);
});

test('a generator of shared files is refused to a worker however the CLI is launched', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'node node_modules/ddd-ts-kit/dist/bin.js generate repository ordering Order',
    'node scripts/kit.mjs g context shipping',
    'npm exec ddd-ts-kit -- generate integration-event ordering Order Placed',
  ]) {
    assert.equal(decision(run('pre-bash', bash(root, command, agent))), 'deny', command);
  }
  assert.equal(
    run('pre-bash', bash(root, 'node scripts/kit.mjs generate value-object ordering Money', agent)).output,
    undefined,
  );
  assert.equal(run('pre-bash', bash(root, 'npm run docs:generate', agent)).output, undefined);
});

const DEPENDENCY_CHANGES = [
  'npm install dayjs',
  'npm i zod',
  'npm i -D zod',
  'npm install --save-dev zod',
  'npm install -E -D zod',
  'npm i zod@1 --save-exact',
  'pnpm add -D zod',
  'yarn add --dev zod',
  'bun add zod',
  'npm uninstall dayjs',
  'pnpm update',
  'npm pkg set dependencies.zod=4',
  'cd src && npm i -D zod',
  'bash -c "npm i -D zod"',
  'npm audit fix',
];

test('a context worker does not change the dependencies, wherever the flags stand', () => {
  const root = project();
  const agent = worker(root);
  for (const command of DEPENDENCY_CHANGES) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), /lockfile/, command);
  }
});

test('a context worker installs the lockfile freely', () => {
  const root = project();
  const agent = worker(root);
  for (const command of [
    'npm ci',
    'npm install',
    'npm i',
    'npm install --omit dev',
    'pnpm install --frozen-lockfile',
    'yarn install --immutable',
    'npm audit',
    'git commit -m "build: npm i zod is for the conductor"',
  ]) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

// The table of the Bash commands a worker runs: the kit's own commands pass, every way of writing
// a file of the project around the editor tools is refused.
const WORKER_COMMANDS_ALLOWED = [
  'npx ddd-ts-kit generate value-object invoicing Money --json',
  'npx ddd-ts-kit verify-slice invoicing --since main 2>&1 | tail -40',
  'npx ddd-ts-kit check --changed-since main > /dev/null',
  'npm run format',
  'npm run lint:fix',
  'npm run regenerate',
  'npm test -- invoicing 2>&1 | tail -20',
  'npm run verify &> /dev/null; echo $?',
  'npm test > "$TMPDIR/invoicing-tests.log" 2>&1',
  'ls src/contexts >&2',
  'git add src/contexts/invoicing && git status --porcelain',
  'pushd src/contexts/invoicing && git add . && popd && git status --porcelain',
  'git diff --stat main',
  'git log --oneline -5',
  "git commit -F - <<'EOF'\nfeat(invoicing): issue an invoice\n\nA total > 0 is checked; rm -rf src is a sentence here.\nEOF",
  'git commit -m "feat(invoicing): echo > file is a message"',
  'git checkout -b build/invoicing-2',
  'git checkout main',
  'git checkout -- src/contexts/invoicing/CONTEXT.md',
  'git restore src/contexts/invoicing/CONTEXT.md',
  'git restore --staged package.json',
  'git rm src/contexts/invoicing/domain/draft.ts',
  'git mv src/contexts/invoicing/a.ts src/contexts/invoicing/b.ts',
  'git clean -n',
  'git apply --check invoicing.patch',
  'cat src/contexts/invoicing/CONTEXT.md',
  'grep -rn Invoice src/contexts | head',
  'sed -n 1,20p src/platform/composition/compose-application.ts',
  'echo "notes" > "$TMPDIR/notes.txt"',
  'rm src/contexts/invoicing/domain/draft.notes.md',
  'rm -f .ddd-ts-kit/report.md',
  'cp src/contexts/invoicing/domain/invoice.ts "$TMPDIR/invoice.ts"',
  'mv src/contexts/invoicing/a.ts src/contexts/invoicing/b.ts',
  'touch src/contexts/invoicing/domain/payment.notes.md',
  'find src/contexts/invoicing -name "*.orig" -delete',
  'node scripts/report.mjs',
  'node --version',
  'python3 -m json.tool package.json',
  'npx --no -- biome format src/contexts/invoicing',
  'npx @biomejs/biome format src/contexts/invoicing',
  'sed -i "s/a/b/" src/contexts/invoicing/CONTEXT.md',
  "sed -ne 's/a/b/p' -i src/contexts/invoicing/CONTEXT.md",
  'echo x >> src/contexts/invoicing/CONTEXT.md',
  "cat > src/contexts/invoicing/domain/notes.md <<'EOF'\nA note.\nEOF",
  'echo x | tee src/contexts/invoicing/domain/notes.md',
  'perl -pe \'s/a/b/\' src/main.ts > "$TMPDIR/main.ts"',
  "python3 -c \"open('src/contexts/invoicing/CONTEXT.md', 'a').write('')\"",
  "node - <<'EOF'\nconsole.log(1)\nEOF",
  'python3 <<EOF\nprint(1)\nEOF',
  'cat build.js | node',
  'deno eval "console.log(1)"',
  'npx --version',
  'npx ddd-ts-kit --version',
  'npx ddd-ts-kit generate command invoicing IssueInvoice --public',
  'git -C',
];

const WORKER_COMMANDS_REFUSED = [
  ["sed -i.bak -e 's/a/b/' src/main.ts", /`sed -i` editing src\/main\.ts: You build the context/],
  ['perl -pi -e "s/a/b/" src/main.ts', /`perl -i` editing src\/main\.ts/],
  ["perl -i -pe 's/a/b/' package.json", /`perl -i` editing package\.json/],
  ['echo x > src/main.ts', /the redirection `> src\/main\.ts`/],
  ['npm test &> test-output.log', /redirection `&> test-output\.log`/],
  ["cat > src/platform/extra.ts <<'EOF'\nexport const a = 1;\nEOF", /redirection `> src\/platform\/extra\.ts`/],
  ['echo x > "$OUT"', /redirection `> \$OUT`/],
  ['echo x | tee src/main.ts', /`tee` writing src\/main\.ts/],
  ['echo x | tee -a docs/notes.md', /`tee` writing docs\/notes\.md/],
  ['cp "$TMPDIR/x.ts" src/platform/x.ts', /outside its scope: `cp` changes src\/platform\/x\.ts/],
  ['mv src/contexts/invoicing/a.ts src/platform/a.ts', /`mv` changes src\/platform\/a\.ts/],
  ['mv src/platform/a.ts src/contexts/invoicing/a.ts', /`mv` changes src\/platform\/a\.ts/],
  ['rm -rf src/contexts/catalog', /`rm` changes src\/contexts\/catalog/],
  ['rm package-lock.json', /`rm` changes package-lock\.json/],
  ['rm "$FILE"', /files only the shell knows/],
  ['touch src/platform/new.ts', /`touch`/],
  ['truncate -s 0 src/main.ts', /`truncate`/],
  ['dd if=/dev/zero of=src/main.ts count=1', /`dd` changes src\/main\.ts/],
  ['install -m 644 notes.txt src/platform/notes.txt', /`install`/],
  ['ln -sf ../x src/platform/link.ts', /`ln`/],
  ['git checkout -- src/main.ts', /`git checkout` changes src\/main\.ts/],
  ['git checkout main -- package.json', /`git checkout` changes package\.json/],
  ['git checkout .', /the whole project/],
  ['git restore src/main.ts', /`git restore`/],
  ['git -C src restore main.ts', /`git restore` changes src\/main\.ts/],
  ['git rm src/platform/composition/compose-application.ts', /`git rm`/],
  ['git mv src/main.ts src/contexts/invoicing/main.ts', /`git mv` changes src\/main\.ts/],
  ['git clean -fd', /`git clean` changes the whole project/],
  ['git apply invoicing.patch', /`git apply`/],
  ['patch -p1 < invoicing.patch', /`patch`/],
  ['find . -name "*.orig" -delete', /`find -delete` changes files anywhere in the project/],
  ['find src -name "*.orig" -exec rm {} \\;', /`rm` changes files under src/],
  ['find src -name "*.ts" -exec sed -i "s/a/b/" {} +', /`sed -i` editing/],
  ['ls src | xargs rm', /`rm` changes files only the shell knows/],
  ['bash -c "echo x > src/main.ts"', /redirection/],
  ["sh -c 'rm src/main.ts'", /`rm` changes src\/main\.ts/],
  ['eval "rm src/main.ts"', /`rm`/],
  ['echo $(rm src/main.ts)', /`rm`/],
  ['cd src && rm main.ts', /`rm` changes src\/main\.ts/],
  ['pushd src && rm main.ts', /`rm` changes src\/main\.ts/],
  ['pushd src && popd && rm src/main.ts', /`rm` changes src\/main\.ts/],
  ['pushd src && popd && popd && rm main.ts', /`rm` changes files only the shell knows/],
  ['FORCE=1 rm src/main.ts', /`rm`/],
  ['sudo rm src/main.ts', /`rm`/],
  ['npx prettier --write src', /not the formatter of this project.*npm run format/],
  ['npx biome format --write .', /without `--no`.*npm run format/],
  ['npx -y biome@2 check .', /without `--no`/],
  ['pnpm dlx prettier --check .', /npm run format/],
  ['npx -p prettier prettier --write src', /not the formatter of this project/],
  ['find -name "*.orig" -delete', /`find -delete` changes files anywhere in the project/],
  ['mv -t src/platform src/contexts/invoicing/a.ts', /`mv` changes src\/platform/],
  ['cp -t src/platform src/contexts/invoicing/a.ts', /`cp` changes src\/platform/],
  ['cp --target-directory=src/platform src/contexts/invoicing/a.ts', /`cp` changes src\/platform/],
  ['git clean -f src/platform', /`git clean` changes src\/platform/],
  ['git -c core.autocrlf=false checkout -- src/main.ts', /`git checkout` changes src\/main\.ts/],
  ['git --no-pager rm src/main.ts', /`git rm` changes src\/main\.ts/],
  [
    'npx ddd-ts-kit generate command invoicing IssueInvoice --aggregate=Invoice --public',
    /would also create the repository of Invoice/,
  ],
];

test('a context worker changes no file outside its scope, by any tool: the table of its Bash commands', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of WORKER_COMMANDS_ALLOWED) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  for (const [command, expected] of WORKER_COMMANDS_REFUSED) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  const redirected = reason(run('pre-bash', bash(root, 'echo x > src/main.ts', agent)));
  assert.match(redirected, /You build the context "invoicing"/);
  assert.match(redirected, /system temp directory stays free/);
});

// Writers the cp and mv tables do not know, each landing a file of src/main.ts or the platform.
const UNKNOWN_WRITERS = [
  ['echo x >&src/main.ts', /You build the context "invoicing"/],
  ["sed 'w src/main.ts' README.md", /sed script that writes a file/],
  ["sed -n '1w src/main.ts' README.md", /sed script that writes a file/],
  ['awk \'BEGIN{print "x" > "src/main.ts"}\'', /awk program that writes/],
  ['gawk -i inplace "{print}" src/main.ts', /awk program that writes/],
  ['ruby -i -pe 1 src/main.ts', /`ruby -i` editing src\/main\.ts/],
  ['vim -es -c "w src/main.ts" -c q', /`vim` changes/],
  ['ed -s src/main.ts', /`ed` changes src\/main\.ts/],
  ['rsync a src/main.ts', /`rsync` changes src\/main\.ts/],
  ['curl -o src/main.ts https://example.test/x', /`curl` changes src\/main\.ts/],
  ['curl -O https://example.test/src.ts', /curl -O/],
  ['wget -O src/main.ts https://example.test/x', /`wget` changes src\/main\.ts/],
  ['wget -P src/platform https://example.test/x', /`wget` changes src\/platform/],
  ['wget -O', /files only the shell knows/],
  ['tar -xf /tmp/x.tar', /`tar` changes files only the shell knows/],
  ['unzip -o /tmp/x.zip', /`unzip` changes files only the shell knows/],
  ['find src -fprint src/main.ts', /`find fprint` changes src\/main\.ts/],
  ['git diff --output=src/main.ts', /`git diff` changes src\/main\.ts/],
  ['git diff -o', /`git diff` changes files only the shell knows/],
  ['git format-patch -o src/platform HEAD~1', /`git format-patch` changes src\/platform/],
  ['git stash', /`git stash` changes the whole project/],
  ['git stash -u', /`git stash` changes the whole project/],
  ['git checkout -f', /`git checkout` changes the whole project/],
  ['git checkout --pathspec-from-file=list HEAD~1', /`git checkout` changes files only the shell knows/],
  ['git reset --hard HEAD~1', /`git reset` changes the whole project/],
  ['git switch -f main', /`git switch` changes the whole project/],
  ['git read-tree -u --reset HEAD', /`git read-tree` changes the whole project/],
  ['git checkout-index -f -a', /`git checkout-index` changes the whole project/],
  ['git worktree add .worktrees/evil', /`git worktree` changes \.worktrees\/evil/],
  ['git worktree add', /`git worktree` changes the whole project/],
  ['git checkout-index --all', /`git checkout-index` changes the whole project/],
  ['git commit -am x', /`git commit` changes the whole project/],
  ['npx eslint --fix src/main.ts', /`eslint` changes src\/main\.ts/],
  ['npx --no -- biome format --write src/main.ts', /`biome` changes src\/main\.ts/],
  ['npx vitest run --outputFile=src/main.ts', /`vitest` changes src\/main\.ts/],
  ['npx vitest run --outputFile', /`vitest` changes files only the shell knows/],
  ['npx ddd-ts-kit init --force', /init --force/],
  ['npx ddd-ts-kit depcruise-config --write', /depcruise-config --write/],
];

const UNKNOWN_WRITERS_ALLOWED = [
  'npx eslint src/contexts/invoicing/domain',
  'npx eslint --fix src/contexts/invoicing/domain',
  'awk "NR == 1" README.md',
  'tar -tf /tmp/x.tar',
  'unzip -l /tmp/x.zip',
  'rsync src/contexts/invoicing/a.ts',
  'git stash list',
  'git diff --stat main',
];

// A formatter or a linter that writes inside the scope: its subcommand and the values of its options are not paths.
const IN_SCOPE_FORMATS = [
  'npx --no -- biome format --write src/contexts/invoicing/x.ts',
  'npx --no -- biome check --write --config-path biome.json src/contexts/invoicing/domain',
  'npx eslint --fix --ext .ts -c eslint.config.js src/contexts/invoicing/domain',
];

test('a worker formats and lints its own files: only the paths a formatter is given are judged', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const command of IN_SCOPE_FORMATS) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
  const outside = run('pre-bash', bash(root, 'npx eslint --fix -c eslint.config.js src/main.ts', agent));
  assert.match(reason(outside), /`eslint` changes src\/main\.ts/);
});

test('a worker is refused the writers the tables do not know: redirections, sed, awk, editors, downloads, git, runners', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  for (const [command, expected] of UNKNOWN_WRITERS) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  for (const command of UNKNOWN_WRITERS_ALLOWED) {
    assert.equal(run('pre-bash', bash(root, command, agent)).output, undefined, command);
  }
});

test('a domain-test-writer is held to test paths by the shell, as it is by the editor tools', () => {
  const root = project();
  const agent = { agent_type: 'ddd-ts-kit:domain-test-writer' };
  const refused = run('pre-bash', bash(root, 'echo x > src/contexts/ordering/domain/order.ts', agent));
  assert.equal(decision(refused), 'deny');
  assert.match(reason(refused), /test writer changes tests only/);
  const spec = 'echo x > src/contexts/ordering/test/unit/order.spec.ts';
  assert.equal(run('pre-bash', bash(root, spec, agent)).output, undefined);
});

test('the main session does not hand-write a generated file or the baseline through the shell', () => {
  const root = project();
  for (const [command, expected] of [
    ['cat > openapi/openapi.yaml', /openapi\/openapi\.yaml is generated/],
    ['printf x > ddd-ts-kit-baseline.json', /ddd-ts-kit-baseline\.json/],
  ]) {
    const result = run('pre-bash', bash(root, command));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  // Writing a context file by hand from the main session, outside any story, stays allowed.
  assert.equal(run('pre-bash', bash(root, 'echo x > src/contexts/ordering/domain/order.ts')).output, undefined);
});

test('a worker writes only inside its worktree, the devices and the temp directory, nowhere else', () => {
  const root = project({}, ['--package-manager', 'npm']);
  const agent = worker(root, 'invoicing');
  const refused = [
    ['echo x > ~/.ddd-ts-kit-test', /outside your worktree/],
    ['echo x > /etc/ddd-ts-kit-test', /outside your worktree/],
    ['cp src/contexts/invoicing/a.ts ~/x', /`cp` changes/],
  ];
  for (const [command, expected] of refused) {
    const result = run('pre-bash', bash(root, command, agent));
    assert.equal(decision(result), 'deny', command);
    assert.match(reason(result), expected, command);
  }
  for (const free of ['echo x > "$TMPDIR/n.txt"', 'echo x > /dev/null', 'echo x >> /dev/stderr']) {
    assert.equal(run('pre-bash', bash(root, free, agent)).output, undefined, free);
  }
});

test('inline code of a worker runs, and what it changed outside the scope stops the worker until put back', () => {
  const root = committed();
  const agent = { ...worker(root, 'ordering'), session_id: 'inline', agent_id: 'builder-1' };
  const inline = "python3 - <<'EOF'\nprint(1)\nEOF";

  // Inside its scope: nothing to put back.
  assert.equal(run('pre-bash', bash(root, inline, agent)).output, undefined);
  put(root, 'src/contexts/ordering/domain/notes.md', 'a note');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);

  // Outside: a changed shared file and a new one stop the next command and the next write.
  assert.equal(run('pre-bash', bash(root, inline, agent)).output, undefined);
  writeFileSync(join(root, 'package.json'), '{}\n');
  put(root, 'src/platform/extra.ts', 'export const extra = 1;\n');
  const stopped = run('pre-bash', bash(root, 'npm test', agent));
  assert.equal(decision(stopped), 'deny');
  assert.match(reason(stopped), /changed files outside your scope: package\.json, src\/platform\/extra\.ts/);
  assert.match(reason(stopped), /`git restore -- package\.json`, then `rm src\/platform\/extra\.ts`/);
  assert.equal(decision(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent))), 'deny');

  // Putting back exactly those files is allowed; anything else stays refused until it is done.
  assert.equal(run('pre-bash', bash(root, 'git restore -- package.json', agent)).output, undefined);
  assert.equal(decision(run('pre-bash', bash(root, 'git restore -- README.md', agent))), 'deny');
  git(root, 'restore', '--', 'package.json');
  assert.equal(run('pre-bash', bash(root, 'rm src/platform/extra.ts', agent)).output, undefined);
  rmSync(join(root, 'src/platform/extra.ts'));
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
  assert.equal(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent)).output, undefined);
});

test('what regenerate rewrites outside the scope, run by verify-slice inside inline code, does not stop the worker', () => {
  const root = committed();
  const agent = { ...worker(root, 'ordering'), session_id: 'inline', agent_id: 'builder-2' };
  const inline = "python3 - <<'EOF'\nprint(1)\nEOF";

  put(root, 'clients/api/src/index.ts', 'export const first = 1;\n');
  git(root, 'add', '.');
  git(root, 'commit', '--quiet', '--message', 'chore: client');

  // verify-slice piped into inline code: regenerate rewrites the client and the pages meanwhile.
  assert.equal(run('pre-bash', bash(root, inline, agent)).output, undefined);
  put(root, 'clients/api/src/index.ts', 'export const first = 2;\n');
  put(root, 'docs/behaviour/application.md', '# Behaviour\n');
  put(root, 'docs/context-map.md', '# Map\n');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);

  // A shared file that is not derived still stops the worker.
  assert.equal(run('pre-bash', bash(root, inline, agent)).output, undefined);
  put(root, 'src/platform/extra.ts', 'export const extra = 1;\n');
  assert.match(
    reason(run('pre-bash', bash(root, 'npm test', agent))),
    /changed files outside your scope: src\/platform\/extra\.ts/,
  );
});

// Inline code of a worker: what it changes cannot be read in advance, only after it ran.
const INLINE_CODE = "python3 - <<'EOF'\nprint(1)\nEOF";

test('in advise mode, what the inline code of a worker changed outside its scope is put to the user', () => {
  const root = committed({ guard: 'advise' });
  const agent = { ...worker(root, 'ordering'), session_id: 'inline', agent_id: 'builder-advised' };
  assert.equal(run('pre-bash', bash(root, INLINE_CODE, agent)).output, undefined);
  writeFileSync(join(root, 'package.json'), '{}\n');
  assert.equal(decision(run('pre-bash', bash(root, 'npm test', agent))), 'ask');
  assert.equal(decision(run('pre-write', write(join(root, 'src/contexts/ordering/CONTEXT.md'), agent))), 'ask');
});

test('a shared file already changed before the inline code ran must get back the content it had then', () => {
  const root = committed();
  const agent = { ...worker(root, 'ordering'), session_id: 'inline', agent_id: 'builder-3' };
  writeFileSync(join(root, 'README.md'), 'Changed by the conductor.\n');
  assert.equal(run('pre-bash', bash(root, INLINE_CODE, agent)).output, undefined);
  rmSync(join(root, 'README.md'));
  assert.match(
    reason(run('pre-bash', bash(root, 'npm test', agent))),
    /changed files outside your scope: README\.md\./,
  );
  writeFileSync(join(root, 'README.md'), 'Changed by the conductor.\n');
  assert.equal(run('pre-bash', bash(root, 'npm test', agent)).output, undefined);
});

test('a file the inline code of a worker renamed outside its scope stops it under its new name', () => {
  const root = committed();
  const agent = { ...worker(root, 'ordering'), session_id: 'inline', agent_id: 'builder-4' };
  assert.equal(run('pre-bash', bash(root, INLINE_CODE, agent)).output, undefined);
  git(root, 'mv', 'README.md', 'README.old.md');
  assert.match(
    reason(run('pre-bash', bash(root, 'npm test', agent))),
    /changed files outside your scope: README\.old\.md\./,
  );
});

test('a context worker never changes a file of another checkout, by a redirection or a copy', () => {
  const root = project();
  const other = project();
  const agent = worker(root);
  const redirected = run('pre-bash', bash(root, `echo x > ${other}/src/main.ts`, agent));
  assert.match(reason(redirected), new RegExp(`writes ${other}/src/main\\.ts, in another checkout`));
  const copied = run('pre-bash', bash(root, `cp src/main.ts ${other}/src/main.ts`, agent));
  assert.match(reason(copied), new RegExp(`\`cp\` changes ${other}/src/main\\.ts\\.`));
});

test('inline code of the conductor is not watched', () => {
  const root = committed();
  worker(root, 'ordering');
  const conductor = { session_id: 'inline', agent_id: undefined };
  assert.equal(
    run('pre-bash', bash(root, "node -e \"require('fs').writeFileSync('package.json', '{}')\"", conductor)).output,
    undefined,
  );
  writeFileSync(join(root, 'package.json'), '{}\n');
  assert.equal(run('pre-bash', bash(root, 'npm test', conductor)).output, undefined);
});

test('the conductor and the other agents are not held to the scope of a worker', () => {
  const root = project({}, ['--package-manager', 'npm']);
  worker(root, 'invoicing');
  const reviewer = { agent_type: 'ddd-ts-kit:architecture-reviewer' };
  for (const [command] of WORKER_COMMANDS_REFUSED) {
    assert.equal(run('pre-bash', bash(root, command)).output, undefined, command);
    assert.equal(run('pre-bash', bash(root, command, reviewer)).output, undefined, command);
  }
});

test('the worktree of a worker is found in its command, and other agents run anything', () => {
  const root = project();
  const agent = worker(root);
  const elsewhere = directory('session');
  const command = 'npx ddd-ts-kit generate repository ordering Order';
  assert.equal(decision(run('pre-bash', bash(elsewhere, `cd ${root} && ${command}`, agent))), 'deny');
  assert.equal(decision(run('pre-bash', bash(elsewhere, `${command} --cwd ${root}`, agent))), 'deny');
  assert.equal(run('pre-bash', bash(elsewhere, command, agent)).output, undefined);
  assert.equal(run('pre-bash', bash(root, command)).output, undefined);
  assert.equal(run('pre-bash', { cwd: root, tool_name: 'Bash', tool_input: {}, ...agent }).output, undefined);
});

test('a context-builder is held to run every command as cd <worktree> && ..., not from the conductor', () => {
  const { conductor, worktree } = conductorWithWorker();
  const agent = { agent_type: 'ddd-ts-kit:context-builder' };
  const stray = [
    `echo x > ${worktree}/src/main.ts`,
    `echo x > ${worktree}/src/contexts/ordering/x.ts`,
    `true && cd ${worktree} && echo x > src/main.ts`,
    `cd ${worktree} || exit 1; echo x > src/main.ts`,
    `git -C ${worktree} checkout -- src/main.ts`,
    `(cd ${worktree} && npx ddd-ts-kit generate aggregate ordering Order)`,
  ];
  for (const command of stray) {
    assert.equal(decision(run('pre-bash', bash(conductor, command, agent))), 'deny', command);
  }
  assert.match(reason(run('pre-bash', bash(conductor, stray[0], agent))), /cd <worktree> && /);
  // The reference shape reaches the scope of the worktree, which refuses the write by its context.
  const reference = run('pre-bash', bash(conductor, `cd ${worktree} && echo x > src/main.ts`, agent));
  assert.equal(decision(reference), 'deny');
  assert.match(reason(reference), /You build the context "billing"/);
  // A read from the conductor, moving into no worktree, is left alone.
  const read = bash(conductor, `cat ${worktree}/src/contexts/billing/CONTEXT.md`, agent);
  assert.equal(run('pre-bash', read).output, undefined);
});

test('a generator after cd <dir>; is judged where the session stands, not in the worktree', () => {
  const { conductor, worktree } = conductorWithWorker();
  const agent = { agent_type: 'ddd-ts-kit:context-builder' };
  // `cd <worktree> && ...` reaches the scope of the worktree, which allows a generator of its context.
  const moved = run(
    'pre-bash',
    bash(conductor, `cd ${worktree} && npx ddd-ts-kit generate value-object billing Money`, agent),
  );
  assert.equal(moved.output, undefined);
  // `cd <worktree>;` does not move the reader: the generator is judged from the conductor's checkout.
  const strayed = run(
    'pre-bash',
    bash(conductor, `cd ${worktree}; npx ddd-ts-kit generate value-object billing Money`, agent),
  );
  assert.equal(decision(strayed), 'deny');
  assert.match(reason(strayed), /main checkout of the trunk/);
});

test('a command that first moves out of every project is still judged, against the session', () => {
  const { conductor, worktree } = conductorWithWorker();
  const builder = { agent_type: 'ddd-ts-kit:context-builder' };
  for (const command of [`cd /tmp && rm -rf ${worktree}/src`, `cd / && git -C ${conductor} stash`]) {
    assert.equal(decision(run('pre-bash', bash(conductor, command, builder))), 'deny', command);
  }
  const root = project();
  const agent = worker(root);
  const away = run('pre-bash', bash(root, `cd / && rm ${root}/src/main.ts`, agent));
  assert.match(reason(away), /`rm` changes src\/main\.ts/);
});

test('a builder that runs a generator from the conductor, under advised worktrees, is told to cd into its worktree', () => {
  const { conductor } = conductorWithWorker();
  patchConfig(conductor, { worktrees: 'advised' });
  const builder = { agent_type: 'ddd-ts-kit:context-builder' };
  const generated = run('pre-bash', bash(conductor, 'npx ddd-ts-kit generate value-object billing Money', builder));
  assert.equal(decision(generated), 'deny');
  assert.match(reason(generated), /cd <worktree> && /);
  const dry = bash(conductor, 'npx ddd-ts-kit generate value-object billing Money --dry-run', builder);
  assert.equal(run('pre-bash', dry).output, undefined);
});

// A conductor's checkout on the trunk, a real git worktree under .worktrees/ with a worker scope,
// its own install so Node does not borrow the trunk's packages.
function conductorWithWorker() {
  const conductor = project();
  writeFileSync(join(conductor, '.gitignore'), 'node_modules\n.worktrees/\n');
  git(conductor, 'init', '--quiet', '--initial-branch', 'main');
  git(conductor, 'add', '--all');
  git(conductor, 'commit', '--quiet', '--no-verify', '--message', 'chore: bootstrap');
  const worktree = join(conductor, '.worktrees', 'billing');
  git(conductor, 'worktree', 'add', '--quiet', '-b', 'work/billing', worktree);
  launcher(worktree);
  put(worktree, '.ddd-ts-kit/worker.json', JSON.stringify({ context: 'billing' }));
  return { conductor, worktree };
}
