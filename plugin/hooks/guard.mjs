#!/usr/bin/env node
// Fails open by design: a guard that breaks must never block the work it guards.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  globSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { linkedFolder, removeKitFile, writeKitFile } from './kit-files.mjs';

const CONFIG = 'ddd-ts-kit.config.json';
// The most of the config the guard reads: a larger one is not read, and the guard judges nothing there.
const CONFIG_BYTES = 256 * 1024;
// The version of the packages the skills of this plugin describe. `release-version.mjs` keeps it
// the version of the kit: setting a new version of the packages rewrites it.
const KIT_VERSION = '0.104.0';
const PLAN = 'docs/architecture/plan.md';
const WORKER_SCOPE = '.ddd-ts-kit/worker.json';
// The worktree of a story one session takes to its pull request; its code waits for the build gate.
const STORY_SCOPE = '.ddd-ts-kit/story.json';
// The names `find` may find a scope file by: the files and the kit's folder that holds them.
const SCOPE_NAMES = ['story.json', 'worker.json', '.ddd-ts-kit'];
// Where the worktrees of a project live, inside it, ignored by git and by every tool.
const WORKTREES_DIR = '.worktrees';
// How long the guard keeps what `stories --json` said before reading it again.
const STORIES_TTL = 60_000;
// A fetch older than this leaves the trunk of a story behind the remote one: the session is told to fetch.
const STALE_FETCH = 3_600_000;
// The files a merge of two stories settles by their kind: no story is warned of them.
const SETTLED_BY_MERGE =
  /(^|\/)(docs\/architecture\/slices\.md|package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lock|stored-events\.lock\.json)$/;
// What the build gate of a story reads: when none of them changed, a gate once met stays met.
const STORY_INPUTS = [
  'docs/architecture/slices.md',
  'docs/architecture/stories',
  'docs/architecture/reviews',
  'test/acceptance',
];
// The report a worker keeps current after each commit and before it ends, ignored by git: what the conductor reads when it stops.
const WORKER_REPORT = '.ddd-ts-kit/report.md';
const WORKER_AGENT = 'context-builder';
// The builder of the plugin, as its hooks of SubagentStart and SubagentStop match it: the one counted.
const BUILDER_AGENT = `ddd-ts-kit:${WORKER_AGENT}`;
// What the config may say of the guard; anything else is read as enforce.
const GUARD_MODES = ['off', 'advise', 'enforce'];
// The host caps SessionStart context at 10 000 characters; a session should start far below it.
const SESSION_CONTEXT_LIMIT = 3000;
// What the guard says of a text read from the repository, the plan line or a next step: at most this many characters.
const QUOTED_LIMIT = 300;
// The grammars of the names read from the repository that the guard repeats: anything else is not repeated.
const STORY_ID = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const CONTEXT_NAME = /^[a-z][a-z0-9-]*$/;
const GIT_REF = /^(?!-)[\p{L}\p{N}_./-]+$/u;
// A space is allowed (a project under "My Projects"); a quote, a backquote, a dollar or a backslash is not.
const ABSOLUTE_PATH = /^\/[\p{L}\p{N} _@%+=:,./-]*$/u;
const LABEL = /^[a-z][a-z -]*$/;
const AGENT_ID = /^[\w-]+$/;
const COMMIT_DEFAULTS = { maxFiles: 20, maxLines: 600 };
const COUNTED_FILE_BYTES = 1_000_000;
// The files Biome formats: with `formatOnWrite` in the config, the project's own Biome lays one out as it is written.
const FORMATTED_FILE = /\.(?:[cm]?[jt]sx?|jsonc?)$/;
const FORMAT_TIMEOUT = 5000;
// The tests of the guard shrink its time limits with DDD_TS_KIT_GUARD_TIME_SCALE (a fiftieth) to reach
// them with a CLI that sleeps; a user has no reason to set it.
const TIME_SCALE = timeScale(process.env.DDD_TS_KIT_GUARD_TIME_SCALE);
// What a session start gives the CLI in all, of the 15 s of its hook: past it, the calls left are skipped.
const BRIEFING_BUDGET = 10_000;
const BRIEFING_CUT =
  'Briefing cut short: the CLI did not answer in time; `npx ddd-ts-kit status` and `npx ddd-ts-kit list` say the rest.';
// The written files one call of post-write checks, of the 15 s of its hook: a patch of Codex can hold many.
const POST_WRITE_FILES = 5;
// The written files one call of pre-write has the CLI judge before they land, of the 5 s of its hook.
const CLI_WRITE_FILES = 2;

// The contracts in YAML or JSON (openapi/<document>, the form of a route in openapi/forms/, the
// AsyncAPI document), the event catalog and the split of the contract that `ddd-ts-kit docs`
// writes in the platform. The settings of the project only ask before an edit of them: a deny
// rule there would make them read-only to `docs:generate` too, under the sandbox of Claude Code.
const GENERATED_DOCUMENT =
  /^(?:openapi\/(?:forms\/)?[^/]+|docs\/integration\/asyncapi)\.(?:ya?ml|json)$|^docs\/integration\/event-catalog\.md$|(?:^|\/)http\/openapi-documents\.ts$/;
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
// Rewritten by a command: counted in no commit size, merged by regenerating.
const DERIVED_FILES = [...LOCKFILES, '.dependency-cruiser.cjs', 'docs/context-map.md'];
// What `npm run regenerate` rewrites outside every context (the CLI's `isDerived`): the contracts
// and the documents derived from them, the clients of an SDK, the pages of what the tests state,
// the context map and the dependency rules. A worker runs it through `verify-slice`.
const REGENERATED_FILES =
  /^(?:openapi|docs\/integration|docs\/behaviour|clients)\/|^docs\/context-map\.md$|^\.dependency-cruiser\.cjs$/;

const GENERATORS = [
  [/\.aggregate\.ts$/, 'aggregate <context> <Name>'],
  [/\.entity\.ts$/, 'entity <context> <Name>'],
  [/\.vo\.ts$/, 'value-object <context> <Name>'],
  [/\.vocabulary\.ts$/, 'vocabulary <context> <Name> --value <value>...'],
  [/\.event\.ts$/, 'domain-event <context> <Aggregate> <Fact>'],
  [
    /\.error\.ts$/,
    'error <context> <Refusal> <factory> (under "stack.refusals": "factories": error <context> <Concept> <refusal>)',
  ],
  // At the level of the context, or in a module of its model (<module>/domain/services/).
  [/\/domain\/(?:[^/]+\/)?services\/[^/]+\.service\.ts$/, 'domain-service <context> <Name>'],
  [/\/domain\/(?:[^/]+\/)?repositories\/[^/]+\.repository\.ts$/, 'repository <context> <Aggregate>'],
  [/\.command\.ts$/, 'command <context> <UseCase> (--permission <aggregate>.<action> [--grant <role>] | --public)'],
  [/\.query\.ts$/, 'query <context> <UseCase> (--permission <aggregate>.<action> [--grant <role>] | --public)'],
  [
    /\.handler\.ts$/,
    'command|query <context> <UseCase> (--permission <aggregate>.<action> [--grant <role>] | --public)',
  ],
  [/\.port\.ts$/, 'port <context> <Name>'],
  [/\.policy\.ts$/, 'policy <context> <Name> --permission <aggregate>.<action>'],
  [/\.event-handler\.ts$/, 'event-handler <context> <Aggregate> <Fact>'],
  [
    /\.job\.ts$/,
    'job <context> <Name> (--every <duration> | --cron "<expression>" [--time-zone <zone>]) --command <UseCase>',
  ],
  [/\.publisher\.ts$/, 'integration-event <context> <Aggregate> <Fact>'],
  [/\.integration-event\.ts$/, 'integration-event <context> <Aggregate> <Fact>'],
  [/\.integration-handler\.ts$/, 'integration-handler <context> <upstream> <event-type>'],
  [/\.gateway\.ts$/, 'gateway <context> <upstream> <Name>'],
  [/\.adapter\.ts$/, 'adapter <context> <Port> [--kind external|gateway] [--decorators]'],
  [/\/infrastructure\/anti-corruption\/[^/]+\.translator\.ts$/, 'acl <context> <upstreamOrSystemName>'],
  [/\.route\.ts$/, 'route <context> <UseCase> --method <M> --path <p>'],
  [/\.builder\.ts$/, 'builder <context> <Aggregate>'],
  [/\.e2e\.spec\.ts$/, 'e2e <context> <UseCase>'],
  [/\.acceptance\.spec\.ts$/, 'acceptance <story>'],
];

// A policy file decides on one element. The requires(...) of the use cases are not policies: the
// generator of a command or a query writes them, in the module file of the module it is given.
const POLICY_FILE = /\.policy\.ts$/;
const DECLARATIONS_HOME =
  ' A policy decides on one element. The requires(...) declarations of the use cases are not a policy: `generate command|query ... --module <module>` writes them in <module>/<module>.module.ts, never in a file of application/authorization/. When the module file of the context is too long to take one, the module does not exist yet: report it to the conductor, who creates it with `generate module <context> <module>`.';

// The acceptance of a story and its lock: a sub-agent only unwraps a scenario its rows now satisfy.
const ACCEPTANCE_SPEC = /^test\/acceptance\/[^/]+\.acceptance\.spec\.ts$/;
const ACCEPTANCE_LOCK = /^test\/acceptance\/[^/]+\.acceptance\.lock\.json$/;
// The verdicts that let a locked acceptance change: written by the acceptance-judge agent alone.
const ACCEPTANCE_VERDICT = /^test\/acceptance\/verdicts\/[^/]+\.md$/;
const JUDGE_AGENT = 'acceptance-judge';
// What a command may do with the lock or a verdict outside the judge: read it, or run the kit
// (`ddd-ts-kit` directly, or `npx ddd-ts-kit` seen through kitInvocations); `npx`/`pnpm` of anything
// else can write, and `git` reads only through the subcommands of GIT_READS.
const READING_PROGRAMS = new Set(['cat', 'ls', 'head', 'tail', 'grep', 'wc', 'diff', 'jq', 'ddd-ts-kit']);
const GIT_READS = new Set(['log', 'show', 'diff', 'status', 'add', 'commit', 'ls-files']);
// What touches no file: a command line moves to a worktree or checks a path before it reads or versions one.
const NEUTRAL_PROGRAMS = new Set(['cd', 'pushd', 'popd', 'pwd', 'true', 'test', '[']);
// awk reads, unless its program comes from a file or may write (`print > "f"`, a pipe, `system`, `@include`).
const AWK_PROGRAMS = new Set(['awk', 'gawk', 'mawk', 'nawk']);
// What a command may also do with the locked regression spec of a fix: run it, however the runner is launched.
const RUNNING_PROGRAMS = new Set(['npm', 'yarn', 'bun', 'bunx', 'node', 'vitest', 'jest']);
// A test or a spec, inside a context: the proof of a fix is written there before its code.
const TEST_DIRECTORY = /(^|\/)test\//;
const SPEC_FILE = /\.spec\.ts$/;

// A journey crosses use cases, and often contexts: no single route generates it, so it is written by hand.
const JOURNEY = /^test\/e2e\/journey-[^/]+\.e2e\.spec\.ts$/;
// An end-to-end spec at the top of test/e2e/: the one of a use case, a part of it, or a journey.
const E2E_SPEC = /^test\/e2e\/([^/]+)\.e2e\.spec\.ts$/;

// Changing these is a decision about the rules themselves: the project owner confirms it.
const GOVERNED_FILES = [
  /^ddd-ts-kit\.config\.json$/,
  /^eslint\.config\.[cm]?js$/,
  /^biome\.jsonc?$/,
  /^knip\.json$/,
  /^lefthook\.yml$/,
  /^commitlint\.config\.[cm]?js$/,
  /^tsconfig(\.[a-z]+)?\.json$/,
  /^(vitest|jest)(\.e2e)?\.config\.[cm]?[jt]s$/,
  /^\.gitlab-ci\.yml$/,
  /^\.gitlab\//,
  /^\.github\/(workflows|actions|scripts)\//,
  /^\.github\/dependabot\.ya?ml$/,
  /^renovate\.json$/,
  /^stryker\.config\.[cm]?js$/,
  /^pnpm-workspace\.yaml$/,
  /^\.claude\/hooks\//,
  /^REVIEW\.md$/,
  /^\.claude\/settings\.json$/,
  /^\.claude\/rules\//,
  /^\.github\/instructions\//,
  /^\.github\/copilot\/settings\.json$/,
  /^\.github\/hooks\//,
  /^\.codex\//,
];

// The errors a codebase had when it adopted the kit: written by the project owner, lowered by `check --baseline prune`.
const BASELINE_FILE = /^ddd-ts-kit-baseline\.json$/;
const BASELINE_OWNER =
  'it is written by the project owner, in a terminal, when the project adopts the kit; an agent never writes it, since one command would silence every error of the moment, its own included. `npx ddd-ts-kit check --baseline prune` lowers it after a fix and follows a `git mv`, without asking. Fix the error instead.';

// The rules of dependency between layers and contexts: what a new import breaks, judged on its own lines.
const DEPENDENCY_RULES = [
  'layer/domain-purity',
  'layer/application-inward',
  'layer/infrastructure-no-presentation',
  'layer/presentation-no-infrastructure',
  'context/published-language-only',
];

const ESCAPES = [
  [/ddd-ts-kit-disable/g, 'an architecture rule suppression'],
  [/eslint-disable/g, 'a lint suppression'],
  [/@ts-(ignore|nocheck|expect-error)/g, 'a compiler diagnostic suppression'],
  [/\b(it|test|describe)\.(skip|only)\b/g, 'a skipped or focused test'],
  [/\bas any\b/g, 'an `any` assertion'],
];

// The roles of the shared kernel a generator writes, at its root: `generate <kind> shared-kernel ...`.
const SHARED_KERNEL_GENERATORS = [
  [/\.vo\.ts$/, 'value-object shared-kernel <Name>'],
  [
    /\.error\.ts$/,
    'error shared-kernel <Refusal> <factory> (under "stack.refusals": "classes": domain-error shared-kernel <Name>)',
  ],
];

// Generators that write outside the context they are given: the config, registries of the platform, the schema.
const SHARED_GENERATORS = [
  'context',
  'module',
  'repository',
  'integration-event',
  'job',
  'gateway',
  'policy',
  'service',
  'worker',
  'acceptance',
];
// A decision record of a worker's own slices: a new file of docs/adr/. With --deviation it also writes the config.
const DECISION_RECORD = /^docs\/adr\/[^/]+\.md$/;
// The migration a worker generates in its worktree, `npm run db:generate working-<what>`, as each
// migration tool writes it; the conductor generates the real one on the trunk at merge.
const WORKING_MIGRATION = /(^|\/)migrations\/(.+\/)?\d+[_-]working[_-][\w-]*(\.(sql|[cm]?[jt]s)|\/migration\.sql)$/;
// The models of one context on Prisma, `prisma/schema/<context>.prisma`: its worker changes a column
// with the mapper; `prisma/schema/schema.prisma` (the client, the datasource, the platform) is shared.
const PRISMA_CONTEXT_SCHEMA = /^prisma\/schema\/([a-z][a-z0-9-]*)\.prisma$/;
const REPORT_TO_CONDUCTOR = 'Do not work around it: finish what you can and report the need to the conductor.';
const UNREADABLE_COMMAND = `The guard could not read this command, and a worker runs none it cannot read: write it as shorter, separate commands. ${REPORT_TO_CONDUCTOR}`;
const UNCOMPARED_NOTE =
  'ddd-ts-kit: `git status` did not answer in full, so what your last command changed outside your scope was not compared. Name it in your report, for the conductor.';
// Where the guard keeps the state of a worker between two of its calls: the kit's ignored folder.
const GUARD_STATE = '.ddd-ts-kit/guard';
// The markers of what was said or refused once, in the guard's folder of the project, kept a week.
const GUARD_MARKERS = `${GUARD_STATE}/markers`;
const MARKER_TTL = 7 * 24 * 3600 * 1000;
// The state of the runs of a builder, by session and agent: kept a week too.
const BUILDER_STATE = /^(?:turns|before-run|outside|scope)-[0-9a-f]{16}\.json$/;
// The content a worker's command found already changed outside its scope, kept so it can be put back.
const GUARD_HELD = `${GUARD_STATE}/held`;
const FREE_OUTPUT = 'Output to /dev/null or to the system temp directory stays free.';
const EDIT_WITH_TOOLS = `Inside your scope, the editor tools and the shell may both write; outside it, nothing may. ${FREE_OUTPUT}`;
// The clean install of each package manager: what installs the lockfile as it is.
const CLEAN_INSTALL = { npm: 'npm ci', pnpm: 'pnpm install --frozen-lockfile' };
// The subcommands of a package manager that install the lockfile as it is, its aliases included.
const CLEAN_INSTALLS = ['ci', 'clean-install', 'cin', 'ic', 'install-clean', 'isntall-clean'];

// The subcommands of each package manager that change package.json or the lockfile; an install
// changes them when it names a package.
const DEPENDENCY_CHANGES = {
  npm: ['uninstall', 'un', 'unlink', 'remove', 'rm', 'r', 'update', 'up', 'upgrade', 'udpate'],
  pnpm: ['add', 'remove', 'rm', 'uninstall', 'un', 'update', 'up', 'upgrade'],
  yarn: ['add', 'remove', 'upgrade', 'up', 'upgrade-interactive'],
  bun: ['add', 'a', 'remove', 'rm', 'update', 'upgrade'],
};
const INSTALLS = ['install', 'i', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal', 'isntall'];
// The options of a package manager that take a value: that value is not a package.
const VALUED_MANAGER_OPTIONS = [
  '--prefix',
  '-C',
  '--dir',
  '-w',
  '--workspace',
  '--filter',
  '-F',
  '--registry',
  '--omit',
  '--include',
  '--loglevel',
  '--cache',
  '--tag',
  '--userconfig',
  '--cwd',
];

// How a command that runs tests can run other code: the code an interpreter is given inline (from
// its option, from `-` or from its standard input).
const INLINE_CODE = {
  python: /^-[a-zA-Z]*c$/,
  node: /^(?:-[a-zA-Z]*[ep][a-zA-Z]*|--eval(?:=.*)?|--print(?:=.*)?)$/,
  bun: /^(?:-e|-p|--eval|--print)$/,
  ruby: /^-[a-zA-Z]*e[a-zA-Z]*$/,
  perl: /^-[a-zA-Z]*[eE][a-zA-Z]*$/,
  php: /^-r$/,
};
// The programs that run code the guard cannot read, whatever their arguments; a shell is one too.
const CODE_RUNNERS = new Set([
  'node',
  'nodejs',
  'python',
  'perl',
  'ruby',
  'php',
  'bun',
  'bunx',
  'deno',
  'tsx',
  'ts-node',
  'source',
  '.',
  'make',
  'npm',
  'npx',
  'pnpm',
  'pnpx',
  'yarn',
  'vitest',
  'jest',
  'mocha',
  'ava',
  'tap',
  'playwright',
  'cypress',
  'stryker',
]);
// The programs that only read, whatever their arguments (not `rg --pre`, `sort -o`, `tree -o`): a
// worker's command made of them alone is not noted before it runs. Every other program may run code
// of the project (`noteBeforeCode`).
const PURE_READERS = new Set([
  '',
  'cat',
  'ls',
  'head',
  'tail',
  'grep',
  'wc',
  'diff',
  'jq',
  'echo',
  'printf',
  'pwd',
  'cd',
  'pushd',
  'popd',
  'true',
  'false',
  'test',
  '[',
  'cut',
  'tr',
  'basename',
  'dirname',
  'realpath',
  'readlink',
  'stat',
  'file',
  'which',
  'find',
  'du',
  'date',
]);
// The subcommands of git that only read.
const GIT_READ_ONLY = new Set([
  'status',
  'log',
  'show',
  'diff',
  'ls-files',
  'ls-tree',
  'rev-parse',
  'blame',
  'grep',
  'describe',
  'cat-file',
  'merge-base',
  'rev-list',
  'shortlog',
]);
// The subcommands of git that change neither a tree nor a ref: a worker runs them from any checkout.
const GIT_READS_ANYWHERE = new Set([
  ...GIT_READ_ONLY,
  'config',
  'fetch',
  'ls-remote',
  'reflog',
  'for-each-ref',
  'show-ref',
  'show-branch',
  'symbolic-ref',
  'name-rev',
  'var',
  'version',
  'help',
  'check-ignore',
  'check-attr',
  'diff-tree',
  'diff-index',
  'diff-files',
  'count-objects',
  'cherry',
]);
// The first operands that make these subcommands of git read; none at all is undefined.
const GIT_READING_FORMS = {
  stash: ['list', 'show'],
  worktree: ['list'],
  remote: [undefined, 'show', 'get-url'],
  tag: [undefined],
};
// What a worker's git may name of the refs: the options of push, fetch, tag, checkout and switch
// that take a value, those of push that name other refs than its branch, those of tag that list,
// those of checkout and switch that create a branch or leave it.
const PUSH_VALUED = ['-o', '--push-option', '--repo', '--receive-pack', '--exec'];
const PUSH_OTHER_REFS =
  /^--(?:force|force-with-lease|force-if-includes|delete|all|branches|mirror|tags|follow-tags|prune)(?:=|$)/;
const FETCH_VALUED = [
  '-o',
  '--server-option',
  '--depth',
  '--deepen',
  '-j',
  '--jobs',
  '--upload-pack',
  '--refmap',
  '--filter',
  '--negotiation-tip',
];
const TAG_VALUED = ['-m', '--message', '-F', '--file', '-u', '--local-user', '--cleanup'];
const TAG_LISTS = /^(?:-l|--list|-v|--verify|--contains|--no-contains|--points-at|--merged|--no-merged)(?:=|$)/;
const SWITCH_VALUED = ['-b', '-B', '-c', '-C', '--create', '--force-create', '--orphan', '--conflict'];
const CHECKOUT_PATHS = /^(?:--ours|--theirs|-p|--patch|--pathspec-from-file(?:=.*)?)$/;
const SWITCH_CREATES = {
  checkout: /^(?:-[a-zA-Z]*[bB]|--orphan|--detach)$/,
  switch: /^(?:-[a-zA-Z]*[cCd]|--create|--force-create|--orphan|--detach)$/,
};
// The options of `git branch` that delete, move, copy or reset a branch, and those that change its settings.
const BRANCH_DELETES = ['-d', '-D', '--delete'];
const BRANCH_MOVES = ['-m', '-M', '--move', '-c', '-C', '--copy'];
const BRANCH_RESETS = ['-f', '--force'];
const BRANCH_SETTINGS = ['-u', '--set-upstream-to', '--unset-upstream', '--edit-description'];
// The options of `git branch` that list branches, an operand then being a pattern or a commit.
const BRANCH_LISTS = ['--list', '-l', '-a', '--all', '-r', '--remotes', '--show-current', '--contains', '--merged'];
// The scripts of a project that rewrite files by its own tools, which `init` writes and the skills name.
const SANCTIONED_SCRIPTS = new Set([
  'format',
  'lint:fix',
  'regenerate',
  'docs:generate',
  'openapi:generate',
  'events:generate',
]);
const SCRIPT_MANAGERS = ['npm', 'pnpm', 'yarn', 'bun'];
// The packages whose bin the guard runs, by name and command.
const GUARD_RUNS = [
  ['ddd-ts-kit', 'ddd-ts-kit'],
  ['@biomejs/biome', 'biome'],
];
// The most the guard reads of the answer of a process it starts: past it the process is stopped.
const ANSWER_BYTES = 64 * 1024 * 1024;
// How a run stopped before its answer ended fails: past ANSWER_BYTES, or past its time limit.
const CUT_SHORT = new Set(['ENOBUFS', 'ETIMEDOUT']);
// The fields before the path in an entry of `git status --porcelain=v2`, by its kind.
const STATUS_FIELDS = { 1: 8, 2: 9, u: 10, '?': 1 };
const OUTPUT_REDIRECTS = new Set(['>', '>>', '>|', '&>', '&>>', '<>', '>&']);
// Editors that rewrite the files they open in place.
const IN_PLACE_EDITORS = new Set(['vim', 'vi', 'ex', 'ed']);
// Linters and test runners that write the paths they are given, behind a flag.
// For a writer of its operands, `subcommands` are the words that name an action, not a path, and
// `valued` the options whose value is no path it writes.
const TOOL_WRITES = {
  eslint: {
    kind: 'operands',
    flags: ['--fix', '--fix-dry-run'],
    subcommands: [],
    valued: [
      '-c',
      '--config',
      '--ext',
      '--parser',
      '--parser-options',
      '--plugin',
      '--rule',
      '--rulesdir',
      '--env',
      '--global',
      '--ignore-path',
      '--ignore-pattern',
      '-f',
      '--format',
      '-o',
      '--output-file',
      '--max-warnings',
      '--cache-location',
      '--resolve-plugins-relative-to',
    ],
  },
  biome: {
    kind: 'operands',
    flags: ['--write', '--fix'],
    subcommands: ['format', 'check', 'lint', 'ci'],
    valued: [
      '--config-path',
      '--max-diagnostics',
      '--diagnostic-level',
      '--log-level',
      '--log-kind',
      '--reporter',
      '--stdin-file-path',
      '--vcs-root',
      '--files-max-size',
    ],
  },
  vitest: { kind: 'valued', valued: ['--outputFile', '--outputJson'] },
};
const DOWNLOAD_FLAGS = {
  curl: ['-o', '--output'],
  wget: ['-O', '--output-document', '-P', '--directory-prefix'],
};
// git subcommands that rewrite tracked files the command does not name, by one of their flags.
const GIT_FORCE_WRITERS = {
  reset: ['--hard', '--merge', '--keep'],
  switch: ['-f', '--force', '--discard-changes'],
  checkout: ['-f', '--force'],
  'read-tree': ['-u'],
};
// What takes a file away or gives it back its content from git: no one wrote the text it leaves,
// and a generated file is rebuilt after it.
const PUTS_BACK = new Set(['rm', 'unlink', 'git checkout', 'git restore', 'git rm', 'git clean']);
// The commands whose `-t` names the directory they write in; `touch -t` takes a date.
const TARGETED_COMMANDS = new Set(['cp', 'mv', 'ln', 'install']);
// The commands that change the paths they are given, with the options that take a value, and which
// operands they change: all of them, or the destination only.
const PATH_COMMANDS = {
  cp: { valued: ['-S', '--suffix'], changes: 'destination' },
  ln: { valued: ['-S', '--suffix'], changes: 'destination' },
  install: { valued: ['-S', '--suffix', '-m', '--mode', '-o', '--owner', '-g', '--group'], changes: 'destination' },
  mv: { valued: ['-S', '--suffix'], changes: 'all' },
  rm: { valued: [], changes: 'all' },
  rmdir: { valued: [], changes: 'all' },
  unlink: { valued: [], changes: 'all' },
  shred: { valued: ['-n', '-s', '--iterations', '--size'], changes: 'all' },
  touch: { valued: ['-r', '-d', '-t', '--reference', '--date'], changes: 'all' },
  truncate: { valued: ['-s', '-r', '--size', '--reference'], changes: 'all' },
};

// The commands of the kit that write no file: what it lists, describes, explains and reports, its
// checks (`check` without `--baseline`, `lint` without `--fix`, `docs --check` without
// `--stored-events`, `affected` without `--run`), the acceptance read without `--lock`, a briefing,
// the place of a worker or a generator read without running it.
const KIT_READS = new Set([
  'list',
  'describe',
  'explain',
  'status',
  'stories',
  'story',
  'story-check',
  'todo',
  'check',
  'lint',
  'rules',
  'docs',
  'verify-merge',
  'cited',
  'affected',
]);
// The options by which a check of the kit writes: the baseline, a fix, the record of the stored events, a script run.
const KIT_WRITING_OPTIONS = /^--(?:baseline|fix|stored-events|run)(?:=|$)/;

// The variables of the environment by which git runs a program or reads settings given to it.
const GIT_PROGRAM_VARIABLES =
  /^GIT_(?:EXTERNAL_DIFF|CONFIG\w*|PAGER|EDITOR|SEQUENCE_EDITOR|SSH\w*|ASKPASS|PROXY_COMMAND|EXEC_PATH)=/;
// The options of a package runner or of node that take a value: that value launches nothing.
const LAUNCHER_VALUED = [
  '-r',
  '--require',
  '--import',
  '--loader',
  '-p',
  '--package',
  '-c',
  '--call',
  '-C',
  '--dir',
  '--prefix',
  '--filter',
  '-w',
  '--workspace',
];
// The folders of the programs of the system: a reader named by its path there is that reader.
const SYSTEM_PROGRAMS = ['/bin', '/usr/bin', '/sbin', '/usr/sbin'];
const WINDOWS = process.platform === 'win32';
// The variables of lefthook that leave hooks or their commands out.
const HOOK_SELECTION = /^LEFTHOOK_(?:EXCLUDE|SKIP)=/;
// The most of a file of state, a scope file or a plan the guard reads: past it, it is not read.
const STATE_BYTES = 16 * 1024 * 1024;
// The agents of the plugin that only read: they write their findings in their answer.
const READ_ONLY_AGENTS = ['architecture-reviewer', 'domain-explorer', 'story-verifier'];
// How the record of a trial is appended: created if missing, never through a link under its name.
const RECORD_APPEND = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW;
// The variables that move where the shell finds a path, a directory or a program, or git its repository.
const PLACE_VARIABLES = /^(?:TMPDIR|CDPATH|HOME|GIT_DIR|GIT_WORK_TREE|PATH)=/;
const MODES = {
  session,
  'pre-write': preWrite,
  'pre-bash': preBash,
  'post-write': postWrite,
  stop,
  'subagent-start': subagentStart,
  'subagent-stop': subagentStop,
};

// The projects this run of the guard has described: a hook finds the same one several times.
const projects = new Map();
// The scope of a worker in each worktree, read once per call of the guard (`workerScope`).
const scopes = new Map();
// The scope files of the story worktrees this run has read, by project root.
const storyScopes = new Map();
// The end of the time of a session start for the CLI, and whether a call was skipped or stopped for it.
let briefingEnds;
let briefingCut = false;
// The seconds after which a run of the CLI was stopped, by its command: the stop says it of `check`.
const timedOut = new Map();
// The commands of the CLI whose answer was past what the guard reads: the stop says it of `check`.
const oversized = new Set();
// The reader of shell commands, loaded only when a worker runs one: every other call of the guard skips its cost.
let shell;
// The notice due to a context-builder near its turn limit, said with the decision of the call or alone.
let notice;

main();

function main() {
  try {
    const run = MODES[process.argv[2]];
    if (run) {
      Promise.resolve(run(readInput()))
        .then(sayNotice)
        .catch(() => {
          process.exitCode = 0;
        });
    }
  } catch {
    process.exitCode = 0;
  }
}

// A notice no decision carried is said alone, as context of the call.
function sayNotice() {
  if (notice) {
    emit({ hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: notice } });
  }
}

function session(input) {
  // A whole number of milliseconds: a time limit of spawnSync is an integer.
  briefingEnds = Date.now() + Math.round(BRIEFING_BUDGET * TIME_SCALE);
  const directory = input.cwd ?? process.cwd();
  const project = findProject(directory);
  if (project) {
    pruneGuardState(project.root);
  }
  const lines = project ? projectBriefing(project, input) : planPointer(directory);
  if (lines.length === 0) {
    return;
  }
  emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } });
}

async function preWrite(input) {
  if (isBuilder(input)) {
    const [first] = writesOf(input);
    await countBuilderCall(input, first && findProject(dirname(first.file)));
  }
  const verdict =
    strayFileVerdict(input) ?? writesVerdict(judgedWrites(writesOf(input), input), input, () => pendingOfWriter(input));
  if (verdict?.decision !== 'deny') {
    noteCrossings(input);
  }
  if (verdict) {
    decide(input, verdict.decision, verdict.reason);
  }
}

// A builder keeps the working directory of its session, in a project: a file of no project, unless
// the temp directory holds it, is outside its worktree too.
function strayFileVerdict(input) {
  const home = isWorkerAgent(input) ? findProject(input.cwd ?? process.cwd()) : undefined;
  if (!home || home.mode === 'off') {
    return undefined;
  }
  const stray = writesOf(input).find(({ file }) => !findProject(dirname(file)) && !isFreePlace(file));
  const pinned = readJson(stateFile('scope', home, input));
  if (!stray || !(isPin(pinned) || hasWorkerWorktree(home.root))) {
    return undefined;
  }
  const where = isPin(pinned) ? `your worktree ${pinned.worktree}` : 'the worktree of your briefing';
  return {
    decision: home.mode === 'advise' ? 'ask' : 'deny',
    reason: `${stray.file} is outside every project: a worker writes in ${where}, and in the temp directory. ${REPORT_TO_CONDUCTOR}`,
  };
}

// What the write meets of the other stories open in the repository, said with the decision of the call or alone.
function noteCrossings(input) {
  const crossings = writesOf(input).flatMap(({ file }) => {
    const project = findProject(dirname(file));
    const said =
      project && project.mode !== 'off' && existsSync(join(project.root, STORY_SCOPE))
        ? crossingNotice(project, input, file)
        : undefined;
    return said ? [said] : [];
  });
  if (crossings.length > 0) {
    notice = [notice, ...crossings].filter(Boolean).join('\n');
  }
}

// A worker whose inline code changed files outside its scope puts them back before writing again.
function pendingOfWriter(input) {
  const [first] = writesOf(input);
  const project = first && findProject(dirname(first.file));
  if (!project || project.mode === 'off' || !workerContext(project, input)) {
    return undefined;
  }
  const pending = pendingChangeReason(project, input, []);
  return pending?.reason ? { decision: project.mode === 'advise' ? 'ask' : 'deny', reason: pending.reason } : undefined;
}

// The writes of a call in a project the guard judges, each with its project.
function judgedWrites(writes, input) {
  return writes
    .map((written) => ({ ...written, project: withPinnedMode(findProject(dirname(written.file)), input) }))
    .filter(({ project }) => project && project.mode !== 'off');
}

// A patch of Codex can touch several files: a refusal of any of them wins over a question. The
// refusals that start no process come first, so that they hold within the time of the hook; then
// those the CLI decides; then what `pending` reads with git; then the questions.
function writesVerdict(writes, input, pending) {
  return (
    refusalOf(writes, input, quickRefusal) ??
    cliVerdict(writes, input) ??
    pending() ??
    writes.map(deviationOf).find(Boolean)
  );
}

// The first refusal, read file by file until one denies; a question waits for a denial of a later file.
function refusalOf(writes, input, check) {
  let asked;
  for (const written of writes) {
    const reason = check(written, input);
    if (reason && written.project.mode !== 'advise') {
      return { decision: 'deny', reason };
    }
    asked ??= reason ? { decision: 'ask', reason } : undefined;
  }
  return asked;
}

// The first files the CLI may judge (TypeScript, the code of a context: the build gate of a fix is
// read without it) are judged before the write; the others are left to the check after it, and said.
function cliVerdict(writes, input) {
  const judged = writes.filter(
    ({ project, file, deleted }) =>
      !deleted && (/\.(ts|mts|cts)$/.test(file) || insideContexts(project, projectPath(project, file))),
  );
  const verdict = refusalOf(judged.slice(0, CLI_WRITE_FILES), input, cliRefusal);
  if (!verdict && judged.length > CLI_WRITE_FILES) {
    notice = `ddd-ts-kit: ${judged.length - CLI_WRITE_FILES} more written file(s) not judged before the write here: the check after it reads them.`;
  }
  return verdict;
}

// A file a patch removes is judged as `rm` judges it: the baseline and the scope of a worker hold it.
function quickRefusal({ project, file, written, replaced, deleted }, input) {
  if (deleted) {
    return baselineFileReason(project, file) ?? workerScopeReason(project, file, input);
  }
  return (
    baselineFileReason(project, file) ??
    scopeFileReason(project, { place: file }, input) ??
    acceptanceReason(project, input, { file, written, replaced }) ??
    generatedFileReason(project, file) ??
    (isUnwrapping(project, file, input)
      ? undefined
      : (workerScopeReason(project, file, input) ?? linkReason(project, file, input))) ??
    strayWriteReason(project, input) ??
    testWriterScopeReason(project, file, input) ??
    worktreeCodeReason(project, file) ??
    handWrittenRoleReason(project, file)
  );
}

function cliRefusal({ project, file, written, replaced }, input) {
  return storyCodeReason(project, file) ?? dependencyReason(project, { file, written, replaced }, input);
}

function deviationOf({ project, file, written, replaced, deleted }) {
  if (deleted) {
    return undefined;
  }
  const deviation = governedFileReason(project, file) ?? escapeReason(written, replaced);
  return deviation ? { decision: 'ask', reason: deviation } : undefined;
}

// A refusal of the patch Codex applies through its shell wins; else the command line is read, and a
// question about the patch is put only when the rest of the line passes.
async function preBash(input) {
  const command = toolInput(input).command;
  if (typeof command !== 'string') {
    return;
  }
  const cwd = input.cwd ?? process.cwd();
  const patched = await codexPatchVerdict(input, command, cwd);
  const verdict = patched?.decision === 'deny' ? patched : ((await shellVerdict(input, command, cwd)) ?? patched);
  if (verdict) {
    decide(input, verdict.decision, verdict.reason);
  }
}

async function shellVerdict(input, command, cwd) {
  shell = await import('./shell-commands.mjs');
  // A leading `cd` out of every project leaves the command to be judged against the session's project;
  // a worker whose session stands in no project is judged in the project its command names.
  const project = withPinnedMode(
    findProject(commandDirectory(command, cwd)) ?? findProject(cwd) ?? namedProject(input, command, cwd),
    input,
  );
  await countBuilderCall(input, project, command);
  if (!project || project.mode === 'off') {
    return undefined;
  }
  const decision = project.mode === 'advise' ? 'ask' : 'deny';
  const commands = readCommands(project, command, cwd);
  if (!commands) {
    return isHeldToAWorktree(project, input) ? { decision, reason: UNREADABLE_COMMAND } : undefined;
  }
  const preparing = await preparingReason(project, input, { command, commands });
  if (preparing) {
    return { decision, reason: preparing };
  }
  const context = workerContext(project, input);
  const refusal = context
    ? workerCommandReason(project, input, { context, command, commands })
    : (builderStrayReason(project, input, commands) ?? sessionShellReason(input, commands));
  return refusal ? { decision, reason: refusal } : undefined;
}

// The project of the first place a worker's command names (a directory it moves to, a file it writes):
// a session opened above a project still holds its worker to that project.
function namedProject(input, command, cwd) {
  if (!isWorkerAgent(input)) {
    return undefined;
  }
  let commands;
  try {
    commands = shell.simpleCommands(command, cwd);
  } catch {
    return undefined;
  }
  const places = commands.flatMap((simple) => [
    ...(['cd', 'pushd'].includes(shell.commandName(simple.words))
      ? [{ place: shell.placeOf(simple.words[1] ?? shell.UNKNOWN, simple.directory) }]
      : []),
    ...writtenTargets(simple),
    ...changedPaths(simple),
  ]);
  return places.map(({ place }) => place && findProject(place)).find(Boolean);
}

// The commands of a line and the places they write, read once here: the rules that follow read the
// same text, so a reader that breaks on it answers no command at all.
function readCommands(project, command, cwd) {
  try {
    const commands = shell.simpleCommands(command, cwd);
    writtenProjectPaths(project, commands);
    return commands;
  } catch {
    return undefined;
  }
}

// What the shell writes of a session that is not a context worker meet, in the project each place
// belongs to: the story build gate and the generated or baseline files for everyone, the test-writer
// held to the paths of a test. What a redirection, `sed -i` or `tee` types in a file is held as the
// editor tools are; what a command only moves, deletes or restores is not.
function sessionShellReason(input, commands) {
  const reading = readOnlyReason(input, commands);
  if (reading) {
    return reading;
  }
  for (const command of commands) {
    const typed = writtenTargets(command).map((target) => ({ ...target, typed: true }));
    for (const target of [...typed, ...changedPaths(command)]) {
      const refusal = sessionPlaceReason(input, target);
      if (refusal) {
        return `${target.by}: ${refusal}`;
      }
    }
  }
  return undefined;
}

// The reviewer, the explorer and the verifier of the plugin change no file of a project, by any tool:
// nor its work tree by git, whose index alone they may stage.
function readOnlyReason(input, commands) {
  if (!READ_ONLY_AGENTS.some((name) => String(input.agent_type ?? '').includes(name))) {
    return undefined;
  }
  for (const command of commands) {
    const written = [...writtenTargets(command), ...changedPaths(command)].find(
      ({ place }) => place !== undefined && findProject(place) !== undefined,
    );
    const { subcommand, tail } = gitInvocation(command.words.slice(1), command.directory);
    const git = shell.commandName(command.words) === 'git' && !readsAnywhere(subcommand, tail) && subcommand !== 'add';
    if (written || git) {
      const by = written ? `${written.by} changes ${written.place}` : `\`git ${subcommand}\` changes the work tree`;
      return `A read-only agent changes no file of a project: ${by}. Read with \`git show <ref>:<path>\` and \`git diff\`, and write what you find in your answer. ${FREE_OUTPUT}`;
    }
  }
  return undefined;
}

function sessionPlaceReason(input, { place, by, typed, below }) {
  const testWriter = isTestWriter(input);
  if (place === undefined) {
    return testWriter
      ? `The test writer changes tests only, and writes with the shell only to a file it names: this command writes files only the shell knows. Name each file, after a certain \`cd <folder> && ...\`. ${FREE_OUTPUT}`
      : undefined;
  }
  const owner = findProject(place);
  if (!owner || owner.mode === 'off') {
    return undefined;
  }
  return (
    scopeFileReason(owner, { place, below }, input) ??
    lockedRegressionReason(owner, projectPath(owner, place), input) ??
    (testWriter
      ? testWriterScopeReason(owner, place, input)
      : (storyCodeReason(owner, place) ??
        (PUTS_BACK.has(by) ? undefined : generatedFileReason(owner, place)) ??
        baselineFileReason(owner, place) ??
        (typed ? (worktreeCodeReason(owner, place) ?? handWrittenRoleReason(owner, place)) : undefined)))
  );
}

// Codex applies a patch through `apply_patch` in its shell tool as well as its patch tool: each patch
// the line holds (a here-document, an argument) is judged the same way a write through the editor tool
// is; a patch the command does not hold (read from a file, a pipe) cannot be judged and is refused. A
// here-document that only holds the text of a patch for another command (`cat <<EOF > notes.md`) is no patch.
async function codexPatchVerdict(input, command, cwd) {
  if (hostOf(input) !== 'codex') {
    return undefined;
  }
  shell = await import('./shell-commands.mjs');
  const project = findProject(cwd);
  const commands = readCommands(project ?? { root: cwd }, command, cwd);
  if (!commands?.some(({ words }) => shell.commandName(words) === 'apply_patch')) {
    return undefined;
  }
  const patches = command.split('*** Begin Patch').slice(1);
  if (patches.length === 0) {
    return !project || project.mode === 'off'
      ? undefined
      : {
          decision: project.mode === 'advise' ? 'ask' : 'deny',
          reason:
            "apply_patch is judged when the command holds the patch: give it as a here-document (`apply_patch <<'EOF'` ... `EOF`), not from a file or a pipe.",
        };
  }
  const writes = patches.flatMap((patch) => patchWrites(patch.split('*** End Patch')[0], cwd));
  return writesVerdict(judgedWrites(writes, input), input, () => undefined);
}

// A context-builder keeps the working directory of its session, so the scope of a worker is found
// only when the command moves into its worktree (`cd <worktree> && ...` or `--cwd`). When the
// session has worker worktrees and a builder's command touches no scoped project, a write by that
// command lands where the guard cannot judge it: it is refused, with the one shape it reads.
function builderStrayReason(project, input, commands) {
  if (!isHeldToAWorktree(project, input) || !builderWrites(commands)) {
    return undefined;
  }
  return 'A worker runs every command as `cd <worktree> && ...` so that the guard reads it against the scope of that worktree; this command writes without moving into a worktree of your project. Run it as `cd <worktree> && ...`.';
}

// An agent that holds the worker's name, with a scope of its own or in a repository of worker
// worktrees: outside a scoped checkout, it is out of its place.
function isHeldToAWorktree(project, input) {
  return isWorkerAgent(input) && (workerScope(project, input) !== undefined || hasWorkerWorktree(project.root));
}

// A redirection, a writer of the tables, a generator of the kit, a line the reader could not read to
// its end, or any program but those that read: outside its worktree a worker reads only.
function builderWrites(commands) {
  return (
    generates(commands, []) ||
    commands.some(
      (command) =>
        command.truncated ||
        writtenTargets(command).length > 0 ||
        changedPaths(command).length > 0 ||
        !readsFromAnywhere(command),
    )
  );
}

// A pure reader, git that reads (or versions in the worker's own worktree, which `workerGitReason`
// decides first), or the kit asked what it knows.
function readsFromAnywhere(command) {
  if (shell.commandName(command.words) === 'git') {
    const { subcommand, tail } = gitInvocation(command.words.slice(1), command.directory);
    return readsAnywhere(subcommand, tail) || ['add', 'commit'].includes(subcommand);
  }
  return isPureReader(command) || kitInvocations([command]).some(kitReads);
}

function kitReads({ subcommand, args }) {
  if (subcommand === 'acceptance') {
    return !args.includes('--lock');
  }
  if (['worker-scope', 'story-scope', 'generate', 'g'].includes(subcommand)) {
    return args.some((arg) => /^--(?:dry-run|resume|help)\b/.test(arg));
  }
  return (
    KIT_READS.has(subcommand) &&
    !args.some((arg) => KIT_WRITING_OPTIONS.test(arg)) &&
    (subcommand !== 'docs' || args.includes('--check'))
  );
}

// What no agent runs, then what waits for a place, a landing, a lock or a generator first.
async function preparingReason(project, input, { command, commands }) {
  return (
    baselineWriteReason(project, commands) ??
    hooksSkippedReason(commands) ??
    gitConfigReason(input, commands) ??
    otherBranchReason(input, commands) ??
    workerPlaceReason(input, commands) ??
    landingReason(input, commands) ??
    workerGitReason(project, input, commands) ??
    oneSideMergeReason(project, input, commands) ??
    acceptanceLockingReason(input, commands) ??
    acceptanceFilesShellReason(project, input, { command, commands }) ??
    generatorPlaceReason(project, commands)
  );
}

// What a worker may not run: anything once its scope file changed, a file it must put back first,
// then what the command itself would do; a command allowed to run code the guard cannot read has
// the state outside the scope noted before it.
function workerCommandReason(project, input, { context, command, commands }) {
  const { changed } = workerScope(project, input);
  if (changed) {
    return changed;
  }
  const pending = pendingChangeReason(project, input, commands);
  if (pending?.reason) {
    return pending.reason;
  }
  // A command that puts back held files changes them outside the scope: only that check is lifted.
  const refusal =
    sharedGeneratorReason(project, context, commands) ??
    dependencyChangeReason(commands) ??
    workingMigrationReason(command) ??
    formatterReason(project, commands) ??
    unknownProgramReason(commands) ??
    placeVariableReason(commands) ??
    (pending ? undefined : fileChangeReason(project, input, commands)) ??
    unreadReason(commands);
  if (!refusal && !pending) {
    noteBeforeCode(project, input, commands);
  }
  return refusal;
}

// A command nested in more shells or evals than the reader follows, or a line that ends inside a
// quote or a here-document, leaves commands the reader never saw: a worker's is refused, since the
// guard cannot see what it writes.
function unreadReason(commands) {
  const unread = commands.find((command) => command.truncated)?.truncated;
  if (unread === undefined) {
    return undefined;
  }
  return unread === 'nested'
    ? `A command nested deeper than the guard reads is refused to a worker: write it as separate, flatter commands. ${REPORT_TO_CONDUCTOR}`
    : `A quote, a substitution or a here-document of this command never closes, so the guard cannot read what follows it: close it, or write separate commands. ${REPORT_TO_CONDUCTOR}`;
}

// The variables by which the shell and git find their places: set by a worker, the places the guard
// reads would no longer be the places written.
function placeVariableReason(commands) {
  const variable = commands.flatMap(exportedVariables).find((word) => PLACE_VARIABLES.test(word));
  return variable
    ? `A worker sets no \`${variable.split('=')[0]}\`: it changes where the shell or git read and write, and the guard reads the places of a command by their values when the session started. ${EDIT_WITH_TOOLS}`
    : undefined;
}

// A command whose program word holds a variable or a substitution runs a name only the shell
// computes, which the guard cannot judge; `eval` of such a text leaves the same unreadable word.
function unknownProgramReason(commands) {
  for (const { words } of commands) {
    const program = words[0];
    if (program !== undefined && (program.includes(shell.UNKNOWN) || program.includes('$'))) {
      const shown = program.replaceAll(shell.UNKNOWN, '$(...)');
      return `A worker runs no command whose name only the shell knows: \`${shown}\` is computed when the command runs. ${EDIT_WITH_TOOLS}`;
    }
  }
  return undefined;
}

function postWrite(input) {
  const all = writesOf(input).filter(({ deleted }) => !deleted);
  // Biome lays out every written file, which is quick; the check, which is not, reads the first ones.
  formatWrites(all);
  const writes = all.slice(0, POST_WRITE_FILES);
  const errors = writes.filter(({ file }) => isChecked(file)).flatMap(({ file }) => checkWritten(file));
  const unchecked =
    all.length > writes.length
      ? `ddd-ts-kit: ${all.length - writes.length} more written file(s) not checked here: run \`npx ddd-ts-kit check\``
      : undefined;
  if (errors.length === 0) {
    return unchecked ? emit({ systemMessage: unchecked }) : undefined;
  }
  const feedback = [
    `ddd-ts-kit: the file just written breaks ${errors.length} architecture rule(s). Fix them now, do not suppress.\n${describe(errors)}`,
    ...(unchecked ? [unchecked] : []),
  ].join('\n');
  // Codex hands the reason of a block to the model in place of the result of the tool.
  if (hostOf(input) === 'codex') {
    return emit({ decision: 'block', reason: feedback });
  }
  process.stderr.write(`${feedback}\n`);
  process.exitCode = 2;
}

function checkWritten(file) {
  const project = findProject(dirname(file));
  return project?.cli && project.mode !== 'off' ? errorsOf(runCli(project, ['check-file', file, '--json'], 12000)) : [];
}

// With `formatOnWrite` in the config, the Biome the project installed lays out each written file
// before it is checked, so that the layout is settled at the write and the lint findings that follow
// a wrapped line come back in the same output. One file, the bin of the package the project installed
// only, never `npx biome`.
function formatWrites(writes) {
  for (const { file } of writes) {
    const project = findProject(dirname(file));
    if (!project?.formatOnWrite || project.mode === 'off' || !FORMATTED_FILE.test(file) || !existsSync(file)) {
      continue;
    }
    const biome = installedBin(join(project.root, 'node_modules', '@biomejs', 'biome'), '@biomejs/biome', 'biome');
    if (biome) {
      spawnSync(process.execPath, [biome.bin, 'format', '--write', file], {
        cwd: project.root,
        encoding: 'utf8',
        timeout: FORMAT_TIMEOUT,
        maxBuffer: ANSWER_BYTES,
      });
    }
  }
}

// The context-builder of the plugin in Claude Code: its tool calls are counted, its runs and stops recorded.
// An agent of the project named otherwise is held to the scope of a worker (`workerContext`), not counted.
function isBuilder(input) {
  return hostOf(input) === 'claude' && input.agent_type === BUILDER_AGENT;
}

async function countBuilderCall(input, project, command) {
  const places = isBuilder(input) && project?.mode !== 'off' ? builderPlaces(input, project) : undefined;
  if (places) {
    const runs = await import('./builder-runs.mjs');
    try {
      notice = runs.countCall(input, places, command);
    } catch {
      // a count that fails never drops the decision of the call
    }
  }
}

// The project of the session (the conductor's: a sub-agent keeps the working directory of its
// session) holds the state of each builder's run in the guard's folder; the worktree of the builder,
// shown by the call, holds what the conductor reads back.
function builderPlaces(input, project) {
  const home = findProject(input.cwd ?? process.cwd()) ?? project;
  if (!home || home.mode === 'off' || project?.mode === 'off') {
    return undefined;
  }
  const worker = project && existsSync(join(project.root, WORKER_SCOPE)) ? project.root : undefined;
  return { state: stateFile('turns', home, input), worker, home };
}

// A new run of a builder: the note its last run left before inline code is dropped, since what
// changed outside its scope since then is the conductor's as much as its own; what that code changed
// and was not put back stays recorded.
async function subagentStart(input) {
  const places = isBuilder(input) ? builderPlaces(input, undefined) : undefined;
  if (!places) {
    return;
  }
  const worker = readJson(places.state)?.worker;
  if (typeof worker === 'string') {
    removeKitFile(stateFile('before-run', { root: worker }, input));
    pruneGuardState(worker);
  }
  (await import('./builder-runs.mjs')).startRun(input, places);
}

// A builder that ends, unless kept going once, releases the pin of its scope when its scope file is
// still the one pinned; a pin whose scope file changed stays, for the conductor to see, a week at most.
// Its last command has no next call: what it left outside the scope is compared here, the worker
// keeps going once to put it back, and what stays reaches the conductor with the stop.
async function subagentStop(input) {
  const places = isBuilder(input) ? builderPlaces(input, undefined) : undefined;
  if (!places) {
    return;
  }
  const runs = await import('./builder-runs.mjs');
  const outside = changedAtStop(places, input);
  const reason = runs.stopRun(input, places, outside);
  if (reason) {
    emit({ decision: 'block', reason });
    return;
  }
  releasePin(stateFile('scope', places.home, input));
  if (outside) {
    emit({ systemMessage: `ddd-ts-kit: ${outside}` });
  }
}

// What the note before the last command, and the files still held, say at the stop of a worker.
function changedAtStop(places, input) {
  const worktree = readJson(places.state)?.worker;
  const project = typeof worktree === 'string' ? findProject(worktree) : undefined;
  if (!project || !workerContext(project, input)) {
    return undefined;
  }
  const told = settleNote(project, input, false) ?? heldChangeReason(project, input, [])?.reason;
  const said = [notice, told, branchOutsideReason(project, input)].filter(Boolean).join('\n');
  notice = undefined;
  return said || undefined;
}

// What the branch of a worker holds outside its scope since the base its scope file records: its
// commits since then, what the trunk brought in left out, and what stays uncommitted. A scope file
// that records no base leaves the commits uncompared, as the guard fails open.
function branchOutsideReason(project, input) {
  const base = readJson(join(project.root, WORKER_SCOPE))?.baseCommit;
  if (typeof base !== 'string' || !/^[0-9a-f]{7,64}$/.test(base)) {
    return undefined;
  }
  const outside = worktreeOutside(project, input);
  const paths = [...committedSince(project, base, outside).keys(), ...Object.keys(snapshot(project, outside).changes)];
  return paths.length === 0
    ? undefined
    : `Your branch holds files outside your scope since its base ${base.slice(0, 12)}: ${[...new Set(paths)].join(', ')}. Take them out of your branch (\`git checkout ${base.slice(0, 12)} -- <path>\` or \`git rm\` for a new file, then \`git commit\`), or name them in your report for the conductor. ${REPORT_TO_CONDUCTOR}`;
}

function releasePin(pin) {
  const pinned = readJson(pin);
  if (isPin(pinned) && named(readJson(join(pinned.worktree, WORKER_SCOPE))?.context, CONTEXT_NAME) === pinned.context) {
    removeKitFile(pin);
  }
}

function stop(input) {
  if (input.stop_hook_active) {
    return;
  }
  const project = findProject(input.cwd ?? process.cwd());
  if (!project || project.mode === 'off') {
    return;
  }
  const errors = remainingErrors(project);
  if (errors.length > 0) {
    return stopAlreadyRefused(project, input, errors) ? undefined : blockStop(errors);
  }
  const unfinished = unfinishedStoryReason(project, input);
  if (unfinished) {
    return emit({ decision: 'block', reason: unfinished });
  }
  const reminders = [
    unfinishedCheck(),
    commitReminder(project, input, { repeat: false }),
    designReminder(project, input),
  ].filter(Boolean);
  // Warnings shown to the user, never a block: the size of a commit and a design departed from are advice.
  if (reminders.length > 0) {
    emit({ systemMessage: reminders.join('\n') });
  }
}

// A check stopped at its time limit, or past what the guard reads, lets the stop through: the session
// is told it did not finish.
function unfinishedCheck() {
  if (oversized.has('check')) {
    return 'architecture check answered more than the guard reads: run `npx ddd-ts-kit check`';
  }
  const seconds = timedOut.get('check');
  return seconds === undefined
    ? undefined
    : `architecture check timed out after ${seconds} s: run \`npx ddd-ts-kit check\``;
}

// In the worktree of a story, a done row whose design review cites a name the code does not have,
// with no compromise listed in the report: said once per session for the same names, never blocking.
function designReminder(project, input) {
  const story = storyOf(project);
  if (story === undefined || !project.cli || fixOf(project) !== undefined) {
    return undefined;
  }
  const design = runCli(project, ['story-check', story, '--json'], 20000)?.design ?? [];
  if (design.length === 0) {
    return undefined;
  }
  const key = createHash('sha256')
    .update(
      `${project.root}\n${sessionOf(input)}\n${design.map(({ document, line, cited }) => `${document}:${line}:${cited}`).join('\n')}`,
    )
    .digest('hex')
    .slice(0, 24);
  if (alreadyRemembered(markerOf(project, 'design', key))) {
    return undefined;
  }
  const named = design
    .slice(0, 5)
    .map(({ cited, row, document, line }) => `\`${cited}\` (#${row}, ${document}:${line})`)
    .join(', ');
  return `ddd-ts-kit: a row departed from its design: update its review section or list the compromise. ${design.length} name(s) of the design of story ${story} are not in the code: ${named}. \`npx ddd-ts-kit story-check ${story}\` lists them, and \`### Compromises\` of \`## Report\` in docs/architecture/stories/${story}.md records what was built otherwise.`;
}

// The session of a story ends on its report: written once the pull request is open, or with what
// blocks the story. Refused once for the same step, so that a session that cannot go on still stops.
function unfinishedStoryReason(project, input) {
  const story = storyOf(project);
  if (story === undefined || !project.cli) {
    return undefined;
  }
  const phases = runCli(project, ['story', story, '--json'], 8000);
  const report = phases?.phases?.find(({ id }) => id === 'report');
  if (!report || report.met) {
    return undefined;
  }
  const key = createHash('sha256')
    .update(`${project.root}\n${sessionOf(input)}\n${phases.next}`)
    .digest('hex')
    .slice(0, 24);
  if (typeof input.stop_hook_active !== 'boolean' && alreadyRemembered(markerOf(project, 'story', key))) {
    return undefined;
  }
  return `ddd-ts-kit: story ${story} is not finished. Next: ${quoted(phases.next)} Go on without asking: a question now is a provisional decision, recorded in docs/architecture/stories/${story}.md. If something truly blocks the story, write its \`## Report\` there with what blocks it and every decision taken so far, then stop.`;
}

function remainingErrors(project) {
  if (!project.cli || project.mode !== 'enforce' || !hasPendingChanges(project)) {
    return [];
  }

  return errorsOf(runCli(project, ['check', '--format', 'json'], 60000));
}

// A host that does not say whether the stop was already refused (`stop_hook_active`) is refused
// once per session for the same errors: a refusal it cannot get out of would never end.
function stopAlreadyRefused(project, input, errors) {
  if (typeof input.stop_hook_active === 'boolean') {
    return false;
  }
  const key = createHash('sha256')
    .update(`${project.root}\n${sessionOf(input)}\n${describe(errors)}`)
    .digest('hex')
    .slice(0, 24);

  return alreadyRemembered(markerOf(project, 'stop', key));
}

function blockStop(errors) {
  emit({
    decision: 'block',
    reason: `ddd-ts-kit: ${errors.length} architecture error(s) remain. Fix them before finishing, do not suppress or lower a severity.\n${describe(errors.slice(0, 10))}`,
  });
}

function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return {};
  }
}

// Claude Code, and Copilot or VS Code under the same event names, send `tool_name` and
// `tool_input`; Codex adds a `turn_id` and edits through `apply_patch`; the hooks of Copilot
// in its own format send `toolName`, `toolArgs` and `sessionId`.
function hostOf(input) {
  if ('toolName' in input || 'sessionId' in input) {
    return 'copilot';
  }

  return input.tool_name === 'apply_patch' || 'turn_id' in input ? 'codex' : 'claude';
}

function toolInput(input) {
  if (input.tool_input && typeof input.tool_input === 'object') {
    return input.tool_input;
  }
  const args = typeof input.toolArgs === 'string' ? parseJson(input.toolArgs) : input.toolArgs;

  return args && typeof args === 'object' ? args : {};
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function sessionOf(input) {
  return input.session_id ?? input.sessionId ?? '';
}

// What one call of a write tool writes, file by file, with the text it adds and the text it replaces.
function writesOf(input) {
  const tool = toolInput(input);
  const cwd = input.cwd ?? process.cwd();
  // Codex documents the patch under `command`; the other fields are read in case it moves.
  const patch = [tool.command, tool.patch, tool.input].find(
    (text) => typeof text === 'string' && /^\s*\*\*\* Begin Patch/.test(text),
  );
  if (patch) {
    return patchWrites(patch, cwd);
  }
  const file = tool.file_path ?? tool.path;
  if (typeof file !== 'string') {
    return [];
  }

  return [{ file: resolve(cwd, file), written: writtenText(tool), replaced: replacedText(tool) }];
}

// The patch of Codex: `*** Add File:`, `*** Update File:` (and `*** Move to:`), `*** Delete File:`,
// each followed by its lines, `+` added and `-` removed. Its paths are relative to the session. A
// deleted file, and the file a move leaves, are writes that remove it (`deleted`).
function patchWrites(patch, cwd) {
  const writes = [];
  let current;
  for (const line of patch.split('\n')) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    const moved = /^\*\*\* Move to: (.+)$/.exec(line);
    if (header) {
      current = { file: resolve(cwd, header[2].trim()), added: [], removed: [], deleted: header[1] === 'Delete' };
      writes.push(current);
    } else if (moved && current) {
      writes.push({ file: current.file, added: [], removed: [], deleted: true });
      current.file = resolve(cwd, moved[1].trim());
    } else if (current && /^[+-]/.test(line)) {
      (line.startsWith('+') ? current.added : current.removed).push(line.slice(1));
    }
  }

  return writes.map(({ file, added, removed, deleted }) => ({
    file,
    written: added.join('\n'),
    replaced: removed.join('\n'),
    ...(deleted ? { deleted } : {}),
  }));
}

// Up to a folder another user may write: a config there, the shared temp dir above all, is no project.
function findProject(from) {
  let directory = resolve(from);
  for (;;) {
    if (!isOwnFolder(directory)) {
      return undefined;
    }
    if (existsSync(join(directory, CONFIG))) {
      return describeProject(directory);
    }
    const parent = dirname(directory);
    if (parent === directory) {
      return undefined;
    }
    directory = parent;
  }
}

function describeProject(root) {
  if (!projects.has(root)) {
    projects.set(root, readProject(root));
  }
  return projects.get(root);
}

// What the guard reads of a project, its config read once: a field of the wrong type is its default.
function readProject(root) {
  const { config, tooLarge } = readConfig(join(root, CONFIG));
  const text = (key, otherwise) =>
    Object.hasOwn(config, key) && typeof config[key] === 'string' && config[key] !== '' ? config[key] : otherwise;
  return {
    root,
    cli: installedCli(root),
    sourceRoot: text('sourceRoot', 'src'),
    contextsDir: text('contextsDir', 'src/contexts'),
    sharedKernelDir: text('sharedKernelDir', `${text('sourceRoot', 'src')}/shared-kernel`),
    // The modules of the model each context declares: one folder of the context holding its layers.
    modules: modulesByContext(config.contexts),
    platformDir: text('platformDir', 'src/platform'),
    commit: commitLimits(config.commit),
    packageManager: config.stack?.packageManager === 'pnpm' ? 'pnpm' : 'npm',
    // enforce: block; advise: ask the user; off: silent; any other value, enforce, said at session start.
    // A config too large to read leaves the guard off there, said at session start too.
    ...(tooLarge === undefined
      ? guardMode(process.env.DDD_TS_KIT_GUARD ?? config.guard ?? 'enforce')
      : { mode: 'off', tooLarge }),
    // required (what init writes in a new project): the code of a context is refused in the main checkout
    // of the trunk; advised (the key absent, a project started before): only said.
    worktrees: config.worktrees === 'required' ? 'required' : 'advised',
    // The project's Biome runs on each written file before the check; absent, off.
    formatOnWrite: config.formatOnWrite === true,
    // On trial: the dependency rules judge the text about to be written, before the write; absent, after it.
    dependenciesBeforeWrite: config.dependenciesBeforeWrite === true,
  };
}

// The config as an object of JSON, never read above CONFIG_BYTES; one that cannot be read or parsed
// is the defaults.
function readConfig(path) {
  const { content, tooLarge } = readBounded(path, CONFIG_BYTES);
  if (tooLarge !== undefined) {
    return { config: {}, tooLarge };
  }
  const config = parseJson(content ?? '');
  return { config: isRecord(config) ? config : {} };
}

// The content of a regular file, read through one descriptor that never waits (a FIFO opens at
// once) and never past `limit` bytes: the file measured is the file read. A device, a FIFO, a folder
// or a file that cannot be opened has no content.
function readBounded(path, limit, encoding = 'utf8') {
  let descriptor;
  let read = {};
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const stat = fstatSync(descriptor);
    if (stat.isFile()) {
      read = stat.size > limit ? { tooLarge: stat.size } : { content: readFileSync(descriptor, encoding) };
    }
  } catch {
    // Missing, or not readable by this user: no content.
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
  return read;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function guardMode(asked) {
  return GUARD_MODES.includes(asked) ? { mode: asked } : { mode: 'enforce', unknownMode: asked };
}

// The CLI the project installed, where Node would find it: in the project, or hoisted to a parent
// by the workspaces of npm or pnpm (a project of a monorepo, the example of this repository), never
// above the top of its repository, where a folder another user writes (the temp dir) could hold one.
function installedCli(root) {
  const top = repositoryTop(root) ?? root;
  let directory = root;
  for (;;) {
    const cli = installedBin(join(directory, 'node_modules', 'ddd-ts-kit'), 'ddd-ts-kit', 'ddd-ts-kit');
    if (cli || directory === top) {
      return cli;
    }
    directory = dirname(directory);
  }
}

// The bin `command` of the package `name` installed in `home`, and its version: the file its manifest
// names, inside the package once links are followed. The guard runs it with Node, never through
// node_modules/.bin, whose entry may be any file a repository commits (and is a shell shim on pnpm).
function installedBin(home, name, command) {
  const manifest = readJson(join(home, 'package.json'));
  if (manifest?.name !== name) {
    return undefined;
  }
  try {
    const bin = realpathSync(resolve(home, manifest.bin[command]));
    return bin.startsWith(`${realpathSync(home)}${sep}`) ? { bin, version: manifest.version } : undefined;
  } catch {
    // No bin of that name, or a file that is not there.
    return undefined;
  }
}

function commitLimits(configured) {
  const limit = (key) =>
    Number.isInteger(configured?.[key]) && configured[key] > 0 ? configured[key] : COMMIT_DEFAULTS[key];
  return { maxFiles: limit('maxFiles'), maxLines: limit('maxLines') };
}

function readJson(path) {
  const { content } = readBounded(path, STATE_BYTES);
  return content === undefined ? undefined : parseJson(content);
}

function projectBriefing(project, input) {
  const lines = [
    'ddd-ts-kit project (DDD, Clean Architecture). The rules are checked: `npx ddd-ts-kit explain <rule-id>`.',
    'Order of work: glossary of the context (CONTEXT.md), `npx ddd-ts-kit generate <kind> ... --json`, fill only the TODO(domain) places it lists, tests, `npx ddd-ts-kit check --changed-since <ref>`, then commit the slice.',
    'Never write by hand a file a generator produces; never edit a generated file (declaration barrels, contracts).',
    'Read `npx ddd-ts-kit list` (text; `--json` for a script) and the CONTEXT.md of one context instead of browsing the tree.',
    ...mergeNotice(project),
    ...configNotice(project),
    ...(project.mode === 'off' ? [] : versionGap(project)),
    ...planPointer(project.root),
    ...workerNotice(project, input),
    ...storyNotice(project),
    ...worktreeNotice(project),
    ...workersToResume(project),
  ];
  if (project.cli) {
    lines.push('Contexts:', contextMap(project));
  } else {
    lines.push(installAdvice(project));
  }
  if (briefingCut) {
    lines.push(BRIEFING_CUT);
  }
  const reminder = project.mode === 'off' ? undefined : commitReminder(project, input, { repeat: true });

  return (reminder ? [...lines, reminder] : lines).map((line) => inRunnerOf(project, line));
}

// The commands of the preamble in the dialect of the project: the runner its settings allow and its AGENTS.md names.
function inRunnerOf(project, line) {
  return project.packageManager === 'pnpm' ? line.replaceAll('npx ddd-ts-kit', 'pnpm exec ddd-ts-kit') : line;
}

// A merge half done: MERGE_HEAD in the git directory of this checkout, and what merge-trunk kept of it.
// Said first, so that a resumed session does not generate or commit on top of it.
function mergeNotice(project) {
  const gitDir = gitDirOf(project.root);
  if (!gitDir || !existsSync(join(gitDir, 'MERGE_HEAD'))) {
    return [];
  }
  const report = readJson(join(project.root, '.ddd-ts-kit', 'merge.json'))?.report;
  if (!report || typeof report !== 'object') {
    return [
      'Merge in progress, not started by merge-trunk: finish it with git, or undo it with `npx ddd-ts-kit merge-trunk --abort`.',
    ];
  }
  const left = Array.isArray(report.forYou) ? report.forYou.length : 0;
  return [
    `Merge in progress: ${quoted(report.branch).slice(1, -1)} <- ${quoted(report.trunk?.ref).slice(1, -1)}, ${left} ${left === 1 ? 'path' : 'paths'} left for you when it stopped: \`npx ddd-ts-kit merge-trunk --continue\` or \`--abort\`.`,
  ];
}

// The git directory of the checkout holding the root (its own in a linked worktree), read from .git.
function gitDirOf(root) {
  const top = repositoryTop(root);
  if (!top) {
    return undefined;
  }
  const dotGit = join(top, '.git');
  return isDirectory(dotGit) ? dotGit : resolve(top, /^gitdir:\s*(.+)$/m.exec(readText(dotGit, ''))?.[1] ?? '');
}

// What the guard could not take of the config as written: a mode it does not know, a file too large.
function configNotice(project) {
  if (project.tooLarge !== undefined) {
    return [
      `${CONFIG} holds ${Math.round(project.tooLarge / 1024)} KB, more than the ${CONFIG_BYTES / 1024} KB the guard reads: it judges nothing in this project until the config is smaller.`,
    ];
  }
  return project.unknownMode === undefined
    ? []
    : [`guard: ${quoted(project.unknownMode)} is not a mode (${GUARD_MODES.join(', ')}): enforce applies.`];
}

// A worktree of a project that already depends on the kit lacks its install, not the kit.
function installAdvice(project) {
  const manifest = readJson(join(project.root, 'package.json'));
  const listed = ['dependencies', 'devDependencies'].some((field) => manifest?.[field]?.['ddd-ts-kit'] !== undefined);
  if (listed) {
    return `The dependencies are not installed here: run \`${CLEAN_INSTALL[project.packageManager]}\`, never an install that names a package.`;
  }

  return `The CLI is not installed in this project: \`${project.packageManager === 'pnpm' ? 'pnpm add -D' : 'npm i -D'} ddd-ts-kit\`.`;
}

// The skills describe KIT_VERSION while the checks run the CLI the project installed, and the
// plugin is updated apart from the lockfile. A gap is said at session start, never blocked.
function versionGap(project) {
  const installed = project.cli?.version;
  if (typeof installed !== 'string' || compatible(installed, KIT_VERSION)) {
    return [];
  }
  const move = isOlder(installed, KIT_VERSION)
    ? `upgrade \`ddd-ts-kit\` and every \`@ddd-ts-kit/*\` package together (the steps: node_modules/ddd-ts-kit/CHANGELOG.md; then \`npx ddd-ts-kit doctor\` lists what the upgrade left to do), or use the plugin release written for ${installed}`
    : 'update the plugin';

  return [
    `Version gap: this plugin describes ddd-ts-kit ${KIT_VERSION}, the project has ${installed} installed. A skill may name an API or a rule that ${installed} does not have, and the checks follow ${installed}: ${move}.`,
  ];
}

// As a caret range: below 1.0.0 a minor version may break, from 1.0.0 a major one.
function compatible(installed, described) {
  const [have, want] = [releaseOf(installed), releaseOf(described)];
  return have[0] === want[0] && (have[0] !== 0 || have[1] === want[1]);
}

function isOlder(installed, described) {
  const [have, want] = [releaseOf(installed), releaseOf(described)];
  const differs = have.findIndex((part, index) => part !== want[index]);
  return differs !== -1 && have[differs] < want[differs];
}

function releaseOf(version) {
  return version.split(/[.+-]/, 3).map(Number);
}

function planPointer(root) {
  const plan = readText(join(root, PLAN));
  if (plan === undefined) {
    return [];
  }
  const next = /^Next:\s*(.+)$/m.exec(plan)?.[1];
  return [
    `Plan (${PLAN}): ${next ? quoted(next) : 'no next step stated, read the plan'}. Resume with /ddd-ts-kit:start.`,
  ];
}

// A text read from the repository (the plan, the files of a story through the CLI) said as data,
// never as a word of the guard: on one line, without backquote nor double quote, cut, never opening
// with the prefix of the guard's own decisions, between double quotes.
function quoted(text) {
  const flat = String(text)
    .replace(/[\p{Cf}`"]/gu, '')
    .replace(/[\s\p{Cc}]+/gu, ' ')
    .replace(/^(?:\s*ddd-ts-kit\s*:)+/i, '')
    .trim();
  return `"${flat.slice(0, QUOTED_LIMIT)}"`;
}

// The story of the worktree, by an id the CLI would take.
function storyOf(project) {
  return named(storyScope(project)?.story, STORY_ID);
}

// The scope file of a story worktree, read once a run like the config.
function storyScope(project) {
  if (!storyScopes.has(project.root)) {
    storyScopes.set(project.root, readJson(join(project.root, STORY_SCOPE)));
  }
  return storyScopes.get(project.root);
}

// A name read from the repository, when it follows its grammar; else nothing, and it is not repeated.
function named(value, grammar) {
  return typeof value === 'string' && grammar.test(value) ? value : undefined;
}

// In the worktree of a story: the story, its phase and its next step, so that a session resumes it.
function storyNotice(project) {
  const story = storyOf(project);
  if (story === undefined || project.mode === 'off' || !project.cli) {
    return [];
  }
  const phases = runCli(project, ['story', story, '--json'], 6000);
  if (!phases) {
    return [`Story ${story}: run \`npx ddd-ts-kit story ${story}\` for where it stands.`];
  }
  const done = phases.phases.filter(({ met }) => met).map(({ title }) => title);
  const kind = fixOf(project) === undefined ? ['Story', 'story'] : ['Fix', 'fix'];
  return [
    `${kind[0]} ${story} (skill ddd-ts-kit:${kind[1]}): ${done.length === 0 ? 'nothing done yet' : `done: ${done.join(', ')}`}. Next: ${phases.next ? quoted(phases.next) : 'its pull request'}`,
    ...meetingNotice(project),
  ];
}

// Where this story meets the other open ones and how far the trunk moved, at session start.
function meetingNotice(project) {
  const view = storiesOf(project)?.view;
  const own = view?.stories.find(({ story }) => story === view.here);
  if (!own) {
    return [];
  }
  const meetings = view.crossings.map(({ stories: [, other], contexts, files, merge }) => {
    const shown = contexts.filter((name) => named(name, CONTEXT_NAME));
    const parts = [
      ...(shown.length === 0 ? [] : [`contexts ${shown.join(', ')}`]),
      ...(files.length === 0 ? [] : [`${files.length} file(s) both change`]),
      ...((merge?.byHand.length ?? 0) === 0 ? [] : [`${merge.byHand.length} conflict(s) to settle by hand`]),
    ];
    const story = named(other, STORY_ID);
    return `It meets ${story ? `story ${story}` : 'another open story'}: ${parts.length === 0 ? 'conflicts merge-trunk settles' : parts.join(', ')}.`;
  });
  const trunk = own.trunk?.behind
    ? [
        `The trunk moved: ${own.trunk.behind} commit(s) of ${named(own.trunk.ref, GIT_REF) ?? 'the trunk'} to merge in${own.trunk.byHand.length === 0 ? '' : `, ${own.trunk.byHand.length} conflict(s) to settle by hand`}.`,
      ]
    : [];
  const fetched = view.fetched ? Date.parse(view.fetched) : undefined;
  if (fetched !== undefined && Date.now() - fetched > STALE_FETCH) {
    trunk.push(`The trunk is read as the fetch of ${new Date(fetched).toISOString()} left it: \`git fetch\` first.`);
  }
  return meetings.length + trunk.length === 0
    ? []
    : [...meetings, ...trunk, '`npx ddd-ts-kit stories` says where, before the rows are cut and before each row.'];
}

function workerNotice(project, input) {
  const context = workerContext(project, input);
  return context
    ? [
        `Worker scope: bounded context "${context}" only (${project.contextsDir}/${context}/, with Prisma its models in prisma/schema/${context}.prisma). Shared files belong to the conductor.`,
      ]
    : [];
}

// In the conductor's session, the workers whose agent stopped: one line each with the command
// that resumes it. Asked of the CLI only when a worktree of the repository holds a worker: a
// session without one starts no process for it.
function workersToResume(project) {
  if (project.mode === 'off' || !project.cli || existsSync(join(project.root, WORKER_SCOPE))) {
    return [];
  }
  if (!hasWorkerWorktree(project.root)) {
    return [];
  }
  const workers = runCli(project, ['status', '--workers', '--json'], 6000)?.workers ?? [];
  const stopped = workers.filter(
    ({ progress }) =>
      ['send-message', 'new-agent'].includes(progress?.next?.action) &&
      (progress.agent || progress.phase !== 'not started'),
  );
  return stopped.map((stoppedWorker) => resumeLine(stoppedWorker, workers));
}

// The line of a worker to resume, when each name it repeats follows its grammar: its worktree is
// needed only when it names the worker (no branch) or tells two workers of one context apart.
function resumeLine({ branch, context, worktree, progress }, workers) {
  const agent = progress.agent ? named(progress.agent.agentId, AGENT_ID) : '';
  const path = named(worktree, ABSOLUTE_PATH);
  const shown = branch === undefined ? path : named(branch, GIT_REF);
  const shared = workers.filter((other) => other.context === context).length > 1;
  const names = [named(context, CONTEXT_NAME), named(progress.phase, LABEL), agent, shown, shared ? path : ''];
  if (names.includes(undefined)) {
    return 'Worker to resume: one whose names the guard does not repeat: `npx ddd-ts-kit status --workers` lists it.';
  }
  const where = shared ? ` --worktree ${path.includes(' ') ? `'${path}'` : path}` : '';
  return `Worker to resume: ${shown} (${progress.phase}${agent ? `, agent ${agent}` : ''}): \`npx ddd-ts-kit worker-scope ${context} --resume${where}\`, then send what it prints.`;
}

// Read from git's own files, without running git: the worktrees of the repository listed under
// its common directory, each with the path of its checkout.
function hasWorkerWorktree(root) {
  const top = repositoryTop(root);
  const gitDir = gitDirOf(root);
  if (!top || !gitDir) {
    return false;
  }
  const common = resolve(gitDir, readText(join(gitDir, 'commondir'), '.').trim());
  const prefix = relative(top, root);
  let names;
  try {
    names = readdirSync(join(common, 'worktrees'));
  } catch {
    return false;
  }
  return names.some((name) => {
    const checkout = dirname(readText(join(common, 'worktrees', name, 'gitdir'), '').trim());
    return checkout !== '.' && existsSync(join(checkout, prefix, WORKER_SCOPE));
  });
}

function repositoryTop(from) {
  let directory = resolve(from);
  for (;;) {
    if (!isOwnFolder(directory)) {
      return undefined;
    }
    if (existsSync(join(directory, '.git'))) {
      return directory;
    }
    if (dirname(directory) === directory) {
      return undefined;
    }
    directory = dirname(directory);
  }
}

// A folder that only this user or the system writes: owned by this user or by root, and not writable
// by others. A folder not made yet is no other user's. Windows has no such owner: every folder is.
function isOwnFolder(directory) {
  const stat = statSync(directory, { throwIfNoEntry: false });
  return (
    WINDOWS || stat === undefined || ((stat.mode & 0o002) === 0 && (stat.uid === 0 || stat.uid === process.getuid()))
  );
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

// The text of a file, or `otherwise` when it cannot be read: missing, a folder, a device, larger than
// the guard reads, or not readable by this user.
function readText(path, otherwise) {
  return readBounded(path, STATE_BYTES).content ?? otherwise;
}

function contextMap(project) {
  const listing = runCli(project, ['list', '--json'], 8000);
  const text = (listing?.contexts ?? [])
    .filter((context) => named(context.name, CONTEXT_NAME))
    .map(contextLine)
    .join('\n');
  return text.length > SESSION_CONTEXT_LIMIT
    ? `${text.slice(0, SESSION_CONTEXT_LIMIT)}\n(truncated: run \`npx ddd-ts-kit list\` for the rest)`
    : text;
}

function contextLine(context) {
  const size = (key) => (context[key] ?? []).length;
  const upstreams =
    (context.upstreams ?? [])
      .map((upstream) => upstream.context ?? upstream)
      .filter((name) => named(name, CONTEXT_NAME))
      .join(', ') || 'none';
  const classification = named(context.classification, CONTEXT_NAME) ?? 'unclassified';

  return `${context.name} [${classification}] upstreams: ${upstreams}; glossary: ${context.glossary ?? 0} terms; ${size('aggregates')} aggregates, ${size('commands')} commands, ${size('queries')} queries, ${size('publishedEvents')} published events`;
}

function generatedFileReason(project, file) {
  const path = projectPath(project, file);
  if (GENERATED_DOCUMENT.test(path)) {
    return `${path} is generated. Change the route or event declaration, or "openapi" in ${CONFIG}, then run \`npm run docs:generate\`.`;
  }
  if (path === '.dependency-cruiser.cjs') {
    return `${path} is generated from ${CONFIG}. Change the config, then run \`npx ddd-ts-kit depcruise-config --write\`.`;
  }
  return isBarrel(project, path)
    ? `${path} holds generated declarations of its context. Never edit it: \`npx ddd-ts-kit generate ...\` and \`npx ddd-ts-kit docs\` rewrite it from the role files.`
    : undefined;
}

/**
 * The summary at the root of a context, the declarations of a layer, named after it
 * (application/application.declarations.ts), or those of a role folder an earlier version wrote,
 * named after the folder (application/commands/commands.declarations.ts): in the context, or in a
 * module of its model that the config declares.
 */
function isBarrel(project, path) {
  const [context, ...parts] = insideContexts(project, path) ?? [];
  if (parts.length === 1) {
    return parts[0] === `${context}.declarations.ts`;
  }
  const [layer, ...below] = outsideItsModule(project, context, parts);
  const folder = below.length === 2 ? below[0] : layer;
  return (
    ['application', 'infrastructure', 'presentation'].includes(layer) &&
    below.length <= 2 &&
    below.at(-1) === `${folder}.declarations.ts`
  );
}

/**
 * The path of a file inside its context, its module of the model left out, as the CLI reads it:
 * a module holds its layers (<module>/application/...) and a folder of the test folders of its specs
 * (test/unit/<module>/...); 0.86 and 0.87 put it under domain/ and application/ (application/<module>/...).
 */
function outsideItsModule(project, context, parts) {
  const modules = project.modules[context] ?? [];
  const [first, second, ...rest] = parts;
  if (modules.includes(first) && ['domain', 'application', 'infrastructure', 'presentation'].includes(second)) {
    return [second, ...rest];
  }
  if (first === 'test' && ['unit', 'integration'].includes(second) && modules.includes(rest[0])) {
    return [first, second, ...rest.slice(1)];
  }
  return (first === 'domain' || first === 'application') && modules.includes(second) ? [first, ...rest] : parts;
}

// By context name, in a map without prototype: a context named `constructor` or `__proto__` is a name.
function modulesByContext(contexts) {
  const modules = Object.create(null);
  for (const [name, context] of Object.entries(isRecord(contexts) ? contexts : {})) {
    modules[name] = isRecord(context?.modules) ? Object.keys(context.modules) : [];
  }
  return modules;
}

function insideContexts(project, path) {
  return path.startsWith(`${project.contextsDir}/`) ? path.slice(project.contextsDir.length + 1).split('/') : undefined;
}

function isTestWriter(input) {
  return String(input.agent_type ?? '').includes('domain-test-writer');
}

// A spec, the tests at the root of the project, or the test folders of a context: another folder
// named `test` holds no test of the kit.
function testWriterScopeReason(project, file, input) {
  if (!isTestWriter(input)) {
    return undefined;
  }
  const path = projectPath(project, file);
  const isTest =
    SPEC_FILE.test(path) || path.startsWith('test/') || (insideContexts(project, path) && TEST_DIRECTORY.test(path));
  return isTest
    ? undefined
    : `The test writer changes tests only. ${path} is production code: report the defect instead of editing it.`;
}

function workerScopeReason(project, file, input) {
  const scope = workerScope(project, input);
  return scope && (scope.changed ?? contextScopeReason(project, projectPath(project, file), scope.context));
}

// Why `path` of the project is outside the scope of a worker of `context`, if it is.
function contextScopeReason(project, path, context) {
  if (
    path.startsWith(`${project.contextsDir}/${context}/`) ||
    E2E_SPEC.test(path) ||
    path.startsWith(`test/e2e/support/${context}/`) ||
    path === WORKER_REPORT ||
    prismaSchemaContext(path) === context ||
    isWorkingMigration(project, path) ||
    isOwnDecisionRecord(project, path)
  ) {
    return undefined;
  }
  const owner =
    insideContexts(project, path) || prismaSchemaContext(path)
      ? 'belongs to another bounded context, which has its own worker'
      : 'is a shared file (config, composition root, platform, generated documents, migrations, dependencies) that only the conductor or a generator changes';

  return `You build the context "${context}": writes are limited to ${project.contextsDir}/${context}/, its models on Prisma (prisma/schema/${context}.prisma), its end-to-end specs and their support in test/e2e/support/${context}/. ${path} ${owner}. ${REPORT_TO_CONDUCTOR}`;
}

// The context whose models a file of the Prisma schema holds; the main file holds none.
function prismaSchemaContext(path) {
  const context = PRISMA_CONTEXT_SCHEMA.exec(path)?.[1];
  return context === 'schema' ? undefined : context;
}

// A record the worker generated and has not committed yet; the records of the trunk are not its to rewrite.
function isOwnDecisionRecord(project, path) {
  return DECISION_RECORD.test(path) && git(project, ['ls-files', '--', path]) === '';
}

function isWorkingMigration(project, path) {
  return !insideContexts(project, path) && !path.startsWith(`${project.platformDir}/`) && WORKING_MIGRATION.test(path);
}

// The context of a worker in this checkout; a pinned worker that strayed elsewhere has none here.
function workerContext(project, input) {
  const scope = workerScope(project, input);
  return scope?.away ? undefined : scope?.context;
}

function isWorkerAgent(input) {
  return String(input.agent_type ?? '').includes(WORKER_AGENT);
}

// The scope of a worker is pinned at its first call: its context and its worktree are recorded in
// the guard's folder of the session's checkout (the conductor's, which a worker does not write),
// keyed by session and agent, and every later call is judged against that record, read once per
// call of the guard. A scope file that disappeared or names another context, or the scope file of
// another worktree, makes `changed` the refusal of every call of the worker there. A checkout
// without a scope file (the conductor's, or the worktree of a story) leaves the worker `away`: it
// is the refusal of what it writes there, and its reads stay free.
function workerScope(project, input) {
  if (!isWorkerAgent(input)) {
    return undefined;
  }
  if (!scopes.has(project.root)) {
    scopes.set(project.root, pinnedScope(project, input));
  }
  return scopes.get(project.root);
}

// The worktree is recorded and compared by its real path: a link to it, or another spelling of it, is the same.
// A worker whose session stands in a scoped worktree is pinned to it, even when its first command
// starts in another project.
function pinnedScope(project, input) {
  const current = namedContext(project);
  const home = findProject(input.cwd ?? process.cwd()) ?? project;
  const pin = stateFile('scope', home, input);
  let pinned = readJson(pin);
  const worktree = realpathSync(project.root);
  if (!isPin(pinned)) {
    const own = current ? project : namedContext(home) && home;
    if (!own) {
      return undefined;
    }
    pinned = { context: namedContext(own), worktree: realpathSync(own.root), mode: own.mode };
    writeState(pin, pinned);
  }
  if (pinned.worktree !== worktree) {
    return current
      ? { context: current, changed: otherWorktreeReason(pinned, project) }
      : { context: pinned.context, changed: awayReason(pinned, project), away: true };
  }
  return current === pinned.context
    ? { context: current }
    : { context: pinned.context, changed: scopeChangedReason(pinned, current) };
}

// A worker's guard keeps the mode of its first call in its worktree: a config there that turns the
// guard off, or grows past what the guard reads, does not lift it, and its change is compared as any
// other change outside the scope.
function withPinnedMode(project, input) {
  if (project?.mode !== 'off' || !isWorkerAgent(input)) {
    return project;
  }
  const pinned = readJson(stateFile('scope', findProject(input.cwd ?? process.cwd()) ?? project, input));
  if (isPin(pinned) && pinned.worktree === realOf(project.root) && ['advise', 'enforce'].includes(pinned.mode)) {
    project.mode = pinned.mode;
  }
  return project;
}

// The context the scope file of the worktree names, or the environment of the guard.
function namedContext(project) {
  return named(
    process.env.DDD_TS_KIT_WORKER_CONTEXT ?? readJson(join(project.root, WORKER_SCOPE))?.context,
    CONTEXT_NAME,
  );
}

function isPin(value) {
  return isRecord(value) && typeof value.worktree === 'string' && named(value.context, CONTEXT_NAME) !== undefined;
}

function scopeChangedReason(pinned, current) {
  const now = current ? `names the context "${current}"` : 'is gone or names no context';
  return `The scope file changed: ${WORKER_SCOPE} of your worktree named the context "${pinned.context}" at your first call and now ${now}. Change nothing until it is back: report to the conductor, who restores it.`;
}

function otherWorktreeReason(pinned, project) {
  return `Your scope is the context "${pinned.context}" in the worktree ${pinned.worktree}, pinned at your first call: ${project.root} is the worktree of another worker. Report to the conductor.`;
}

function awayReason(pinned, project) {
  return `Your scope is the context "${pinned.context}" in the worktree ${pinned.worktree}, pinned at your first call: ${project.root} is not your worktree. Write the file by its absolute path under your worktree. ${REPORT_TO_CONDUCTOR}`;
}

// A builder that has no pin yet, writing in a checkout without a scope of a repository of worker
// worktrees: a path that forgot its worktree lands in the checkout of the conductor.
function strayWriteReason(project, input) {
  return isWorkerAgent(input) && !workerScope(project, input) && hasWorkerWorktree(project.root)
    ? `${project.root} holds no scope of a worker, and worker worktrees stand in this repository. Write the file by its absolute path under the worktree of your briefing. ${REPORT_TO_CONDUCTOR}`
    : undefined;
}

// The acceptance of a story is the contract its code is built against: its lock is written by the
// CLI only, which refuses a scenario changed without its criterion unless a reason is kept for the
// owner; a sub-agent never rewrites a scenario, it removes `pending(...)` once its rows pass it.
function acceptanceReason(project, input, { file, written, replaced }) {
  const path = projectPath(project, file);
  const judging = isJudge(input);
  if (judging || path.startsWith('test/acceptance/verdicts/')) {
    return judging === ACCEPTANCE_VERDICT.test(path) ? undefined : verdictReason(judging, path);
  }
  const held = lockedRegressionReason(project, path, input);
  if (held) {
    return held;
  }
  if (ACCEPTANCE_LOCK.test(path)) {
    return `${path} is the lock of a story's acceptance: \`npx ddd-ts-kit acceptance <story> --lock\` writes it, and refuses a change since the lock that no verdict of the acceptance-judge agent lets through.`;
  }
  if (!ACCEPTANCE_SPEC.test(path) || !input.agent_type) {
    return undefined;
  }
  const before = replaced.trim() === '' ? (readText(file) ?? '') : replaced;
  return existsSync(file) && asserted(written) === asserted(before)
    ? undefined
    : `${path} is the acceptance of a story, locked with its specification: a sub-agent only removes \`pending(...)\` around a scenario its rows now satisfy. A scenario that seems wrong is not changed to pass: name it and the criterion it fails in your report, and the conductor has the acceptance-judge agent judge it before anything changes. ${REPORT_TO_CONDUCTOR}`;
}

function isJudge(input) {
  return String(input.agent_type ?? '').includes(JUDGE_AGENT);
}

// The fix of the worktree, when its story.json says `kind: 'fix'` (absent, a story): its code, whether
// its lock is written, and the regression specs the lock lists, relative to the project.
function fixOf(project) {
  const story = storyOf(project);
  if (story === undefined || storyScope(project).kind !== 'fix') {
    return undefined;
  }
  const lock = join(project.root, 'test/acceptance', `${story.toLowerCase()}.acceptance.lock.json`);
  const files = (readJson(lock)?.regression ?? []).map((test) => test?.file).filter((file) => typeof file === 'string');
  return { story, locked: existsSync(lock), files: [...new Set(files)] };
}

// The regression spec of a fix, once locked, is the proof of the fix: a sub-agent never rewrites it. The
// main session of the fix may write a new version, as the main session of a story writes its acceptance:
// `acceptance <fix>` then reports the change since the lock, `--lock` refuses it until the acceptance-judge
// agent has ruled on that very version, and a change of layout alone (the fingerprint ignores white space)
// needs no verdict.
function lockedRegressionReason(project, path, input) {
  const fix = fixOf(project);
  return fix?.files.includes(path) && input.agent_type
    ? `${path} is a regression spec of fix ${fix.story}, locked: it is the proof of the fix, and a sub-agent does not change it. Fix the code instead, and if the spec seems wrong, name it and the statement it fails in your report: the main session of the fix writes a new version, runs \`npx ddd-ts-kit acceptance ${fix.story}\` (it reports the change since the lock with its subject and fingerprint), has the acceptance-judge agent rule on it with the statement of the fix (\`## Statement\` of docs/architecture/stories/${fix.story}.md) as the criterion, and locks again with \`--lock\` once the verdict is \`amend\`. ${REPORT_TO_CONDUCTOR}`
    : undefined;
}

function verdictReason(judging, path) {
  return judging
    ? `The acceptance judge writes its verdict and nothing else: test/acceptance/verdicts/<story>-<fingerprint>.md, not ${path}.`
    : `${path} is a verdict on a locked acceptance: the acceptance-judge agent alone writes it, so that a session never lets its own change through. Launch that agent with the subject and the fingerprint \`npx ddd-ts-kit acceptance <story>\` prints.`;
}

// Outside the judge, a command that names the lock or a verdict only reads it, versions it or runs the kit;
// the judge itself only reads, and writes its verdict with the editor tool. A command that names a locked
// regression spec of a fix may also run it, with a test runner; a sub-agent never rewrites it (the main session may).
function acceptanceFilesShellReason(project, input, { command, commands }) {
  const judging = isJudge(input);
  const written = writtenProjectPaths(project, commands);
  const fixFiles = input.agent_type ? (fixOf(project)?.files ?? []) : [];
  // Where only the shell knows the place, any held file may be it.
  const unnamed = fixFiles.length > 0 && writtenPlaces(commands).includes(undefined);
  // A command touches a held file by a place it writes (a glob expanded, a folder that holds the file)
  // or by naming it in text.
  const held = fixFiles.filter(
    (file) =>
      unnamed ||
      written.some((path) => holdsFile(path, file)) ||
      command.includes(file) ||
      command.includes(file.split('/').pop()),
  );
  // The lock and the verdicts, a folder that holds them, or a place only the shell knows on a line
  // that names the acceptance.
  const governed =
    written.some(isAcceptanceRecord) ||
    /acceptance\/verdicts|\.acceptance\.lock\.json/.test(command) ||
    (writtenPlaces(commands).includes(undefined) && command.includes('acceptance'));
  if (!judging && held.length === 0 && !governed) {
    return undefined;
  }
  if (!commands.some((simple) => isWriting(simple, { holding: held.length > 0, judging }))) {
    return undefined;
  }
  if (judging) {
    return 'The acceptance judge reads (git, cat, grep, the kit) and writes its verdict with the Write tool only.';
  }
  const [spec] = held;
  return spec === undefined
    ? 'The lock of an acceptance and its verdicts are written by `npx ddd-ts-kit acceptance <story> --lock` and by the acceptance-judge agent only; a command may read them, version them or run the kit.'
    : `${unnamed ? 'This command writes places only the shell knows: name each file. ' : ''}${lockedRegressionReason(project, spec, input)} A command may read it, version it or run it (\`npm test -- ${spec}\`).`;
}

function isAcceptanceRecord(path) {
  return (
    ACCEPTANCE_LOCK.test(path) ||
    path.startsWith('test/acceptance/verdicts/') ||
    ['test', 'test/acceptance', 'test/acceptance/verdicts'].includes(path)
  );
}

// A command that writes, its redirections and the places its writers name included: anything but a
// reader, or a test run or a read of a held spec. The judge runs the kit only to read.
function isWriting(simple, { holding, judging }) {
  const reads = judging ? readsOnly(simple) && judgeReads(simple) : readsOnly(simple);
  return (
    !(reads || (holding && (runsTests(simple) || readsAFile(simple)))) ||
    changedPaths(simple).length > 0 ||
    simple.redirects.some(({ operator, target }) => operator.includes('>') && target !== '/dev/null')
  );
}

// What the judge runs reads: git only through the subcommands that read, the kit only to read.
function judgeReads(simple) {
  const invocations = kitInvocations([simple]);
  if (invocations.length > 0) {
    return invocations.every(kitReads);
  }
  return shell.commandName(simple.words) !== 'git' || isPureReader(simple);
}

// Whether the path a command writes is `file`, or a folder that holds it (`.../{}`: what `find` finds under a folder).
function holdsFile(path, file) {
  const folder = path.replace(/(?:^|\/)\{\}$/, '');
  return folder === '' || file === folder || file.startsWith(`${folder}/`);
}

// A reader of the pure list, which writes nothing by its options either: `find -delete` does.
function readsAFile(simple) {
  return isPureReader(simple) && changedPaths(simple).length === 0;
}

// The places a command writes, by name, and the folders `find -exec` hands to a program the guard
// does not read as a writer; undefined where only the shell knows the place.
function writtenPlaces(commands) {
  return commands
    .flatMap((command) => [...writtenTargets(command), ...changedPaths(command), ...foundPlaces(command)])
    .map(({ place }) => place);
}

function foundPlaces(simple) {
  if (!simple.found || readsOnly(simple) || isPureReader(simple)) {
    return [];
  }
  return simple.words
    .filter((word) => word.includes('{}'))
    .map((word) => ({ place: shell.placeOf(word, simple.directory) }));
}

// The project paths a command writes, each glob expanded against the tree so a pattern that names a
// lock, a verdict or a held regression spec is seen, not only a path spelled out in the command.
function writtenProjectPaths(project, commands) {
  const paths = new Set();
  for (const place of writtenPlaces(commands).filter((written) => written !== undefined)) {
    for (const file of expandGlob(project, place)) {
      paths.add(projectPath(project, file));
    }
  }
  return [...paths];
}

// A pattern is walked inside the project only: one that starts outside it stays as written.
function expandGlob(project, place) {
  // A pattern matching nothing (globSync returns []) writes no file, so it protects nothing.
  return /[*?[]/.test(place) && place.startsWith(`${project.root}${sep}`) ? globSync(place) : [place];
}

// A command that writes no file by itself, its redirections aside: a neutral one (`cd`, `test`), a reader,
// `sed` without an in-place edit nor a script that writes, `awk` whose program writes nothing, `less` without a log.
function readsOnly(simple) {
  const { words } = simple;
  const name = shell.commandName(words);
  const args = words.slice(1);
  if (name === 'rg') {
    return !args.some((word) => word.startsWith('--pre'));
  }
  if (NEUTRAL_PROGRAMS.has(name) || READING_PROGRAMS.has(name)) {
    return true;
  }
  if (name === 'git') {
    const { subcommand, tail } = gitInvocation(args, undefined);
    const all = subcommand === 'commit' && tail.some((word) => /^-[^-]*a/.test(word) || word === '--all');
    return GIT_READS.has(subcommand) && !all && !words.some(runsAProgramOfGit) && simple.assigned.length === 0;
  }
  // `npx ddd-ts-kit ...`, `pnpm exec ddd-ts-kit ...`: a launcher of the kit reads the lock; `npx`
  // of anything else can write it.
  if (kitInvocations([{ words }]).length > 0) {
    return true;
  }
  if (name === 'sed') {
    return !inPlaceFlag(args) && !sedWrites(args);
  }
  if (AWK_PROGRAMS.has(name)) {
    return !args.some(
      (word) => /^(?:-[a-zA-Z]*[fEil]|--(?:file|exec|include|load))/.test(word) || /[>|@]|\bsystem\b/.test(word),
    );
  }
  return name === 'less' && !args.some((word) => /^(?:-[a-zA-Z]*[oO]|--log-file|--LOG-FILE)/.test(word));
}

// Whether a sed command writes a file or runs a command by its scripts: a script file, which cannot be read
// in advance, the commands `w`, `W` and `e`, the flags `w` and `e` of `s`. An address or a pattern is skipped.
function sedWrites(args) {
  if (args.some((word) => /^(?:-[a-zA-Z]*f|--file)/.test(word))) {
    return true;
  }
  const scripts = [];
  for (let index = 0; index < args.length; index += 1) {
    if (/^-[a-zA-Z]*e$/.test(args[index]) || args[index] === '--expression') {
      scripts.push(args[index + 1] ?? '');
      index += 1;
    } else if (args[index].startsWith('--expression=')) {
      scripts.push(args[index].slice('--expression='.length));
    }
  }
  const [first = ''] = shell.operands(args, ['-l', '--line-length']);
  return (scripts.length > 0 ? scripts : [first]).some(sedScriptWrites);
}

// The commands of a sed script, each address and pattern skipped: whether one writes a file or runs a command.
function sedScriptWrites(script) {
  const scan = { script, at: 0 };
  while (scan.at < script.length) {
    const char = script[scan.at];
    scan.at += 1;
    if ('wWe'.includes(char) || (char === 's' && substitutionWrites(scan))) {
      return true;
    }
    skipOperand(scan, char);
  }
  return false;
}

// `s/pattern/text/flags`: the flags `w` and `e` write a file or run a command.
function substitutionWrites(scan) {
  skipDelimited(scan, 2);
  const [flags] = /^[^;}\n]*/.exec(scan.script.slice(scan.at));
  scan.at += flags.length;
  return /[we]/.test(flags);
}

// What no command lies in: the pattern of an address, the text of `a`, `i`, `c`, the label or file of the others.
function skipOperand(scan, char) {
  if (char === '/') {
    scan.at -= 1;
    skipDelimited(scan, 1);
  } else if (char === '\\' || char === 'y') {
    skipDelimited(scan, char === 'y' ? 2 : 1);
  } else if ('aic'.includes(char)) {
    skipTo(scan, '\n');
  } else if (':btTrRqQlLv'.includes(char)) {
    skipTo(scan, ';\n');
  }
}

// From the delimiter at the cursor, past the `count` parts it closes, escapes included.
function skipDelimited(scan, count) {
  const delimiter = scan.script[scan.at];
  scan.at += 1;
  for (let part = 0; part < count; part += 1) {
    while (scan.at < scan.script.length && scan.script[scan.at] !== delimiter) {
      scan.at += scan.script[scan.at] === '\\' ? 2 : 1;
    }
    scan.at += 1;
  }
}

function skipTo(scan, ends) {
  while (scan.at < scan.script.length && !ends.includes(scan.script[scan.at])) {
    scan.at += 1;
  }
}

// `-i`, `-ni`, `--in-place`: an edit of the files given in place.
function inPlaceFlag(args) {
  return args.some((word) => (/^-[a-zA-Z]*i/.test(word) && !word.startsWith('--')) || word.startsWith('--in-place'));
}

// A test runner, however it is launched, as long as it runs no inline code of its own.
function runsTests(simple) {
  return RUNNING_PROGRAMS.has(shell.commandName(simple.words)) && !runsInlineCode(simple);
}

// What a scenario asserts, the wrapper `pending(...)`, white space, parentheses and commas aside.
function asserted(text) {
  return text.replace(/\bpending\b/g, '').replace(/[\s(),]/g, '');
}

// A sub-agent unwrapping a scenario writes outside its context: what it writes was judged above.
// A worker that strayed from its worktree unwraps nothing there.
function isUnwrapping(project, file, input) {
  return (
    Boolean(input.agent_type) && ACCEPTANCE_SPEC.test(projectPath(project, file)) && !workerScope(project, input)?.away
  );
}

function acceptanceLockingReason(input, commands) {
  if (!input.agent_type) {
    return undefined;
  }
  const locking = kitInvocations(commands).some(
    ({ subcommand, args }) => subcommand === 'acceptance' && args.includes('--lock'),
  );
  return locking
    ? 'Locking the acceptance of a story is a step of the conductor, once each change since the lock has its verdict. Report the scenario and the criterion it fails instead.'
    : undefined;
}

// In the worktree of a story, the code of a context waits until each row has its design review and
// the acceptance is written and locked (`ddd-ts-kit story --gate build`); the glossary of a context
// is part of the specification and stays open.
function storyCodeReason(project, file) {
  const path = projectPath(project, file);
  if (!insideContexts(project, path) || /(^|\/)CONTEXT\.md$/.test(path)) {
    return undefined;
  }
  // The proof of a fix, a spec inside the context, is written before its code.
  if (isTestPath(path) && fixOf(project) !== undefined) {
    return undefined;
  }
  return storyBuildReason(project);
}

/** A file under a test directory, or a spec next to the code: where the proof of a fix lives. */
function isTestPath(path) {
  return TEST_DIRECTORY.test(path) || SPEC_FILE.test(path);
}

// The code of a context is written in a worktree: the main checkout of the trunk refuses it
// (unless the config only advises it), and so does a worktree of .worktrees/ without its own
// dependencies, whose Node would resolve the packages of the main checkout above it.
function worktreeCodeReason(project, file) {
  const path = projectPath(project, file);
  if (!insideContexts(project, path) || /(^|\/)CONTEXT\.md$/.test(path)) {
    return undefined;
  }
  return worktreePlaceReason(project);
}

// A generator of code run where the code may not be written yet: before the build gate of a
// story, in the main checkout of the trunk, in a worktree without its own install.
function generatorPlaceReason(project, commands) {
  return storyGeneratorReason(project, commands) ?? worktreeGeneratorReason(project, commands);
}

// A fix writes its spec first: the generators of test files stay open before its lock.
function storyGeneratorReason(project, commands) {
  const aside =
    fixOf(project) === undefined ? ['acceptance', 'adr'] : ['acceptance', 'adr', 'builder', 'test-world', 'e2e'];
  return generates(commands, aside) ? storyBuildReason(project) : undefined;
}

// A run of a generator of the kit among `commands`, any kind but those given, its help and its dry run aside.
function generates(commands, aside) {
  return kitInvocations(commands).some(
    ({ subcommand, args }) =>
      ['generate', 'g'].includes(subcommand) &&
      args[0] !== undefined &&
      !aside.includes(args[0]) &&
      !args.includes('--help') &&
      !args.includes('--dry-run'),
  );
}

function worktreeGeneratorReason(project, commands) {
  return generates(commands, ['acceptance', 'adr', 'context', 'module']) ? worktreePlaceReason(project) : undefined;
}

function worktreePlaceReason(project) {
  if (borrowsDependencies(project)) {
    return `${project.root} is a worktree of ${WORKTREES_DIR}/ without its own node_modules: Node would resolve the packages of the main checkout above it, the versions of the trunk. Install it first: \`cd ${project.root} && ${CLEAN_INSTALL[project.packageManager]}\`.`;
  }
  const branch = project.worktrees === 'required' ? trunkCheckoutBranch(project) : undefined;
  return branch
    ? `This is the main checkout of the trunk (branch ${branch}): the code of a context is written in a worktree. Open one with \`npx ddd-ts-kit worktree <name>\` (a story: \`npx ddd-ts-kit story-scope <code>\`; a plan of several workers: skill ddd-ts-kit:parallel-work), then work there, every command \`cd <worktree> && ...\` and every file by its absolute path under it. \`"worktrees": "advised"\` in the config lifts this refusal.`
    : undefined;
}

// At session start: where the code of the contexts is written, when it is not here.
function worktreeNotice(project) {
  if (borrowsDependencies(project)) {
    return [worktreePlaceReason(project)];
  }
  const branch = trunkCheckoutBranch(project);
  if (!branch) {
    return [];
  }
  const where = `Main checkout of the trunk (branch ${branch}): the code of the contexts is written in a worktree`;
  const how =
    'open one with `npx ddd-ts-kit worktree <name>` (a story: `npx ddd-ts-kit story-scope <code>`) and work there.';
  return [project.worktrees === 'required' ? `${where}, refused here; ${how}` : `${where}; ${how}`];
}

function borrowsDependencies(project) {
  return project.root.split(sep).includes(WORKTREES_DIR) && !existsSync(join(project.root, 'node_modules'));
}

// The branch of the main checkout of its repository holding the project, when that branch is the
// trunk (the one origin/HEAD names, else main or master) and has a commit: read from .git, no git
// process. A linked worktree has a .git file, not a folder.
function trunkCheckoutBranch(project) {
  const top = repositoryTop(project.root);
  const git = top && join(top, '.git');
  if (!git || !isDirectory(git)) {
    return undefined;
  }
  const branch = /^ref: refs\/heads\/(.+)$/m.exec(readText(join(git, 'HEAD'), ''))?.[1];
  const remote = /^ref: refs\/remotes\/origin\/(.+)$/m.exec(readText(join(git, 'refs/remotes/origin/HEAD'), ''))?.[1];
  const trunk = remote ? branch === remote : ['main', 'master'].includes(branch);
  const born =
    existsSync(join(git, 'refs/heads', branch ?? '')) ||
    readText(join(git, 'packed-refs'), '').includes(` refs/heads/${branch}\n`);
  return trunk && born ? branch : undefined;
}

// In the worktree of a story, a write to a file another open story changes too, or that merging
// its branch would leave to a person: said once per session, file and story, without refusing it.
function crossingNotice(project, input, file) {
  const stories = storiesOf(project);
  const own = stories?.view.here;
  if (own === undefined) {
    return undefined;
  }
  const path = `${stories.prefix}${projectPath(project, file)}`;
  if (SETTLED_BY_MERGE.test(path)) {
    return undefined;
  }
  const lines = stories.view.stories
    .filter((other) => other.story !== own)
    .map((other) => ({ other, forYou: forYouWith(stories.view, own, other) }))
    .filter(({ other, forYou }) => other.files.includes(path) || forYou.includes(path))
    .filter(({ other }) => !alreadyRemembered(crossingMarker(project, input, `${path}\n${other.story}`)))
    .map(({ other, forYou }) => crossingLine(other, forYou, path));
  return lines.length === 0
    ? undefined
    : `${lines.join(' ')} Keep the change to what the row needs; \`npx ddd-ts-kit stories\` says where the stories meet, and the report records which one lands first.`;
}

// The files merging the branch of another story into this one now leaves to a person.
function forYouWith(view, own, other) {
  const crossing = view.crossings.find(({ stories }) => stories[0] === own && stories[1] === other.story);
  return (crossing?.merge?.byHand ?? []).map(({ file }) => file);
}

function crossingLine(other, forYou, path) {
  const [story, branch] = [named(other.story, STORY_ID), named(other.branch ?? 'detached', GIT_REF)];
  const worktree = named(other.worktree, ABSOLUTE_PATH);
  const where =
    story === undefined || branch === undefined
      ? 'Another open story'
      : `${story} (${worktree === undefined ? branch : `${branch}, ${worktree}`})`;
  return forYou.includes(path)
    ? `${where} changes ${path} too, and merging its branch into this one now leaves that file to settle by hand.`
    : `${where} changes ${path} too.`;
}

function crossingMarker(project, input, subject) {
  const key = createHash('sha256')
    .update(`${project.root}\n${sessionOf(input)}\n${subject}`)
    .digest('hex')
    .slice(0, 24);
  return markerOf(project, 'crossing', key);
}

// What `stories --json` says, read again once its copy in the guard's folder is a minute old,
// with the path of the project inside its repository: the files are named from its top.
function storiesOf(project) {
  if (!project.cli) {
    return undefined;
  }
  const cache = join(project.root, GUARD_STATE, 'stories.json');
  const cached = readJson(cache);
  if (cached && Date.now() - cached.at < STORIES_TTL) {
    return cached;
  }
  const view = runCli(project, ['stories', '--json'], 3000);
  const prefix = gitRun(project, ['rev-parse', '--show-prefix']);
  if (!view || prefix.status !== 0) {
    return undefined;
  }
  const fresh = { at: Date.now(), prefix: prefix.stdout.trim(), view };
  writeState(cache, fresh);
  return fresh;
}

function storyBuildReason(project) {
  const story = storyOf(project);
  if (story === undefined) {
    return undefined;
  }
  const fix = fixOf(project);
  if (fix !== undefined) {
    return fixBuildReason(fix);
  }
  if (!project.cli) {
    return undefined;
  }
  const cache = join(project.root, GUARD_STATE, 'story-gate.json');
  const key = storyInputsKey(project);
  if (readJson(cache)?.key === key) {
    return undefined;
  }
  const gate = runCli(project, ['story', story, '--gate', 'build', '--json'], 4000);
  if (gate === undefined || gate.met === true) {
    if (gate?.met === true) {
      writeState(cache, { key });
    }
    return undefined;
  }
  return `The code of story ${story} waits for its build gate: a design review section per row and the acceptance written and locked, before any code. Next: ${quoted(gate.next)} (\`npx ddd-ts-kit story ${story}\` shows every phase).`;
}

// The build gate of a fix is its proof: the regression spec written, listed and locked; no row, no review.
function fixBuildReason({ story, locked }) {
  return locked
    ? undefined
    : `The code of fix ${story} waits for its regression spec, locked: write the spec that reproduces the defect, see it fail on an assertion, list it under \`## Regression\` of docs/architecture/stories/${story}.md next to its \`## Statement\`, then \`npx ddd-ts-kit acceptance ${story} --lock\` (skill ddd-ts-kit:fix).`;
}

// The size and the time of change of every file the build gate of a story reads.
function storyInputsKey(project) {
  const hash = createHash('sha256');
  const entries = STORY_INPUTS.flatMap((input) => filesBelow(join(project.root, input))).map((file) => ({
    file,
    stat: statSync(file, { throwIfNoEntry: false }),
  }));
  // A file that vanished between the listing and the stat is left out.
  for (const { file, stat } of entries.filter((entry) => entry.stat !== undefined)) {
    hash.update(`${file}\0${stat.size}\0${stat.mtimeMs}\n`);
  }
  return hash.digest('hex');
}

function filesBelow(path) {
  if (!isDirectory(path)) {
    return existsSync(path) ? [path] : [];
  }
  return readdirSync(path)
    .sort()
    .flatMap((name) => filesBelow(join(path, name)));
}

function handWrittenRoleReason(project, file) {
  const path = projectPath(project, file);
  if (path.startsWith(`${project.sharedKernelDir}/`)) {
    return handWrittenSharedReason(path, existsSync(file));
  }
  if (
    existsSync(file) ||
    JOURNEY.test(path) ||
    isPartOfSpec(project, path) ||
    !(insideContexts(project, path) || path.startsWith('test/e2e/') || path.startsWith('test/acceptance/'))
  ) {
    return undefined;
  }
  if (/\.ports\.ts$/.test(path)) {
    return `${path} would be a file of tokens. A port is an abstract class and its own injection token, one per \`*.port.ts\`: \`npx ddd-ts-kit generate port <context> <Name> --json\`.`;
  }
  if (E2E_SPEC.test(path)) {
    return `${path} is a new end-to-end spec. The spec of a use case is generated: \`npx ddd-ts-kit generate e2e <context> <UseCase> --json\`. Two are written by hand: a part of a spec split by behaviour, named after the spec it comes from (test/e2e/<use-case>-<behaviour>.e2e.spec.ts beside test/e2e/<use-case>.e2e.spec.ts), and a journey across use cases (test/e2e/journey-<name>.e2e.spec.ts).`;
  }
  const generator = GENERATORS.find(([suffix]) => suffix.test(path));
  return generator
    ? `${path} is a new file of a generated role. Create it with \`npx ddd-ts-kit generate ${generator[1]} --json\`, then fill the TODO(domain) markers.${POLICY_FILE.test(path) ? DECLARATIONS_HOME : ''}`
    : undefined;
}

// A value object of the shared kernel and its refusals are generated as those of a context are.
function handWrittenSharedReason(path, exists) {
  const generator = exists ? undefined : SHARED_KERNEL_GENERATORS.find(([suffix]) => suffix.test(path));
  return generator
    ? `${path} is a new file of a generated role of the shared kernel. Create it with \`npx ddd-ts-kit generate ${generator[1]} --term "<Term>=<meaning>" --json\`, which also writes its term in the glossary of the shared kernel, then fill the TODO(domain) markers.`
    : undefined;
}

// A long end-to-end spec is split by behaviour: each part is named after the spec it comes from,
// `<use-case>-<behaviour>.e2e.spec.ts` beside `<use-case>.e2e.spec.ts`, which no generator can write.
function isPartOfSpec(project, path) {
  const words = E2E_SPEC.exec(path)?.[1].split('-') ?? [];
  return words
    .slice(1)
    .some((_, index) =>
      existsSync(join(project.root, 'test/e2e', `${words.slice(0, index + 1).join('-')}.e2e.spec.ts`)),
    );
}

// The scope file of a story or of a worker, and the kit's folder that holds it, are the conductor's:
// the session of the worktree that holds it, and every sub-agent, change them in no way, nor
// remove them with a folder above them (`below`: every file under the place, or 'untracked': those
// git does not ignore).
function scopeFileReason(project, { place, below }, input) {
  const path = projectPath(project, place);
  const held = [STORY_SCOPE, WORKER_SCOPE].find(
    (scope) =>
      existsSync(join(project.root, scope)) &&
      (path === scope || path === dirname(scope) || (holdsFile(path, scope) && reachesScope(project, scope, below))),
  );
  const own = input.agent_type || findProject(input.cwd ?? process.cwd())?.root === project.root;
  return held && own
    ? `${held} is a shared file of this worktree, its scope: the conductor writes it with \`story-scope\` or \`worker-scope\`, and it holds the gates of the work done here. ${REPORT_TO_CONDUCTOR}`
    : undefined;
}

// `git check-ignore` answers 1 for a file it does not ignore; out of a repository, git cleans nothing.
function reachesScope(project, scope, below) {
  return below === 'untracked' ? gitRun(project, ['check-ignore', '--quiet', scope]).status === 1 : below;
}

function baselineFileReason(project, file) {
  return BASELINE_FILE.test(projectPath(project, file)) ? `ddd-ts-kit-baseline.json: ${BASELINE_OWNER}` : undefined;
}

const HOOKS_LOCAL_GATE =
  'the hooks of the project (pre-commit, commit-msg, pre-push) are the local gate of the pipeline: they run the checks before a change leaves the machine. An agent never skips them; fix what the hook reports instead. If the hook itself is broken, report it to the project owner, who can skip it in a terminal.';
const HOOK_ENVIRONMENT = /^(?:LEFTHOOK|HUSKY)=(?:0|false)$/;
const HOOK_SKIPPING_COMMANDS = new Set(['commit', 'push', 'merge', 'pull', 'rebase', 'am', 'cherry-pick', 'revert']);
// Options of `git` that take their value as the next word, and those of `git commit` that do.
const GIT_VALUED_OPTIONS = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace', '--config-env']);
const COMMIT_VALUED_OPTIONS = new Set(['-m', '-F', '-C', '-c', '-t', '--message', '--file', '--author', '--date']);

// A git command that skips the hooks of the project: `--no-verify` (and `-n` on a commit),
// `-c core.hooksPath=...`, or `LEFTHOOK=0` / `HUSKY=0` set for the command.
function hooksSkippedReason(commands) {
  const gits = commands.filter(({ words }) => shell.commandName(words) === 'git');
  if (gits.length === 0) {
    return undefined;
  }
  const variables = commands.flatMap(exportedVariables);
  if (variables.some((word) => HOOK_ENVIRONMENT.test(word))) {
    return `LEFTHOOK=0 or HUSKY=0 turns the hooks off for a git command: ${HOOKS_LOCAL_GATE}`;
  }
  if (variables.some((word) => HOOK_SELECTION.test(word))) {
    return `${variables.find((word) => HOOK_SELECTION.test(word)).split('=')[0]} skips hooks of the project: ${HOOKS_LOCAL_GATE}`;
  }
  if (variables.some((word) => /^GIT_CONFIG_(?:KEY_\d+|PARAMETERS)=.*core\.hookspath/i.test(word))) {
    return `a setting of core.hooksPath in the environment points git at other hooks: ${HOOKS_LOCAL_GATE}`;
  }
  for (const { words } of gits) {
    const skipped = hooksSkippedBy(words);
    if (skipped) {
      return `${skipped}: ${HOOKS_LOCAL_GATE}`;
    }
  }
  return undefined;
}

function hooksSkippedBy(words) {
  let index = 1;
  while (index < words.length && words[index].startsWith('-')) {
    if (optionPointsAtHooks(words[index], words[index + 1])) {
      return '`git -c core.hooksPath` points git at other hooks';
    }
    index += GIT_VALUED_OPTIONS.has(words[index]) ? 2 : 1;
  }
  return hooksSkippedBySubcommand(words[index], words.slice(index + 1));
}

function optionPointsAtHooks(word, next) {
  const configured = word === '-c' || word === '--config-env' ? next : /^--config-env=(.*)$/.exec(word)?.[1];
  return configured !== undefined && /^core\.hookspath\b/i.test(configured);
}

function hooksSkippedBySubcommand(subcommand, rest) {
  if (subcommand === 'config' && rest.some((word) => /^core\.hookspath$/i.test(word))) {
    return '`git config core.hooksPath` points git at other hooks';
  }
  if (subcommand === 'commit-tree') {
    return '`git commit-tree` makes a commit without the hooks';
  }
  if (!HOOK_SKIPPING_COMMANDS.has(subcommand)) {
    return undefined;
  }
  for (let position = 0; position < rest.length; position++) {
    const word = rest[position];
    if (word === '--') {
      return undefined;
    }
    if (word.startsWith('--no-ve') && '--no-verify'.startsWith(word)) {
      return `\`git ${subcommand} --no-verify\` skips the hooks`;
    }
    if (subcommand === 'commit' && COMMIT_VALUED_OPTIONS.has(word)) {
      position++;
    } else if (subcommand === 'commit' && /^-[^-mFCct]*n/.test(word)) {
      return '`git commit -n` is `--no-verify`, it skips the hooks';
    }
  }
  return undefined;
}

// Config keys a sub-agent must not set: each runs a command in every checkout of the repository
// (fsmonitor, pager, editor, sshCommand, hooksPath, an alias, a diff or filter driver, gpg).
// A sub-agent never deletes, moves or resets a branch checked out in another worktree of the
// repository: the branch of another worker, or the trunk of the conductor.
function otherBranchReason(input, commands) {
  if (!input.agent_type) {
    return undefined;
  }
  const cwd = input.cwd ?? process.cwd();
  for (const simple of commands) {
    const names = rewrittenBranches(simple.words);
    const taken =
      names.length > 0 ? names.find((name) => otherWorktreeBranches(simple.directory ?? cwd).has(name)) : undefined;
    if (taken) {
      return `A sub-agent never deletes, moves or resets the branch of another worktree: \`${taken}\` is checked out in another worktree of the repository. ${REPORT_TO_CONDUCTOR}`;
    }
  }
  return undefined;
}

// The branches `git branch` deletes, moves, copies (both names) or resets (the first operand).
function rewrittenBranches(words) {
  const { subcommand, tail } = gitInvocation(words.slice(1));
  if (shell.commandName(words) !== 'git' || subcommand !== 'branch') {
    return [];
  }
  const names = shell.operands(tail);
  if (hasBranchOption(tail, [...BRANCH_DELETES, ...BRANCH_MOVES])) {
    return names;
  }
  return hasBranchOption(tail, BRANCH_RESETS) ? names.slice(0, 1) : [];
}

// Whether a word of `tail` gives one of the options, as git reads them: short ones bundled (`-fm`),
// long ones cut to a prefix (`--mov`).
function hasBranchOption(tail, options) {
  return tail.some((word) =>
    options.some((option) =>
      option.startsWith('--')
        ? word.length > 2 && option.startsWith(word.split('=')[0])
        : /^-[a-zA-Z]+$/.test(word) && word.includes(option[1]),
    ),
  );
}

// The branches checked out in the worktrees of the repository of `directory`, but its own.
function otherWorktreeBranches(directory) {
  const checkout = { root: directory };
  const own = git(checkout, ['rev-parse', '--show-toplevel'])?.trim();
  const blocks = gitFields(checkout, ['worktree', 'list', '--porcelain'], '\n\n');
  return new Set(
    blocks
      .filter((block) => block.split('\n')[0] !== `worktree ${own}`)
      .flatMap((block) => /^branch refs\/heads\/(.+)$/m.exec(block)?.slice(1) ?? []),
  );
}

const DANGEROUS_CONFIG = [
  /^core\.(?:fsmonitor|pager|editor|sshcommand|hookspath|attributesfile|gitproxy|askpass)$/i,
  /^alias\./i,
  /^diff\.external$/i,
  /^diff\..+\.(?:command|textconv)$/i,
  /^merge\..+\.driver$/i,
  /^filter\./i,
  /^gpg\.(?:.+\.)?program$/i,
  /^include(?:if\..+)?\.path$/i,
  /^credential\.(?:.+\.)?helper$/i,
  /^sequence\.editor$/i,
  /^interactive\.difffilter$/i,
  /^pager\./i,
  /^(?:merge|diff)tool\./i,
  /^protocol\./i,
  /^remote\..+\.(?:uploadpack|receivepack)$/i,
  /^uploadpack\.packobjectshook$/i,
];
const CONFIG_READS = new Set(['--get', '--get-all', '--get-regexp', '--get-urlmatch', '-l', '--list', '--list-all']);
const CONFIG_WRITES = new Set([
  '--unset',
  '--unset-all',
  '--remove-section',
  '--rename-section',
  '-e',
  '--edit',
  '--replace-all',
  '--add',
]);
// The verbs of `git config` (git 2.46), each with whether it changes the configuration.
const CONFIG_VERBS = new Map([
  ['get', false],
  ['list', false],
  ['get-color', false],
  ['get-colorbool', false],
  ['set', true],
  ['unset', true],
  ['edit', true],
  ['rename-section', true],
  ['remove-section', true],
]);

// A sub-agent never sets the git configuration (shared by every checkout of the repository) nor
// passes a dangerous `-c key=value`; it reads the config with `--get` or `--list`.
function gitConfigReason(input, commands) {
  if (!input.agent_type) {
    return undefined;
  }
  const variable = commands.flatMap(exportedVariables).find((word) => GIT_PROGRAM_VARIABLES.test(word));
  if (variable) {
    return `\`${variable.split('=')[0]}\` hands git a program or settings to run it: a sub-agent sets none. ${REPORT_TO_CONDUCTOR}`;
  }
  for (const { words } of commands.filter((simple) => shell.commandName(simple.words) === 'git')) {
    const reason = gitConfigKeyReason(words);
    if (reason) {
      return reason;
    }
  }
  return undefined;
}

// The variables a command sets for itself, and those `export`, `declare` or `typeset` set for the rest of the line.
function exportedVariables({ words, assigned }) {
  return ['export', 'declare', 'typeset'].includes(shell.commandName(words)) ? [...assigned, ...words] : assigned;
}

function gitConfigKeyReason(words) {
  const inline = words
    .map((word, index) =>
      ['-c', '--config-env'].includes(words[index - 1]) ? word : /^--config-env=(.*)$/.exec(word)?.[1],
    )
    .find((setting) => setting !== undefined && isDangerousConfig(setting.split('=')[0]));
  if (inline) {
    const key = inline.split('=')[0];
    return `\`git -c ${key}\` runs a command in every checkout of the repository. ${REPORT_TO_CONDUCTOR}`;
  }
  const { subcommand, tail } = gitInvocation(words.slice(1), undefined);
  return subcommand === 'config' && setsConfig(tail)
    ? `\`git config\` changes the git configuration, shared by every checkout; a sub-agent reads it (\`--get\`, \`--list\`) but never sets it. ${REPORT_TO_CONDUCTOR}`
    : undefined;
}

function isDangerousConfig(key) {
  return DANGEROUS_CONFIG.some((pattern) => pattern.test(key));
}

// Decided by the verb (`git config get|list|set|unset|edit ...`, git 2.46) or the flag of the older
// form (`--get`, `--list`; `--unset`, `--add`, `--edit`, ...); without either, `<key> <value>` sets.
function setsConfig(tail) {
  if (tail.some((word) => CONFIG_WRITES.has(word))) {
    return true;
  }
  if (tail.some((word) => CONFIG_READS.has(word))) {
    return false;
  }
  const operands = shell.operands(tail, ['--type', '-t', '--file', '-f', '--default']);
  if (CONFIG_VERBS.has(operands[0])) {
    return CONFIG_VERBS.get(operands[0]);
  }
  return operands.length >= 2;
}

// However the kit is launched, a package script of the project included, read on the words of the command.
function baselineWriteReason(project, commands) {
  const runs = [...commands, ...commands.flatMap((command) => scriptCommands(project, command))];
  return kitInvocations(runs).some(({ subcommand, args }) => subcommand === 'check' && writesBaseline(args))
    ? `check --baseline write records ddd-ts-kit-baseline.json: ${BASELINE_OWNER}`
    : undefined;
}

function writesBaseline(args) {
  return args.some(
    (word, index) => word === '--baseline=write' || (word === '--baseline' && args[index + 1] === 'write'),
  );
}

// What a package script runs, `npm run <script>` or `pnpm <script>`, with the words given after its name.
function scriptCommands(project, { words, directory }) {
  if (!SCRIPT_MANAGERS.includes(shell.commandName(words))) {
    return [];
  }
  const args = words.slice(1);
  const at = args.findIndex((word) => !word.startsWith('-') && !['run', 'run-script'].includes(word));
  const text = readJson(join(project.root, 'package.json'))?.scripts?.[args[at]];
  const given = args.slice(at + 1).filter((word) => word !== '--');
  return typeof text === 'string' ? shell.simpleCommands([text, ...given].join(' '), directory) : [];
}

// With dependenciesBeforeWrite, the lines a write adds to a TypeScript file, those it did not hold
// before, are judged by the dependency rules before they reach the disk: a new import that breaks
// one is refused with the message of the checker. An import the file already held is left to the
// check after the write. A slow or failing check lets the write through.
function dependencyReason(project, { file, written, replaced }, input) {
  const added =
    project.dependenciesBeforeWrite && project.cli && /\.(ts|mts|cts)$/.test(file) && newLines(file, written, replaced);
  if (!added || !/\bimport\b|\brequire\(/.test(added)) {
    return undefined;
  }
  // A directory of its own, readable by this user only: never a predictable name in the shared temp dir.
  const directory = mkdtempSync(join(tmpdir(), 'ddd-ts-kit-before-write-'));
  const text = join(directory, 'written.ts');
  writeFileSync(text, added, { mode: 0o600 });
  try {
    const rules = DEPENDENCY_RULES.flatMap((rule) => ['--rule', rule]);
    const started = Date.now();
    const report = runCli(project, ['check-file', file, '--content-from', text, ...rules, '--json'], 4000);
    const ms = Date.now() - started;
    if (!Array.isArray(report?.violations)) {
      // A CLI older than --content-from, a timeout, a crash: not judged, and recorded as such.
      recordTrial(project, { file, ms, host: hostOf(input), unjudged: report?.error?.message ?? 'no report' });
      return undefined;
    }
    const errors = errorsOf(report);
    recordTrial(project, { file, refused: [...new Set(errors.map((error) => error.ruleId))], ms, host: hostOf(input) });
    return errors.length > 0
      ? `this write adds ${errors.length} import(s) a dependency rule refuses, so it was not written (dependenciesBeforeWrite, on trial). Write it without them.\n${describe(errors)}`
      : undefined;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

// The trial is decided on what it did: each judged write is a line of the record of the repository,
// in its git directory, which every worktree shares and none commits. A record that cannot be written
// is skipped.
function recordTrial(project, { file, ...outcome }) {
  try {
    const common = gitRun(project, ['rev-parse', '--git-common-dir']);
    if (common.status !== 0) {
      return;
    }
    const directory = join(resolve(project.root, common.stdout.trim()), 'ddd-ts-kit');
    mkdirSync(directory, { recursive: true });
    const entry = { at: new Date().toISOString(), file: projectPath(project, file), ...outcome };
    // Appended through no link: a link put under the name of the record is never followed.
    const descriptor = openSync(join(directory, 'before-write.jsonl'), RECORD_APPEND, 0o600);
    try {
      writeSync(descriptor, `${JSON.stringify(entry)}\n`);
    } finally {
      closeSync(descriptor);
    }
  } catch {
    // The record serves the verdict of the trial, never the write.
  }
}

// The lines of the written text the file did not hold: an Edit is compared with the text it replaces,
// a Write with the file on disk.
function newLines(file, written, replaced) {
  const held = replaced.trim() !== '' ? replaced : existsSync(file) ? readFileSync(file, 'utf8') : '';
  const before = held.split('\n');
  const left = new Map();
  for (const line of before) {
    left.set(line, (left.get(line) ?? 0) + 1);
  }
  return written
    .split('\n')
    .filter((line) => {
      const held = left.get(line) ?? 0;
      left.set(line, held - 1);
      return held <= 0;
    })
    .join('\n');
}

function governedFileReason(project, file) {
  const path = projectPath(project, file);
  return GOVERNED_FILES.some((pattern) => pattern.test(path))
    ? `${path} holds the rules or the pipeline. Changing it is a decision of the project owner: confirm it, and record the reason in docs/adr/ when it relaxes a rule.`
    : undefined;
}

function escapeReason(written, replaced) {
  const added = ESCAPES.find(([pattern]) => count(written, pattern) > count(replaced, pattern));
  return added
    ? `This change adds ${added[1]}. Fix the cause instead; if the deviation is deliberate, the project owner confirms it and it carries a reason pointing to a decision record in docs/adr/.`
    : undefined;
}

// The fields of Claude Code (`content`, `new_string`, `edits`), then those of Copilot (`file_text`, `new_str`).
function writtenText(tool) {
  const edits = Array.isArray(tool.edits) ? tool.edits.map((edit) => edit.new_string ?? '') : [];
  return [tool.content ?? '', tool.new_string ?? '', tool.file_text ?? '', tool.new_str ?? '', ...edits].join('\n');
}

function replacedText(tool) {
  const edits = Array.isArray(tool.edits) ? tool.edits.map((edit) => edit.old_string ?? '') : [];
  return [tool.old_string ?? '', tool.old_str ?? '', ...edits].join('\n');
}

function count(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

// A sub-agent keeps the working directory of its session: its worktree shows in the command.
function commandDirectory(command, cwd) {
  const named =
    /--cwd[= ]\s*("[^"]+"|'[^']+'|\S+)/.exec(command) ??
    /^\s*(?:cd|pushd)\s+("[^"]+"|'[^']+'|[^\s;&|]+)\s*&&/.exec(command);
  const directory = named?.[1]?.replace(/^["']|["']$/g, '');
  if (!directory) {
    return cwd;
  }

  return isAbsolute(directory) ? directory : resolve(cwd, directory);
}

// `worker-scope` adds a worktree and a branch: the conductor's to place, from the trunk. A sub-agent
// reads a briefing (`--dry-run`) or where a worker stands (`--resume`): both create nothing.
function workerPlaceReason(input, commands) {
  if (!input.agent_type) {
    return undefined;
  }
  const preparing = kitInvocations(commands).some(
    ({ subcommand, args }) =>
      (subcommand === 'worker-scope' && !args.some((arg) => /^--(?:dry-run|resume)\b/.test(arg))) ||
      (subcommand === 'story-scope' && !args.includes('--dry-run')),
  );
  return preparing
    ? 'Only the conductor prepares the place of a worker or of a story: `worker-scope` and `story-scope` add a git worktree and a branch. A sub-agent reads a briefing with `worker-scope <context> --dry-run`, or where a worker stands with `--resume`, which create nothing; if a worker is missing, report it to the conductor.'
    : undefined;
}

// `merge-trunk --to-land` gives the working migrations of a branch their real names just before its
// squash merge: the conductor's step. A sub-agent brings the trunk in with `merge-trunk` alone,
// however it launches the CLI.
function landingReason(input, commands) {
  if (!input.agent_type) {
    return undefined;
  }
  const landing = kitInvocations(commands).some(
    ({ subcommand, args }) => subcommand === 'merge-trunk' && args.includes('--to-land'),
  );
  return landing
    ? 'Only the conductor lands a branch: `merge-trunk --to-land` gives the working migrations their real names just before the squash merge. A worker brings the trunk in with `npx ddd-ts-kit merge-trunk` alone; report to the conductor that the branch is ready to land.'
    : undefined;
}

// A worker's git changes its own worktree: from any other checkout it only reads. The conductor lands
// a branch and moves its checkout, and a sibling's worktree and the refs of the repository are not a worker's.
function workerGitReason(project, input, commands) {
  if (!isWorkerAgent(input)) {
    return undefined;
  }
  const own = ownWorktree(project, input);
  if (own === undefined && !hasWorkerWorktree(project.root)) {
    return undefined;
  }
  for (const { words, directory } of commands.filter((simple) => shell.commandName(simple.words) === 'git')) {
    const { subcommand, tail, moved } = gitInvocation(words.slice(1), directory);
    if (changesRepository(subcommand, tail)) {
      return `\`git ${subcommand}\`: the worktrees and the refs of the repository are the conductor's. ${REPORT_TO_CONDUCTOR}`;
    }
    if (!readsAnywhere(subcommand, tail) && !isOwnCheckout(own, moved)) {
      return `\`git ${subcommand}\` runs in ${moved ?? 'a place only the shell knows'}, not in your worktree: only the conductor lands a branch or moves its checkout. Run it as \`cd <worktree> && ...\`, and report to the conductor that the branch is ready.`;
    }
    const branch = () => workerBranch(own ?? findProject(moved).root);
    if (leavesOwnBranch(subcommand, tail, { moved, branch })) {
      const where = branch() === undefined ? 'its own branch' : `its branch \`${branch()}\``;
      return `\`git ${subcommand}\`: a worker's git keeps to ${where}: it pushes that branch alone, without force nor deletion, fetches into no ref, makes no tag, and checks out no other branch nor creates one; the trunk and the other refs are the conductor's. ${REPORT_TO_CONDUCTOR}`;
    }
  }
  return undefined;
}

// The branch of a worker: the one its scope file records, else the one its worktree has checked out.
function workerBranch(root) {
  const recorded = named(readJson(join(root, WORKER_SCOPE))?.branch, GIT_REF);
  return recorded ?? named(git({ root }, ['symbolic-ref', '--quiet', '--short', 'HEAD'])?.trim(), GIT_REF);
}

// A push of another ref than the worker's branch, forced or deleting; a fetch into a ref; a tag; a
// checkout or a switch to another branch, a new one or none. `branch` is read only when a ref is named.
function leavesOwnBranch(subcommand, tail, { moved, branch }) {
  if (subcommand === 'fetch') {
    return shell
      .operands(tail, FETCH_VALUED)
      .slice(1)
      .some((spec) => spec.includes(':'));
  }
  if (subcommand === 'tag') {
    return shell.operands(tail, TAG_VALUED).length > 0 && !tail.some((word) => TAG_LISTS.test(word));
  }
  if (subcommand === 'push') {
    return (
      tail.some((word) => PUSH_OTHER_REFS.test(word) || /^-[a-zA-Z46]*[fd]/.test(word)) ||
      shell
        .operands(tail, PUSH_VALUED)
        .slice(1)
        .some((spec) => !pushesOwnBranch(spec, branch))
    );
  }
  if (subcommand === 'checkout' || subcommand === 'switch') {
    const target = switchTarget(subcommand, tail, moved);
    return (
      tail.some((word) => SWITCH_CREATES[subcommand].test(word)) ||
      (target !== undefined && ![branch(), `refs/heads/${branch()}`].includes(target))
    );
  }
  return false;
}

// A refspec of a push that names the worker's branch as its destination, or the current branch alone.
function pushesOwnBranch(spec, branch) {
  const [source, destination] = spec.split(':');
  if (spec.startsWith('+') || source === '') {
    return false;
  }
  const target = destination ?? source;
  return (
    (destination === undefined && ['HEAD', '@'].includes(target)) ||
    [branch(), `refs/heads/${branch()}`].includes(target)
  );
}

// The branch a checkout or a switch moves to: for a checkout, its one operand that names no file of
// the tree, unless an option gives paths (`--ours`, `--theirs`, `--patch`, `--pathspec-from-file`).
function switchTarget(subcommand, tail, moved) {
  const named = shell.operands(tail, SWITCH_VALUED);
  if (subcommand === 'switch') {
    return named[0];
  }
  const paths = tail.includes('--') || tail.some((word) => CHECKOUT_PATHS.test(word));
  return paths || named.length !== 1 || existsSync(resolve(moved, named[0])) ? undefined : named[0];
}

// The worktree a worker is pinned to, or the one its command stands in, before its first call is over.
function ownWorktree(project, input) {
  const pinned = readJson(stateFile('scope', findProject(input.cwd ?? process.cwd()) ?? project, input));
  if (isPin(pinned)) {
    return pinned.worktree;
  }
  return namedContext(project) ? realpathSync(project.root) : undefined;
}

// Whether git runs in the worktree of the worker, under any folder of it; a worker not pinned yet
// has every checkout that holds a scope.
function isOwnCheckout(own, place) {
  if (place === undefined) {
    return false;
  }
  if (own !== undefined) {
    return repositoryTop(realOf(place)) === repositoryTop(own);
  }
  const checkout = findProject(place);
  return checkout !== undefined && namedContext(checkout) !== undefined;
}

function realOf(path) {
  try {
    return realpathSync(path);
  } catch {
    // Not there yet: where it would be is judged as it is spelled.
    return path;
  }
}

function changesRepository(subcommand, tail) {
  return (
    subcommand === 'update-ref' ||
    (subcommand === 'worktree' && ['remove', 'move', 'prune'].includes(tail[0])) ||
    (subcommand === 'symbolic-ref' &&
      (shell.operands(tail).length > 1 || tail.some((word) => /^(?:-d|--delete)$/.test(word))))
  );
}

function readsAnywhere(subcommand, tail) {
  if (subcommand === 'branch') {
    return listsBranches(tail);
  }
  if (subcommand in GIT_READING_FORMS) {
    return GIT_READING_FORMS[subcommand].includes(shell.operands(tail)[0]);
  }
  return subcommand === undefined || GIT_READS_ANYWHERE.has(subcommand);
}

// Each run of the CLI of the kit in `commands`, however it is launched: the `ddd-ts-kit` binary
// (`npx`, `npm exec`, `pnpm exec`, `bunx`, `node_modules/.bin`), the entry file of the CLI run by
// node (`.../cli/dist/bin.js`, `.../ddd-ts-kit/dist/bin.js`) or the kit script of a project.
function kitInvocations(commands) {
  return commands.flatMap(({ words }) => {
    const at = launcherAt(words);
    if (at === -1) {
      return [];
    }
    const rest = words.slice(at + 1).filter((word) => word !== '--');
    // The value of `--cwd`, the option of the kit that comes before a subcommand, is none.
    const index = rest.findIndex((word, position) => !word.startsWith('-') && rest[position - 1] !== '--cwd');
    return index === -1 ? [] : [{ subcommand: rest[index], args: rest.slice(index + 1) }];
  });
}

// The launcher is the program, or the first operand of a package runner or of node without inline
// code: a word among the arguments of another program launches nothing.
function launcherAt(words) {
  if (words.length > 0 && isKitLauncher(words[0])) {
    return 0;
  }
  const name = shell.commandName(words);
  const skipped = SCRIPT_MANAGERS.includes(name) && ['exec', 'dlx', 'x'].includes(words[1]) ? 2 : 1;
  const runs = ['npx', 'pnpx', 'bunx', 'node', 'nodejs', 'pnpm', 'yarn'].includes(name) || skipped === 2;
  if (!runs || words.slice(1).some((word) => INLINE_CODE.node.test(word))) {
    return -1;
  }
  const [first] = shell.operands(words.slice(skipped), LAUNCHER_VALUED);
  const node = name === 'node' || name === 'nodejs';
  return first !== undefined && isKitLauncher(first) && (!node || first.includes('/'))
    ? words.indexOf(first, skipped)
    : -1;
}

function isKitLauncher(word) {
  const name = word.split('/').pop();
  return (
    /^ddd-ts-kit(?:@\S+)?$/.test(name) ||
    /(?:^|\/)(?:cli|ddd-ts-kit)\/dist\/bin\.[cm]?js$/.test(word) ||
    /(?:^|\/)scripts\/kit\.mjs$/.test(word)
  );
}

// Taking one side of a merge erases what the other side added without a conflict: a sub-agent
// resolves each hunk instead. A derived file outside the sources (openapi/, the context map) is
// taken from either side and regenerated, so only the sources and the tests are held.
function oneSideMergeReason(project, input, commands) {
  if (!input.agent_type) {
    return undefined;
  }
  const taken = commands.some(({ words, directory }) => {
    const { subcommand, tail, moved } = gitInvocation(words.slice(1), directory);
    if (shell.commandName(words) !== 'git') {
      return false;
    }
    if (['merge', 'pull', 'rebase', 'cherry-pick', 'revert'].includes(subcommand)) {
      return takesOneSide(tail);
    }
    return (
      ['checkout', 'restore'].includes(subcommand) &&
      tail.some((word) => /^--(?:ours|theirs)$/.test(word)) &&
      heldPaths(project, moved, tail)
    );
  });
  return taken
    ? 'Taking one side of a merge (`-X theirs`, `-X ours`, `-s ours`, `checkout` or `restore --theirs/--ours` on a source or a test) erases what the other side added, without a conflict to show it. Bring the trunk in with `npx ddd-ts-kit merge-trunk`: it settles the derived files itself; resolve each hunk it leaves keeping the intent of both sides, `git add` the file, then `npx ddd-ts-kit merge-trunk --continue`, which commits only once no line, row or test is lost.'
    : undefined;
}

// `-X ours|theirs`, `-Xtheirs`, `--strategy-option[=]theirs`, `-s ours`, `--strategy[=]ours`.
function takesOneSide(tail) {
  return tail.some((word, index) => {
    const next = tail[index + 1];
    const option = /^(?:-X|--strategy-option=?)(.*)$/.exec(word);
    const strategy = /^(?:-s|--strategy=?)(.*)$/.exec(word);
    return (
      (option !== null && /^(?:ours|theirs)$/.test(option[1] || next)) ||
      (strategy !== null && (strategy[1] || next) === 'ours')
    );
  });
}

// A path under the source root or the tests, or the whole tree; a place only the shell knows may be either.
function heldPaths(project, directory, args) {
  return shell
    .operands(args)
    .map((word) => shell.placeOf(word, directory))
    .map((place) => (place === undefined ? '' : projectPath(project, place)))
    .some(
      (path) =>
        path === '' ||
        [project.sourceRoot, 'test', 'tests'].some((root) => path === root || path.startsWith(`${root}/`)),
    );
}

function sharedGeneratorReason(project, context, commands) {
  for (const { subcommand, args } of kitInvocations(commands)) {
    if (subcommand !== 'generate' && subcommand !== 'g') {
      continue;
    }
    const [kind, target] = args.filter((arg) => !arg.startsWith('-'));
    if (kind === 'adr') {
      if (args.includes('--deviation')) {
        return `\`generate adr --deviation\` also writes the deviation in ddd-ts-kit.config.json, which is shared, and relaxing a rule is a decision of the project owner. ${REPORT_TO_CONDUCTOR}`;
      }
      continue;
    }
    if (SHARED_GENERATORS.includes(kind)) {
      return `\`generate ${kind}\` writes shared files (config, registries of the platform, schema). The conductor runs it on the trunk before the workers start. ${REPORT_TO_CONDUCTOR}`;
    }
    if (target && target !== context) {
      return `You build the context "${context}"; \`generate ${kind} ${target}\` writes in another context. ${REPORT_TO_CONDUCTOR}`;
    }
    const aggregate = kind === 'command' ? aggregateOption(args) : undefined;
    if (aggregate && !hasRepository(project, context, aggregate)) {
      return `\`generate command --aggregate ${aggregate}\` would also create the repository of ${aggregate}, which registers in shared files. ${REPORT_TO_CONDUCTOR}`;
    }
  }
  return sharedKitWriteReason(commands);
}

// Other kit commands that write files of every context: `init --force` rewrites the whole project,
// `depcruise-config --write` rewrites the generated dependency rules.
function sharedKitWriteReason(commands) {
  for (const { subcommand, args } of kitInvocations(commands)) {
    if (subcommand === 'init' && args.includes('--force')) {
      return `\`init --force\` rewrites the project from the kit, including files of every context. ${REPORT_TO_CONDUCTOR}`;
    }
    if (subcommand === 'depcruise-config' && args.includes('--write')) {
      return `\`depcruise-config --write\` rewrites the generated .dependency-cruiser.cjs from ${CONFIG}, which is shared. ${REPORT_TO_CONDUCTOR}`;
    }
  }
  return undefined;
}

function aggregateOption(args) {
  const at = args.findIndex((arg) => arg === '--aggregate' || arg.startsWith('--aggregate='));
  return at === -1 ? undefined : args[at].includes('=') ? args[at].split('=')[1] : args[at + 1];
}

// The repository port of an aggregate, at the level of the context or in a module of its model.
function hasRepository(project, context, aggregate) {
  const name = aggregate.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return ['', ...(project.modules[context] ?? [])].some((module) =>
    existsSync(
      join(project.root, project.contextsDir, context, module, 'domain', 'repositories', `${name}.repository.ts`),
    ),
  );
}

// TypeORM takes the path of the migration (`migrations/working-add-claims`): its last segment is the name.
function workingMigrationReason(command) {
  const name = /\bdb:generate(?:\s+--)?\s+([^\s;&|]+)/.exec(command)?.[1]?.split('/').pop();
  return name && !/^working[_-]/.test(name)
    ? `A worker generates a working migration only: \`npm run db:generate working-${name}\`. It lets the specs of the branch run; the conductor deletes it and generates the real one on the trunk at merge.`
    : undefined;
}

// The flags may stand anywhere: `npm i -D zod`, `npm i zod@1 --save-exact`. A clean install stays free.
function dependencyChangeReason(commands) {
  return commands.some(changesDependencies)
    ? `Adding, removing or updating a dependency changes package.json and the lockfile, which are shared. ${REPORT_TO_CONDUCTOR}`
    : undefined;
}

function changesDependencies({ words }) {
  const manager = shell.commandName(words);
  if (!(manager in DEPENDENCY_CHANGES)) {
    return false;
  }
  const [subcommand, ...rest] = shell.operands(words.slice(1), VALUED_MANAGER_OPTIONS);
  if (DEPENDENCY_CHANGES[manager].includes(subcommand)) {
    return true;
  }
  if (
    manager === 'npm' &&
    ((subcommand === 'pkg' && /^(set|delete)$/.test(rest[0])) || (subcommand === 'audit' && rest[0] === 'fix'))
  ) {
    return true;
  }

  return INSTALLS.includes(subcommand) && rest.length > 0;
}

// Another formatter lays the code out otherwise than `format`, and the lint then reports the lines it moved;
// `npx biome` without `--no` can fetch an unrelated package of the registry under that name.
function formatterReason(project, commands) {
  const run = project.packageManager === 'pnpm' ? 'pnpm run' : 'npm run';
  const advice = `Format with \`${run} format\` only, then \`${run} lint:fix\`: a blank line the lint asks for after a line the formatter wrapped is expected.`;
  for (const { words } of commands) {
    const fetched = fetchedPackage(words);
    if (fetched?.name === 'prettier' && formatRunsBiome(project)) {
      return `\`npx prettier\` is not the formatter of this project: its \`format\` script runs Biome. ${advice}`;
    }
    if (fetched?.name === 'biome' && !fetched.installedOnly) {
      return `\`npx biome\` without \`--no\` can run an unrelated package of the registry named biome, which formats nothing. ${advice}`;
    }
  }
  return undefined;
}

// The package a runner fetches (`npx`, `pnpm dlx`, ...), without its version, and whether `--no` keeps it to what is installed.
function fetchedPackage(words) {
  const name = shell.commandName(words);
  const fetching = ['npx', 'pnpx', 'bunx'].includes(name) || (['pnpm', 'yarn'].includes(name) && words[1] === 'dlx');
  if (!fetching) {
    return undefined;
  }
  const args = words.slice(name === 'pnpm' || name === 'yarn' ? 2 : 1);
  const named = args[args.findIndex((word) => word === '-p' || word === '--package') + 1];
  const first = shell.operands(args, ['-p', '--package', '-c', '--call'])[0];
  const spec = args.some((word) => word === '-p' || word === '--package') ? named : first;
  return spec === undefined
    ? undefined
    : {
        name: spec.replace(/(.)@.*$/, '$1'),
        installedOnly: name === 'npx' && args.some((word) => /^--no(-install)?$/.test(word)),
      };
}

function formatRunsBiome(project) {
  const format = readJson(join(project.root, 'package.json'))?.scripts?.format;
  return typeof format === 'string' && /\bbiome\b/.test(format);
}

// A worker never writes outside its scope, whatever the tool. A file the shell writes by name (a
// redirection, `sed -i`, `perl -i`, `tee`) is held to the checks of a write with the editor tools;
// copies, moves, deletions and restores outside the scope are refused; inline code, whose writes
// cannot be read in advance, is checked after it ran (`pendingChangeReason`).
function fileChangeReason(project, input, commands) {
  for (const command of commands) {
    for (const target of writtenTargets(command)) {
      const refusal = shellWriteReason(project, input, target);
      if (refusal) {
        return refusal;
      }
    }
    const changed = changedPaths(command).find((path) => outsideScope(project, input, path.place));
    if (changed) {
      return `A worker never changes a file outside its scope: \`${changed.by}\` changes ${describePlace(project, changed.place)}. ${EDIT_WITH_TOOLS}`;
    }
  }
  return undefined;
}

// The files a command writes by name, of a project or unknown to all but the shell.
function writtenTargets(command) {
  const at = (target, by) => ({ place: shell.placeOf(target, command.directory), by });
  const redirected = command.redirects
    .filter(({ operator }) => OUTPUT_REDIRECTS.has(operator))
    .map(({ operator, target }) =>
      at(target, `the redirection \`${operator} ${target.replaceAll(shell.UNKNOWN, '$(...)')}\``),
    );

  // A place of the temp directory that is a link elsewhere is the place it reaches; a device is itself.
  return [...redirected, ...inPlaceTargets(command).map((file) => at(file.word, file.by))]
    .map((target) =>
      target.place !== undefined && !target.place.startsWith('/dev/') && isFreePlace(target.place)
        ? { ...target, place: realPlace(target.place) }
        : target,
    )
    .filter(({ place }) => place === undefined || !isFreePlace(place) || findProject(place) !== undefined);
}

// The only absolute places a worker writes outside its scope: the null and standard devices and
// the system temporary directory (os.tmpdir() or $TMPDIR) outside every project. Everything else is judged.
function isFreePlace(place) {
  if (['/dev/null', '/dev/stdout', '/dev/stderr'].includes(place)) {
    return true;
  }
  return [tmpdir(), process.env.TMPDIR]
    .filter((dir) => typeof dir === 'string' && dir !== '')
    .flatMap((dir) => [resolve(dir), realOf(resolve(dir))])
    .some((dir) => place === dir || place.startsWith(`${dir}/`));
}

function shellWriteReason(project, input, { place, by }) {
  if (place === undefined) {
    return `A worker writes with the shell only to a file it names: ${by} writes files only the shell knows. ${EDIT_WITH_TOOLS}`;
  }
  const owner = findProject(place);
  if (owner === undefined) {
    return `A worker writes only inside its worktree: ${by} writes ${place}, outside your worktree. ${FREE_OUTPUT}`;
  }
  if (owner.root !== project.root) {
    return `A worker never changes a file outside its scope: ${by} writes ${place}, in another checkout. ${EDIT_WITH_TOOLS}`;
  }
  const refusal =
    generatedFileReason(project, place) ??
    workerScopeReason(project, place, input) ??
    linkReason(project, place, input) ??
    handWrittenRoleReason(project, place);

  return refusal ? `${by}: ${refusal} ${FREE_OUTPUT}` : undefined;
}

// `sed -i`, `perl -i` and `tee` write the files they are given.
function inPlaceTargets({ words }) {
  const name = shell.commandName(words);
  const args = words.slice(1);
  if (name === 'tee') {
    return shell.operands(args).map((word) => ({ word, by: `\`tee\` writing ${word}` }));
  }
  // A sed script writes a file by `w file`, `W file` or an `s///w` flag, whose target the script hides.
  if (name === 'sed' && !inPlaceFlag(args) && sedWrites(args)) {
    return [{ word: shell.UNKNOWN, by: 'a sed script that writes a file' }];
  }
  const files = ['sed', 'perl', 'ruby'].includes(name) ? inPlaceFiles(args) : [];

  return files.map((word) => ({ word, by: `\`${name} -i\` editing ${word}` }));
}

// The files of an in-place edit: every operand once the script is given by `-e` or `-f`, else all but the first.
function inPlaceFiles(args) {
  if (!inPlaceFlag(args)) {
    return [];
  }
  const files = [];
  let scripted = false;
  for (let index = 0; index < args.length; index += 1) {
    const word = args[index];
    const valued = /^-[a-zA-Z]*[efE]$/.test(word) || ['--expression', '--file'].includes(word);
    scripted ||= valued || /^(-[a-zA-Z]*[efE]|--expression=|--file=)/.test(word);
    if (valued || word === '-l' || word === '--line-length') {
      index += 1;
    } else if (!word.startsWith('-')) {
      files.push(word);
    }
  }

  return scripted ? files : files.slice(1);
}

function runsInlineCode({ words, heredoc, piped, redirects }) {
  const name = shell.commandName(words);
  const language = name.replace(/[\d.]+$/, '');
  const args = words.slice(1);
  if (!(language in INLINE_CODE)) {
    return false;
  }
  const flag = args.some((word) => INLINE_CODE[language].test(word));
  const script = args.find((word) => !word.startsWith('-') || word === '-');
  const fed = heredoc || piped || redirects.some(({ operator }) => operator === '<' || operator === '<<<');

  return flag || script === '-' || (script === undefined && fed && !args.includes('-m'));
}

// The paths a command changes, each with what changes it.
function changedPaths(command) {
  const name = shell.commandName(command.words);
  return tableWrites(name, command) ?? programWrites(name, command.words, command.directory) ?? [];
}

// cp, mv, rm, dd, find -delete, patch and git: the writers whose targets the tables already read.
function tableWrites(name, { words, directory, expression }) {
  const at = (word, by) => ({ place: shell.placeOf(word, directory), by });
  if (name in PATH_COMMANDS) {
    const recursive = name === 'rm' && words.some((word) => /^(?:-[a-zA-Z]*[rR][a-zA-Z]*|--recursive)$/.test(word));
    return pathOperands(name, words.slice(1)).map((word) => ({
      ...at(word, name),
      below: recursive || (word.endsWith('/{}') && findReachesScope(expression)),
    }));
  }
  if (name === 'dd') {
    return words.filter((word) => word.startsWith('of=')).map((word) => at(word.slice(3), 'dd'));
  }
  if (name === 'find' && words.includes('-delete')) {
    const roots = words.slice(1, shell.firstExpression(words));
    const below = findReachesScope(words.slice(shell.firstExpression(words)));
    return (roots.length > 0 ? roots : ['.']).map((root) => ({ ...at(`${root}/{}`, 'find -delete'), below }));
  }
  if (name === 'patch' && !words.includes('--dry-run')) {
    return [{ place: undefined, by: 'patch' }];
  }
  return name === 'git' ? gitChangedPaths(words.slice(1), directory) : undefined;
}

// Whether what `find` finds can be a scope file or its folder: the names its `-name` and `-iname`
// tests ask, when the expression is their plain conjunction; any other expression can find them.
function findReachesScope(expression = []) {
  if (expression.some((word) => ['-o', '-or', '!', '-not', '(', ','].includes(word))) {
    return true;
  }
  const patterns = expression.flatMap((word, index) =>
    ['-name', '-iname'].includes(word) ? expression.slice(index + 1, index + 2) : [],
  );
  return patterns.every((pattern) => SCOPE_NAMES.some((name) => namedBy(pattern, name)));
}

// A name a pattern of `find` matches, ignoring case; a bracket expression may match any.
function namedBy(pattern, name) {
  const glob = pattern
    .replace(/[.+^${}()|\\]/g, '\\$&')
    .replaceAll('*', '.*')
    .replaceAll('?', '.');
  return pattern.includes('[') || new RegExp(`^${glob}$`, 'i').test(name);
}

// The writers the cp and mv tables miss: an editor that rewrites in place, a downloader, an archive
// tool, an awk program, a linter or runner given a path, or find writing a listing to a file.
function programWrites(name, words, directory) {
  const at = (word, by) => ({ place: shell.placeOf(word, directory), by });
  const args = words.slice(1);
  if (IN_PLACE_EDITORS.has(name)) {
    return shell.operands(args).map((word) => at(word, name));
  }
  if (name === 'rsync') {
    const operands = shell.operands(args, RSYNC_VALUED);
    return operands.length > 1 ? [at(operands.at(-1), 'rsync')] : [];
  }
  if (name === 'curl' || name === 'wget') {
    return downloadWrites(name, args, at);
  }
  if (name === 'tar' || name === 'unzip') {
    return archiveWrites(name, args, at);
  }
  if (AWK_PROGRAMS.has(name)) {
    return awkWrites(args) ? [{ place: undefined, by: 'an awk program that writes a file' }] : [];
  }
  if (name === 'find') {
    return findListings(words, at);
  }
  return name in TOOL_WRITES ? toolWrites(name, args, at) : undefined;
}

const RSYNC_VALUED = ['-e', '--rsh', '--exclude', '--include', '--files-from', '-f', '--filter', '--compare-dest'];

// curl writes `-o file`/`--output file` and the basename of the URL with `-O`; wget writes `-O file`
// and under the directory of `-P`/`--directory-prefix`.
function downloadWrites(name, args, at) {
  const flags = DOWNLOAD_FLAGS[name];
  const writes = [];
  for (let index = 0; index < args.length; index += 1) {
    if (flags.includes(args[index])) {
      writes.push(at(args[index + 1] ?? shell.UNKNOWN, name));
    }
  }
  if (name === 'curl' && args.some((word) => /^-[A-Za-z]*O[A-Za-z]*$/.test(word) && !word.startsWith('--'))) {
    writes.push({ place: undefined, by: 'curl -O' });
  }
  return writes;
}

// An extraction writes places only the shell resolves (the current directory, a -C or -d target);
// tar creating an archive writes the file of `-f`/`--file`. unzip extracts unless it lists or tests.
function archiveWrites(name, args, at) {
  if (name === 'unzip') {
    return args.some((word) => word === '-l' || word === '-t') ? [] : [{ place: undefined, by: name }];
  }
  const letters = tarLetters(args);
  if (letters.includes('x') || args.includes('--extract') || args.includes('--get')) {
    return [{ place: undefined, by: name }];
  }
  const file = letters.includes('c') || args.includes('--create') ? tarFile(args) : undefined;
  return file === undefined ? [] : [at(file, name)];
}

// The mode and option letters of tar: its first word in the old form (`tar czf ...`), else its short
// options (`-czf`, `-c -f`); never the name of an archive.
function tarLetters(args) {
  if (/^[A-Za-z]+$/.test(args[0] ?? '')) {
    return args[0];
  }
  return args
    .filter((word) => /^-[A-Za-z]+$/.test(word))
    .map((word) => word.slice(1))
    .join('');
}

// The archive tar names: the value of `--file`, or the word after the letters that hold `f`.
function tarFile(args) {
  const long = args.find((word) => word.startsWith('--file='));
  if (long !== undefined) {
    return long.slice('--file='.length);
  }
  const at = args.findIndex(
    (word, index) =>
      word === '--file' || (/^-?[A-Za-z]*f[A-Za-z]*$/.test(word) && (index === 0 || word.startsWith('-'))),
  );
  return at === -1 ? undefined : (args[at + 1] ?? shell.UNKNOWN);
}

// An awk program writes when it edits in place (`-i inplace`), redirects, pipes, or calls `system`.
function awkWrites(args) {
  const inPlace = args.some((word) => /^-i(nplace)?$/.test(word)) && args.includes('inplace');
  return inPlace || args.some((word) => /[>|]|\bsystem\b/.test(word));
}

// `find ... -fprint file`, `-fprintf file ...`, `-fls file`: the file after the action is written.
function findListings(words, at) {
  const writes = [];
  words.forEach((word, index) => {
    if (['-fprint', '-fprintf', '-fls'].includes(word)) {
      writes.push(at(words[index + 1] ?? shell.UNKNOWN, `find ${word.slice(1)}`));
    }
  });
  return writes;
}

function toolWrites(name, args, at) {
  const spec = TOOL_WRITES[name];
  const targets =
    spec.kind === 'valued'
      ? valuedTargets(args, spec.valued)
      : spec.flags.some((flag) => args.includes(flag))
        ? shell.operands(args, spec.valued).filter((word) => !spec.subcommands.includes(word))
        : [];
  return targets.map((word) => at(word, name));
}

// The values of `--outputFile file` and `--outputFile=file`, whatever the flag the runner takes.
function valuedTargets(args, valued) {
  const targets = [];
  for (let index = 0; index < args.length; index += 1) {
    const joined = valued.find((flag) => args[index].startsWith(`${flag}=`));
    if (valued.includes(args[index])) {
      targets.push(args[index + 1] ?? shell.UNKNOWN);
    } else if (joined) {
      targets.push(args[index].slice(joined.length + 1));
    }
  }
  return targets;
}

function pathOperands(name, args) {
  const { valued, changes } = PATH_COMMANDS[name];
  const directory = targetDirectory(name, args);
  const words = shell.operands(args, directory === undefined ? valued : [...valued, '-t', '--target-directory']);
  if (changes === 'all' || (name === 'install' && args.includes('-d'))) {
    return directory === undefined ? words : [...words, directory];
  }

  return directory === undefined ? words.slice(-1) : [directory];
}

// The directory of `-t dir`, `-tdir`, `--target-directory dir` or `--target-directory=dir`; a
// spaced form with nothing after it is a place only the shell knows.
function targetDirectory(name, args) {
  if (!TARGETED_COMMANDS.has(name)) {
    return undefined;
  }
  const spaced = args.findIndex((word) => word === '-t' || word === '--target-directory');
  if (spaced !== -1) {
    return args[spaced + 1] ?? shell.UNKNOWN;
  }
  const joined = args.find((word) => /^(?:-t.|--target-directory=)/.test(word));
  return joined?.replace(/^(?:-t|--target-directory=)/, '');
}

// `git checkout -- <path>`, `git restore`, `git rm`, `git mv` and `git clean` rewrite or delete
// files of the work tree; `git apply` writes the files of a patch.
function gitChangedPaths(args, directory) {
  const { subcommand, tail, moved } = gitInvocation(args, directory);
  const at = (word) => ({ place: shell.placeOf(word, moved), by: `git ${subcommand}` });
  const forced = forcedGitWrite(subcommand, tail, at);
  if (forced) {
    return forced;
  }
  if (subcommand === 'checkout') {
    return checkedOutPaths(tail, moved).map(at);
  }
  if (subcommand === 'restore') {
    const staged = tail.some((word) => word === '--staged' || word === '-S');
    const worktree = tail.some((word) => word === '--worktree' || word === '-W');
    return staged && !worktree ? [] : shell.operands(tail, ['-s', '--source']).map(at);
  }
  if (subcommand === 'rm' || subcommand === 'mv') {
    return shell.operands(tail).map(at);
  }
  if (subcommand === 'clean' && !tail.some((word) => /^(-[a-zA-Z]*n|--dry-run)$/.test(word))) {
    const named = shell.operands(tail, ['-e', '--exclude']);
    // `-x` and `-X` remove ignored files, `-d` enters the folders git does not track.
    const below = tail.some((word) => /^-[a-zA-Z]*[xX]/.test(word)) || untrackedBy(tail, /^-[a-zA-Z]*d/);
    return (named.length > 0 ? named : ['.']).map((word) => ({ ...at(word), below }));
  }
  const checking = tail.some((word) => /^--(check|stat|numstat|summary|cached)$/.test(word));

  return subcommand === 'apply' && !checking ? [{ place: undefined, by: 'git apply' }] : [];
}

// git writers that rewrite the work tree a worker does not name: a forced checkout, switch, reset
// or read-tree; a stash or checkout-index; a new worktree; a commit of every tracked change; a
// patch or report written out; or paths read from a file.
function forcedGitWrite(subcommand, tail, at) {
  if ((GIT_FORCE_WRITERS[subcommand] ?? []).some((flag) => tail.includes(flag))) {
    return [at('.')];
  }
  if (tail.some((word) => word.startsWith('--pathspec-from-file'))) {
    return [{ place: undefined, by: `git ${subcommand}` }];
  }
  if (touchesWorktree(subcommand, tail)) {
    // `--all` stashes the ignored files too, `--include-untracked` those git does not ignore.
    const below =
      tail.some((word) => /^(?:-[a-zA-Z]*a[a-zA-Z]*|--all)$/.test(word)) ||
      untrackedBy(tail, /^(?:-[a-zA-Z]*u[a-zA-Z]*|--include-untracked)$/);
    return [{ ...at('.'), below }];
  }
  if (subcommand === 'worktree' && tail[0] === 'add') {
    return [at(shell.operands(tail.slice(1), ['-b', '-B']).at(-1) ?? '.')];
  }
  if (subcommand === 'commit' && tail.some((word) => /^-[^-]*a/.test(word) || word === '--all')) {
    return [at('.')];
  }
  const out = gitOutputFile(subcommand, tail);
  return out === undefined ? undefined : [at(out)];
}

// 'untracked' when a word gives the option: the files git does not ignore are taken.
function untrackedBy(tail, option) {
  return tail.some((word) => option.test(word)) ? 'untracked' : false;
}

// stash writes the work tree unless it only reads it (list, show), and checkout-index with -a or -f.
function touchesWorktree(subcommand, tail) {
  if (subcommand === 'checkout-index') {
    return tail.some((word) => /^-[a-zA-Z]*[af]/.test(word) || word === '--all');
  }
  const action = tail.find((word) => !word.startsWith('-')) ?? '';
  return subcommand === 'stash' && !['list', 'show', 'drop', 'clear', 'branch'].includes(action);
}

// The file `git diff`, `log` or `show --output` and `git format-patch -o` write to, given spaced or joined.
function gitOutputFile(subcommand, tail) {
  if (['diff', 'log', 'show'].includes(subcommand)) {
    return valuedTargets(tail, ['--output', '-o'])[0];
  }
  return subcommand === 'format-patch' ? valuedTargets(tail, ['-o', '--output-directory'])[0] : undefined;
}

// The options before the subcommand of git; `-C <directory>` moves where its paths are read from.
function gitInvocation(args, directory) {
  let index = 0;
  let moved = directory;
  while (index < args.length && args[index].startsWith('-')) {
    if (args[index] === '-C') {
      moved = shell.placeOf(args[index + 1] ?? shell.UNKNOWN, moved);
    } else if (/^--(?:git-dir|work-tree)\b/.test(args[index])) {
      moved = undefined;
    }
    index += GIT_VALUED_OPTIONS.has(args[index]) ? 2 : 1;
  }

  return { subcommand: args[index], tail: args.slice(index + 1), moved };
}

// After `--`, every word is a path; without it, the words that name an existing file or directory are.
function checkedOutPaths(tail, directory) {
  const dashes = tail.indexOf('--');
  if (dashes !== -1) {
    return tail.slice(dashes + 1);
  }

  return shell.operands(tail, ['-b', '-B', '--orphan']).filter((word) => {
    const place = shell.placeOf(word, directory);
    return place === undefined || existsSync(place);
  });
}

// A path only the shell knows, of another checkout, or anywhere outside every kit project but the
// free devices and the temporary directory, is outside the worker's scope.
function outsideScope(project, input, place) {
  if (place === undefined) {
    return true;
  }
  const owner = findProject(place);
  if (owner === undefined) {
    return !isFreePlace(place);
  }

  return (
    owner.root !== project.root ||
    (workerScopeReason(project, place, input) ?? linkReason(project, place, input)) !== undefined
  );
}

// A file of a worker's scope is the file it reaches: through a link, or a folder of its path that is
// one, it is judged where it lands; a file that has another name (a hard link) may be written there too.
function linkReason(project, place, input) {
  const scope = workerScope(project, input);
  if (!scope) {
    return undefined;
  }
  const path = projectPath(project, place);
  const real = relative(realpathSync(project.root), realPlace(place)).split(sep).join('/');
  if (real !== path) {
    const away = real.startsWith('../');
    return away || contextScopeReason(project, real, scope.context)
      ? `${path} is a link to ${away ? realPlace(place) : real}, outside your scope: a worker writes through no link that leaves it. ${REPORT_TO_CONDUCTOR}`
      : undefined;
  }
  return statSync(place, { throwIfNoEntry: false })?.nlink > 1
    ? `${path} has another name elsewhere (a hard link): writing it changes that file too. A worker writes only files of its scope that have one name. ${REPORT_TO_CONDUCTOR}`
    : undefined;
}

// Where a write lands: the real path of the place, its links followed, a link that points nowhere yet
// followed to where it would create its file.
function realPlace(place, depth = 0) {
  try {
    return realpathSync(place);
  } catch {
    // Not there: a link that points nowhere yet, or a file to create under its real folder.
  }
  const target = linkTarget(place);
  if (target !== undefined && depth < 8) {
    return realPlace(resolve(dirname(place), target), depth + 1);
  }
  return join(realPlace(dirname(place), depth), basename(place));
}

function linkTarget(place) {
  try {
    return readlinkSync(place);
  } catch {
    return undefined;
  }
}

// The code a worker's command runs (inline code, a script, a shell fed on its input, a test or a
// package script) cannot be read in advance: unless every command of the line is a pure reader, the
// state outside the scope is noted before it, and compared at the next call of the guard by that
// worker (`settleNote`). The kit's own merge of the trunk, which brings the trunk's files in, is not
// noted; nor are the packages around an install, which rewrites them.
function noteBeforeCode(project, input, commands) {
  if (commands.every((command) => isPureReader(command) || startsTrunkMerge(command))) {
    return;
  }
  const session = sessionCheckout(project, input);
  writeState(stateFile('before-run', project, input), {
    worktree: snapshot(project, worktreeOutside(project, input), join(project.root, GUARD_HELD)),
    session: session && snapshot(session, sessionOutside),
    packages: commands.some(installsPackages) ? undefined : packageStates(project, session),
    script: sanctionedScripts(commands),
  });
}

// The scripts of the project its own tools run in (Biome, ESLint, the generators of the kit), when
// they are all the code of the line: what they rewrite outside the scope is said, not held.
function sanctionedScripts(commands) {
  const scripts = commands.filter((command) => !isPureReader(command)).map(scriptRun);
  return scripts.every(Boolean) ? scripts.join('`, `') : undefined;
}

// `npm run <script>`, `pnpm <script>`, `yarn run <script>`... of a sanctioned script, as `<manager> run <script>`.
// A script run in another folder (`--prefix`, `-C`, `--dir`, `--filter`) is no tool of this project.
function scriptRun({ words }) {
  const manager = shell.commandName(words);
  if (words.some((word) => /^(?:--prefix|-C|--dir|--filter|-F|-w|--workspace)(?:=|$)/.test(word))) {
    return undefined;
  }
  const [first, second] = shell.operands(words.slice(1), VALUED_MANAGER_OPTIONS);
  const script = ['run', 'run-script'].includes(first) ? second : manager === 'npm' ? undefined : first;
  return SCRIPT_MANAGERS.includes(manager) && SANCTIONED_SCRIPTS.has(script) ? `${manager} run ${script}` : undefined;
}

// A program that only reads, whatever its arguments, named by its name or by its path in a folder of
// the system (a program named `cat` elsewhere is another program), and git that only reads: without `--output`, which writes a file, nor a
// setting given to the command, nor an option that hands the files to a program (`grep -O`,
// `--ext-diff`). It runs no code of the project.
function isPureReader({ words, assigned }) {
  const name = shell.commandName(words);
  if (words[0]?.includes('/') && !SYSTEM_PROGRAMS.includes(dirname(words[0]))) {
    return false;
  }
  if (name !== 'git') {
    return PURE_READERS.has(name);
  }
  const { subcommand, tail } = gitInvocation(words.slice(1));
  const reads = subcommand === 'branch' ? listsBranches(tail) : GIT_READ_ONLY.has(subcommand);
  return reads && assigned.length === 0 && !words.some(runsAProgramOfGit);
}

function runsAProgramOfGit(word) {
  return word === '-c' || word === '-O' || /^(?:--output|--config-env|--ext-diff|--open-files-in-pager|-O.)/.test(word);
}

// `git branch` reads with no operand or when it lists, and with none of the options that write.
function listsBranches(tail) {
  const writes = [...BRANCH_DELETES, ...BRANCH_MOVES, ...BRANCH_RESETS, ...BRANCH_SETTINGS];
  return (
    !hasBranchOption(tail, writes) &&
    (shell.operands(tail).length === 0 || tail.some((word) => BRANCH_LISTS.includes(word)))
  );
}

function startsTrunkMerge(command) {
  return kitInvocations([command]).some(
    ({ subcommand, args }) => subcommand === 'merge-trunk' && !args.includes('--continue'),
  );
}

// An install of the lockfile, in any spelling the guard knows (`npm ci`, `npm clean-install`, a bare
// `yarn`, `bun install --frozen-lockfile`): a worker's install of what the lockfile says is free.
function installsPackages({ words }) {
  const manager = shell.commandName(words);
  const [subcommand] = shell.operands(words.slice(1), VALUED_MANAGER_OPTIONS);
  return (
    manager in DEPENDENCY_CHANGES &&
    (CLEAN_INSTALLS.includes(subcommand) || INSTALLS.includes(subcommand) || (manager === 'yarn' && !subcommand))
  );
}

// The checkout of the session, when it is not the worker's: every file of it is outside the scope.
function sessionCheckout(project, input) {
  const home = findProject(input.cwd ?? process.cwd());
  return home?.root === project.root ? undefined : home;
}

function sessionOutside(path) {
  return !/^\.(?:ddd-ts-kit|worktrees)\//.test(path);
}

// The paths of the worktree outside the scope; generated files are left out: a generator rewrites
// them, and so does `regenerate`, which `verify-slice` runs in the worktree of a worker. A decision
// record a commit adds (`letter` A) is the worker's own.
function worktreeOutside(project, input) {
  const { context } = workerScope(project, input);
  return (path, letter) =>
    !path.startsWith('.ddd-ts-kit/') &&
    !(letter === 'A' && DECISION_RECORD.test(path)) &&
    contextScopeReason(project, path, context) !== undefined &&
    !generatedFileReason(project, join(project.root, path)) &&
    !REGENERATED_FILES.test(path);
}

// The files the guard itself runs, in the worktree and the session's checkout: the manifest and the
// bin of the kit's CLI and of Biome, each by its time and size ('absent' when missing).
function packageStates(project, session) {
  const states = {};
  for (const root of [project.root, session?.root].filter(Boolean)) {
    for (const [name, command] of GUARD_RUNS) {
      const home = join(root, 'node_modules', name);
      for (const file of [join(home, 'package.json'), installedBin(home, name, command)?.bin].filter(Boolean)) {
        const stat = statSync(file, { throwIfNoEntry: false });
        states[file] = stat ? `${stat.mtimeMs}:${stat.size}` : 'absent';
      }
    }
  }
  return states;
}

// The state outside the scope in a checkout: its HEAD, and each file git shows changed from it that
// `outside` keeps, with the hash of its content (null once deleted), whether git tracks it, whether
// it is added to the index, and the path a rename (`git mv`) came from. With `keep`, the content of
// each changed file is kept there under its hash, so that it can be put back.
function snapshot(checkout, outside, keep) {
  const status = gitRun(checkout, ['status', '--porcelain=v2', '-z', '--branch', '--untracked-files=all']);
  const state = { head: undefined, changes: {} };
  if (CUT_SHORT.has(status.error?.code)) {
    return { ...state, unread: true };
  }
  const fields = (status.status === 0 ? status.stdout : '').split('\0');
  for (let index = 0; index < fields.length; index += 1) {
    const { head, path, from, ...flags } = statusEntry(fields[index], fields[index + 1]);
    index += from === undefined ? 0 : 1;
    state.head ??= head;
    for (const [changed, entry] of [
      [path, { ...flags, from }],
      [from, {}],
    ]) {
      if (changed !== undefined && outside(changed)) {
        state.changes[changed] = { hash: contentHash(join(checkout.root, changed), keep), ...entry };
      }
    }
  }
  return state;
}

// One entry of `git status --porcelain=v2 -z`: the HEAD of its header, else a path (after a fixed
// number of fields by kind), and for a rename the path it came from, the next field.
function statusEntry(field, next) {
  if (field.startsWith('# branch.oid ')) {
    return { head: field.slice('# branch.oid '.length) };
  }
  const skipped = STATUS_FIELDS[field[0]];
  if (skipped === undefined) {
    return {};
  }
  const parts = field.split(' ');
  return {
    path: parts.slice(skipped).join(' '),
    untracked: field[0] === '?',
    added: field[0] === '1' && parts[1][0] === 'A',
    from: field[0] === '2' ? next : undefined,
  };
}

// What changed outside the scope stops the worker until it is put back; the commands that put back
// exactly those files (and a commit that records it) stay allowed. A refusal said once comes first.
function pendingChangeReason(project, input, commands) {
  const told = settleNote(project, input, commands.every(isPureReader));
  return told ? { reason: told } : heldChangeReason(project, input, commands);
}

// The note before the last command, compared now: what changed outside the scope in the worktree is
// held until it is put back (`heldChangeReason`); what changed in the session's checkout or in the
// packages the guard runs is said once, for the conductor, who alone knows whether it changed them.
// A process the last command left in the background goes on changing files: when nothing changed and
// the call only reads (`reading`), the note of the worktree stays for the next call, until a change, a
// stop or a new note ends it.
function settleNote(project, input, reading) {
  const noted = stateFile('before-run', project, input);
  const before = readJson(noted);
  if (!isRecord(before?.worktree)) {
    return undefined;
  }
  const session = sessionCheckout(project, input);
  const settled = holdChanges(project, input, before);
  const told = sessionChangeReason(session, before.session) ?? packagesChangeReason(before.packages, project, session);
  if (reading && !settled && !told) {
    writeState(noted, { worktree: before.worktree, script: before.script });
  } else {
    removeKitFile(noted);
  }
  return told;
}

// Whether the note is settled: something changed outside the scope since it, or it cannot be compared.
// A status that did not answer in full, on either side, compares nothing, and that is said once.
function holdChanges(project, input, { worktree: before, script }) {
  const outside = worktreeOutside(project, input);
  const now = snapshot(project, outside);
  if (before.unread || now.unread) {
    notice = [notice, UNCOMPARED_NOTE].filter(Boolean).join('\n');
    return true;
  }
  const all = differences(project, outside, { before, now });
  const rewritten = script ? all.filter(isRewrittenByTools) : [];
  const changed = all.filter((path) => !rewritten.includes(path));
  if (rewritten.length > 0) {
    notice = [notice, rewrittenNotice(script, rewritten)].filter(Boolean).join('\n');
  }
  if (changed.length > 0) {
    const file = stateFile('outside', project, input);
    const held = readJson(file) ?? {};
    for (const path of changed) {
      held[path] ??= { ...(before.changes[path] ?? { clean: true }), head: before.head };
    }
    writeState(file, held);
  }
  return all.length > 0;
}

// What Biome, ESLint and the generators of the kit rewrite: code, JSON and the documents.
function isRewrittenByTools(path) {
  return FORMATTED_FILE.test(path) || path.startsWith('docs/');
}

function rewrittenNotice(script, paths) {
  return `ddd-ts-kit: \`${script}\` rewrote files outside your scope: ${paths.join(', ')}. They are not held: the project's own tool rewrote them. Leave them out of your commits and name them in your report, for the conductor.`;
}

// The paths whose content differs between two snapshots: changed in either, or, when HEAD moved,
// changed by the commits between them (a commit, an amend, a reset), the files of the trunk a merge
// brings in compared by their content.
function differences(checkout, outside, { before, now }) {
  const committed = now.head === before.head ? new Map() : committedSince(checkout, before.head, outside);
  const paths = new Set([...Object.keys(before.changes), ...Object.keys(now.changes), ...committed.keys()]);
  return [...paths].filter((path) => {
    const was = before.changes[path];
    const content = was
      ? was.hash !== (now.changes[path]?.hash ?? contentHash(join(checkout.root, path)))
      : path in now.changes;
    return committed.has(path) || content;
  });
}

// The paths `outside` keeps that differ between the commit `from` and HEAD, each with its letter
// (A added, M modified, D deleted); a path that HEAD holds as the other side of a merge since then
// (the trunk `merge-trunk` brought in) is the trunk's, not a change of the worker.
function committedSince(checkout, from, outside) {
  const fields = gitFields(
    checkout,
    ['diff', '--name-status', '--no-renames', '-z', '--end-of-options', from, 'HEAD'],
    '\0',
  );
  const paths = new Map();
  for (let index = 0; index + 1 < fields.length; index += 2) {
    if (outside(fields[index + 1], fields[index])) {
      paths.set(fields[index + 1], fields[index]);
    }
  }
  for (const side of mergedSides(checkout, from)) {
    const differing = new Set(gitFields(checkout, ['diff', '--name-only', '-z', side, 'HEAD'], '\0'));
    for (const path of [...paths.keys()].filter((kept) => !differing.has(kept))) {
      paths.delete(path);
    }
  }
  return paths;
}

// The other parents of the merges on the first-parent line from `from` to HEAD that the trunk holds:
// a branch of the worker merged back is the worker's own work. Without a trunk apart from the branch
// checked out, every side is taken as the trunk's.
function mergedSides(checkout, from) {
  const trunk = trunkOf(checkout);
  return allMergedSides(checkout, from).filter(
    (side) => trunk === undefined || gitRun(checkout, ['merge-base', '--is-ancestor', side, trunk]).status === 0,
  );
}

// The trunk of the repository, the one origin/HEAD names, else main or master, when it is not the
// branch checked out.
function trunkOf(checkout) {
  const current = git(checkout, ['symbolic-ref', '--quiet', 'HEAD'])?.trim();
  return ['refs/remotes/origin/HEAD', 'refs/heads/main', 'refs/heads/master'].find(
    (ref) => ref !== current && git(checkout, ['rev-parse', '--verify', '--quiet', ref]) !== undefined,
  );
}

function allMergedSides(checkout, from) {
  return gitFields(
    checkout,
    ['rev-list', '--first-parent', '--merges', '--parents', '--end-of-options', `${from}..HEAD`],
    '\n',
  )
    .filter(Boolean)
    .flatMap((line) => line.split(' ').slice(2));
}

function sessionChangeReason(session, before) {
  if (!session || !isRecord(before) || before.unread) {
    return undefined;
  }
  // What the conductor commits or merges there meanwhile is its own: only the files left changed in
  // its working tree, and changed since the note, can be the worker's.
  const now = snapshot(session, sessionOutside).changes;
  const changed = Object.keys(now).filter((path) => before.changes[path]?.hash !== now[path].hash);
  return changed.length === 0
    ? undefined
    : `Files of the checkout of the session, ${session.root}, changed while your last command ran: ${changed.join(', ')}. A worker never changes another checkout: put nothing back there yourself; stop and report them to the conductor, who knows whether it changed them. ${REPORT_TO_CONDUCTOR}`;
}

function packagesChangeReason(before, project, session) {
  if (!isRecord(before)) {
    return undefined;
  }
  const now = packageStates(project, session);
  const changed = Object.keys({ ...before, ...now }).filter((file) => before[file] !== now[file]);
  return changed.length === 0
    ? undefined
    : `The packages the guard runs changed while your last command ran: ${changed.join(', ')}. A worker never changes node_modules: report it to the conductor, who installs them again. ${REPORT_TO_CONDUCTOR}`;
}

function heldChangeReason(project, input, commands) {
  const recorded = stateFile('outside', project, input);
  const held = readJson(recorded);
  if (!isRecord(held)) {
    return undefined;
  }
  const now = snapshot(project, worktreeOutside(project, input));
  if (now.unread) {
    return undefined;
  }
  const since = new Map();
  const left = Object.entries(held).filter((entry) => !isPutBack(project, { now, since }, entry));
  if (left.length === 0) {
    removeKitFile(recorded);
    return undefined;
  }
  const paths = new Set(left.map(([path]) => path));
  const acting = commands.filter(({ words }) => !NEUTRAL_PROGRAMS.has(shell.commandName(words)));
  const restoring = (command) => isGitCommit(command) && recordsRestoration(project, input, { now, since, left });
  if (acting.length > 0 && acting.every((command) => putsBack(project, command, paths) || restoring(command))) {
    return { undoing: true };
  }

  return { reason: putBackReason(project, { now, since }, left) };
}

// A file held to its content (null: deleted) is back once it has it; a file held to a commit is
// back once git shows it unchanged and no commit since changed it.
function isPutBack(project, { now, since }, [path, target]) {
  const content = 'clean' in target ? !(path in now.changes) : contentHash(join(project.root, path)) === target.hash;
  return content && !(target.head !== now.head && commitsOf(project, since, target.head).has(path));
}

function commitsOf(project, since, from) {
  if (!since.has(from)) {
    since.set(
      from,
      committedSince(project, from, () => true),
    );
  }
  return since.get(from);
}

// A command that only puts back some of `paths` (`git checkout HEAD --`, `git mv` back, `cp` of the
// held content, `rm` of a new file), or the commit that records it.
function putsBack(project, command, paths) {
  const touched = [...changedPaths(command), ...writtenTargets(command)];
  return (
    touched.every(({ place }) => place !== undefined && paths.has(projectPath(project, place))) &&
    !runsCode(command) &&
    touched.length > 0
  );
}

// An interpreter, a shell, `source`, `make`, a package script or runner, a test runner, a program
// named by its path: code the guard cannot read. The kit's own CLI, behind a runner or not, is
// judged by what it is asked to do.
function runsCode(command) {
  const name = shell.commandName(command.words);
  return (
    (CODE_RUNNERS.has(name) ||
      CODE_RUNNERS.has(name.replace(/[\d.]+$/, '')) ||
      shell.SHELLS.has(name) ||
      isProgramPath(command.words[0] ?? '')) &&
    kitInvocations([command]).length === 0
  );
}

// A word that names a program by its path (`./scripts/seed.sh`, `node_modules/.bin/vitest`).
function isProgramPath(word) {
  return /^\.{0,2}\//.test(word) || word.includes('node_modules/.bin/');
}

// A plain `git commit`: no `-a`, no paths of its own, so that it records the index alone.
function isGitCommit(command) {
  const { subcommand, tail } = gitInvocation(command.words.slice(1));
  return (
    shell.commandName(command.words) === 'git' &&
    subcommand === 'commit' &&
    changedPaths(command).length === 0 &&
    shell.operands(tail, [...COMMIT_VALUED_OPTIONS]).length === 0
  );
}

// A commit records the restoration of the held files a commit changed when each of them is staged
// as the commit noted before holds it, and nothing else outside the scope is staged.
function recordsRestoration(project, input, { now, since, left }) {
  const staged = gitFields(project, ['diff', '--cached', '--name-only', '-z'], '\0').filter(Boolean);
  const outside = worktreeOutside(project, input);
  const held = new Set(left.map(([path]) => path));
  const committed = left.filter(
    ([path, target]) => target.head !== now.head && commitsOf(project, since, target.head).has(path),
  );
  return (
    committed.length > 0 &&
    staged.every((path) => held.has(path) || !outside(path)) &&
    committed.every(
      ([path, target]) =>
        staged.includes(path) && git(project, ['diff', '--cached', '--quiet', target.head, '--', path]) !== undefined,
    )
  );
}

function putBackReason(project, state, left) {
  const steps = left.map((held) => putBackStep(project, state, held)).filter((step) => step.command);
  const afterwards = steps.flatMap((step) => (step.after ? [`, then \`${step.after}\``] : [])).join('');
  const commit = steps.some((step) => step.after !== undefined)
    ? `, then \`git commit\` to record it${afterwards}`
    : '';
  const kept = left.some(([, target]) => target.hash)
    ? ` A file already changed before that command is held to its content then, kept in ${GUARD_HELD}/.`
    : '';

  return `Code your commands ran changed files outside your scope: ${left.map(([path]) => path).join(', ')}. Put them back before anything else (${steps.map((step) => `\`${step.command}\``).join(', then ')}${commit}: allowed for these files), then change only files of your scope.${kept} ${REPORT_TO_CONDUCTOR}`;
}

// The command that brings one held file back to the state it is held to: its content before the
// command (kept by the guard, or deleted), its committed content, its old name, or no file at all.
function putBackStep(project, { now, since }, [path, target]) {
  const kept = 'clean' in target ? '' : target.hash ? `cp ${GUARD_HELD}/${target.hash} ${path}` : `rm ${path}`;
  const letter = target.head === now.head ? undefined : commitsOf(project, since, target.head).get(path);
  if (letter) {
    const restore = letter === 'A' ? 'git rm --' : `git checkout ${target.head.slice(0, 12)} --`;
    return { command: `${restore} ${path}`, after: kept };
  }
  if (kept) {
    return { command: kept };
  }
  const entry = now.changes[path];
  if (Object.values(now.changes).some((other) => other.from === path)) {
    return {};
  }
  if (entry.from) {
    return { command: `git mv ${path} ${entry.from}` };
  }
  if (entry.untracked) {
    return { command: `rm ${path}` };
  }
  return { command: entry.added ? `git rm -f -- ${path}` : `git checkout HEAD -- ${path}` };
}

// A file that is not a regular one (a link to a device, a FIFO) has a hash of its kind, never read.
function contentHash(file, keep) {
  const stat = statSync(file, { throwIfNoEntry: false });
  if (stat === undefined) {
    return null;
  }
  const content = stat.isFile() ? readBounded(file, Number.POSITIVE_INFINITY, null).content : undefined;
  if (content === undefined) {
    return createHash('sha256').update(`not a file: ${stat.mode}`).digest('hex');
  }
  const hash = createHash('sha256').update(content).digest('hex');
  if (keep && !existsSync(join(keep, hash))) {
    writeKitFile(join(keep, hash), content);
  }
  return hash;
}

// The state of a worker kept between two calls of the guard, in the kit's ignored folder of its
// worktree rather than a shared temporary directory.
function stateFile(kind, project, input) {
  const key = createHash('sha256')
    .update(`${input.session_id ?? ''}\0${input.agent_id ?? ''}`)
    .digest('hex')
    .slice(0, 16);
  return join(project.root, GUARD_STATE, `${kind}-${key}.json`);
}

function writeState(file, state) {
  writeKitFile(file, JSON.stringify(state));
}

function describePlace(project, place) {
  if (place === undefined) {
    return 'files only the shell knows';
  }
  const path = projectPath(project, place);
  if (path === '{}' || path.endsWith('/{}')) {
    return path === '{}' ? 'files anywhere in the project' : `files under ${path.slice(0, -3)}`;
  }

  return path === '' ? 'the whole project' : path.startsWith('..') ? place : path;
}

function projectPath(project, file) {
  return relative(project.root, resolve(file)).split(sep).join('/');
}

// Each host reads the decision in its own shape. Codex cannot put a question to the user: what
// Claude Code asks is said to the user there, and left to the checks of the pipeline.
function decide(input, permissionDecision, reason) {
  const permissionDecisionReason = `ddd-ts-kit: ${reason}`;
  const host = hostOf(input);
  if (host === 'copilot') {
    return emit({ permissionDecision, permissionDecisionReason });
  }
  if (host === 'codex' && permissionDecision === 'ask') {
    return emit({ systemMessage: permissionDecisionReason });
  }
  const additionalContext = notice;
  notice = undefined;
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      permissionDecisionReason,
      ...(additionalContext ? { additionalContext } : {}),
    },
  });
}

function isChecked(file) {
  return /\.(ts|mts|cts)$/.test(file) || file.endsWith('CONTEXT.md');
}

// A run of the CLI, stopped at its time limit, and within what is left of a session start: past
// that, it is not started.
function runCli(project, args, timeout) {
  const left = briefingEnds === undefined ? Number.POSITIVE_INFINITY : briefingEnds - Date.now();
  const limit = Math.min(Math.round(timeout * TIME_SCALE), left);
  if (limit <= 0) {
    briefingCut = true;
    return undefined;
  }
  const run = spawnSync(process.execPath, [project.cli.bin, ...args], {
    cwd: project.root,
    encoding: 'utf8',
    timeout: limit,
    maxBuffer: ANSWER_BYTES,
  });
  if (run.error?.code === 'ETIMEDOUT') {
    timedOut.set(args[0], Math.round(limit / 1000));
    briefingCut = briefingEnds !== undefined;
  }
  if (run.error?.code === 'ENOBUFS') {
    oversized.add(args[0]);
  }
  // A report is an object of JSON: no output (a run that could not start, whose null parses as null),
  // `null` or a bare value is none.
  try {
    const report = JSON.parse(run.stdout);
    return isRecord(report) ? report : undefined;
  } catch {
    return undefined;
  }
}

function timeScale(asked) {
  const scale = Number(asked);
  return scale > 0 && scale <= 1 ? scale : 1;
}

function errorsOf(report) {
  return (report?.violations ?? []).filter((violation) => violation.severity === 'error');
}

function hasPendingChanges(project) {
  const status = gitRun(project, ['status', '--porcelain']);
  return status.status !== 0 || status.stdout.trim().length > 0;
}

function describe(violations) {
  return violations
    .map(
      (violation) =>
        `[${violation.ruleId}] ${violation.file}:${violation.line ?? 1} ${violation.message}\n  do instead: ${violation.fix ?? `see \`npx ddd-ts-kit explain ${violation.ruleId}\``}`,
    )
    .join('\n');
}

// Said once per session while the tree stays above the limits; a session start says it again.
function commitReminder(project, input, { repeat }) {
  const changes = (uncommittedChanges(project) ?? []).filter((change) => !isDerived(project, change.path));
  const lines = changes.reduce((sum, change) => sum + change.lines, 0);
  const marker = reminderMarker(project, input);
  if (changes.length <= project.commit.maxFiles && lines <= project.commit.maxLines) {
    return forget(marker);
  }
  if (alreadyRemembered(marker) && !repeat) {
    return undefined;
  }

  return `ddd-ts-kit: ${changes.length} changed files and ${lines} changed lines are uncommitted (advised at most ${project.commit.maxFiles} files and ${project.commit.maxLines} lines a commit, generated files not counted). Commit each finished slice on its own, with the files its generator wrote: ${describeSlices(project, changes)}. See the skill ddd-ts-kit:commit-discipline.`;
}

function uncommittedChanges(project) {
  const untracked = git(project, ['ls-files', '--others', '--exclude-standard', '-z']);
  if (untracked === undefined) {
    return undefined;
  }
  const tracked = (git(project, ['diff', '--numstat', '--no-renames', '--relative', '-z', 'HEAD']) ?? '')
    .split('\0')
    .filter(Boolean)
    .map(numstatChange);
  const fresh = untracked
    .split('\0')
    .filter(Boolean)
    .map((path) => ({ path, lines: lineCount(join(project.root, path)) }));

  return [...tracked, ...fresh];
}

// The output of git split into its fields, none when git fails.
function gitFields(checkout, args, separator) {
  return (git(checkout, args) ?? '').split(separator);
}

function git(project, args) {
  const run = gitRun(project, args);
  return run.status === 0 ? run.stdout : undefined;
}

function gitRun(project, args) {
  // A core.fsmonitor planted in the config never runs on the guard's own git, nor does a hook planted
  // in the repository (the guard commits nothing), and its status writes no index.
  return spawnSync(
    'git',
    ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '--no-optional-locks', ...args],
    {
      cwd: project.root,
      encoding: 'utf8',
      timeout: 5000,
      maxBuffer: ANSWER_BYTES,
    },
  );
}

function numstatChange(entry) {
  const [added, deleted, ...path] = entry.split('\t');
  return { path: path.join('\t'), lines: (Number(added) || 0) + (Number(deleted) || 0) };
}

// Read within its bound: a file larger, or that cannot be opened (a broken link, a device), counts no line.
function lineCount(file) {
  const { content } = readBounded(file, COUNTED_FILE_BYTES);
  return content === undefined
    ? 0
    : content.split('\n').filter((line, index, all) => index < all.length - 1 || line !== '').length;
}

function isDerived(project, path) {
  return (
    DERIVED_FILES.includes(path) || GENERATED_DOCUMENT.test(path) || isBarrel(project, path) || path === WORKER_SCOPE
  );
}

function describeSlices(project, changes) {
  const sizes = new Map();
  for (const { path } of changes) {
    sizes.set(sliceOf(project, path), (sizes.get(sliceOf(project, path)) ?? 0) + 1);
  }
  const slices = [...sizes]
    .sort(([, left], [, right]) => right - left)
    .map(([slice, files]) => `${slice} (${files} files)`);

  return slices.length > 8 ? `${slices.slice(0, 8).join(', ')} and ${slices.length - 8} more` : slices.join(', ');
}

// A slice is a use case of a context: its folder, its route and their specs travel together.
function sliceOf(project, path) {
  const inside = insideContexts(project, path);
  if (!inside) {
    return path.startsWith(`${project.platformDir}/`)
      ? 'platform'
      : path.includes('/')
        ? path.split('/')[0]
        : 'project root';
  }
  const [context, ...parts] = inside;
  // A module of the model holds its layers: a use case sits below it.
  const [layer, kind, useCase] = outsideItsModule(project, context, parts);
  if (layer === 'application' && (kind === 'commands' || kind === 'queries') && useCase) {
    return `${context}: ${useCase}`;
  }
  const named = /\/([^/.]+)\.(?:route|handler\.spec|route\.spec)\.ts$/.exec(path)?.[1];

  return named ? `${context}: ${named}` : `${context}: ${kind === undefined ? 'context files' : layer}`;
}

function reminderMarker(project, input) {
  const key = createHash('sha256')
    .update(`${project.root}\n${sessionOf(input)}`)
    .digest('hex')
    .slice(0, 24);
  return markerOf(project, 'commit-reminder', key);
}

function markerOf(project, kind, key) {
  return join(project.root, GUARD_MARKERS, `${kind}-${key}`);
}

// Leaves the marker and says whether it was there, in one exclusive creation that never follows nor
// rewrites a file put under its name, in a folder that is no link. Only the marker found there counts
// as remembered: one that cannot be left (a folder that is a link, a checkout that cannot be written)
// leaves what it guards said, or refused, again.
function alreadyRemembered(marker) {
  if (linkedFolder(marker)) {
    return false;
  }
  try {
    mkdirSync(dirname(marker), { recursive: true });
  } catch {
    return false;
  }
  try {
    writeFileSync(marker, '', { flag: 'wx', mode: 0o600 });
    return false;
  } catch (error) {
    return error?.code === 'EEXIST';
  }
}

function forget(marker) {
  removeKitFile(marker);
  return undefined;
}

// The markers and the runs of builders a week old, left by sessions and agents that ended, never
// through a folder that is a link.
function pruneGuardState(root) {
  const state = join(root, GUARD_STATE);
  const markers = join(root, GUARD_MARKERS);
  const files = [
    ...filesIn(state).filter((file) => BUILDER_STATE.test(relative(state, file))),
    ...filesIn(markers),
    ...filesIn(join(root, GUARD_HELD)),
  ];
  const before = Date.now() - MARKER_TTL;
  for (const file of files.filter((path) => statSync(path, { throwIfNoEntry: false })?.mtimeMs < before)) {
    removeKitFile(file);
  }
}

function filesIn(folder) {
  try {
    return readdirSync(folder).map((name) => join(folder, name));
  } catch {
    return [];
  }
}

function emit(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
