#!/usr/bin/env node
// Fails open by design: a guard that breaks must never block the work it guards.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

const CONFIG = 'ddd-ts-kit.config.json';
// The version of the packages the skills of this plugin describe. `release-version.mjs` keeps it
// the version of the kit: setting a new version of the packages rewrites it.
const KIT_VERSION = '0.25.1';
const PLAN = 'docs/architecture/plan.md';
const WORKER_SCOPE = '.ddd-ts-kit/worker.json';
// The report a worker keeps current after each commit and before it ends, ignored by git: what the conductor reads when it stops.
const WORKER_REPORT = '.ddd-ts-kit/report.md';
const WORKER_AGENT = 'context-builder';
// The host caps SessionStart context at 10 000 characters; a session should start far below it.
const SESSION_CONTEXT_LIMIT = 3000;
const COMMIT_DEFAULTS = { maxFiles: 20, maxLines: 600 };
const COUNTED_FILE_BYTES = 1_000_000;

// The contracts in YAML or JSON (openapi/<document>, the AsyncAPI document), the event catalog
// and the split of the contract that `ddd-ts-kit docs` writes in the platform.
const GENERATED_DOCUMENT =
  /^(?:openapi\/[^/]+|docs\/integration\/asyncapi)\.(?:ya?ml|json)$|^docs\/integration\/event-catalog\.md$|(?:^|\/)http\/openapi-documents\.ts$/;
const LOCKFILES = ['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb'];
// Rewritten by a command: counted in no commit size, merged by regenerating.
const DERIVED_FILES = [...LOCKFILES, '.dependency-cruiser.cjs', 'docs/context-map.md'];

const GENERATORS = [
  [/\.aggregate\.ts$/, 'aggregate <context> <Name>'],
  [/\.entity\.ts$/, 'entity <context> <Name>'],
  [/\.vo\.ts$/, 'value-object <context> <Name>'],
  [/\.vocabulary\.ts$/, 'vocabulary <context> <Name> --value <value>...'],
  [/\.event\.ts$/, 'domain-event <context> <Aggregate> <Fact>'],
  [/\.error\.ts$/, 'error <context> <Concept> <refusal>'],
  [/\/domain\/services\/[^/]+\.service\.ts$/, 'domain-service <context> <Name>'],
  [/\/domain\/repositories\/[^/]+\.repository\.ts$/, 'repository <context> <Aggregate>'],
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
];

// A journey crosses use cases, and often contexts: no single route generates it, so it is written by hand.
const JOURNEY = /^test\/e2e\/journey-[^/]+\.e2e\.spec\.ts$/;

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
  /^\.github\/workflows\//,
  /^\.claude\/settings\.json$/,
  /^\.claude\/rules\//,
  /^\.github\/instructions\//,
  /^\.github\/copilot\/settings\.json$/,
  /^\.github\/hooks\//,
  /^\.codex\//,
];

const ESCAPES = [
  [/ddd-ts-kit-disable/g, 'an architecture rule suppression'],
  [/eslint-disable/g, 'a lint suppression'],
  [/@ts-(ignore|nocheck|expect-error)/g, 'a compiler diagnostic suppression'],
  [/\b(it|test|describe)\.(skip|only)\b/g, 'a skipped or focused test'],
  [/\bas any\b/g, 'an `any` assertion'],
];

// Generators that write outside the context they are given: the config, registries of the platform, the schema.
const SHARED_GENERATORS = [
  'context',
  'repository',
  'integration-event',
  'job',
  'gateway',
  'policy',
  'service',
  'worker',
];
// A decision record of a worker's own slices: a new file of docs/adr/. With --deviation it also writes the config.
const DECISION_RECORD = /^docs\/adr\/[^/]+\.md$/;
// The migration a worker generates in its worktree, `npm run db:generate working-<what>`, as each
// migration tool writes it; the conductor generates the real one on the trunk at merge.
const WORKING_MIGRATION = /(^|\/)migrations\/(.+\/)?\d+[_-]working[_-][\w-]*(\.(sql|[cm]?[jt]s)|\/migration\.sql)$/;
const REPORT_TO_CONDUCTOR = 'Do not work around it: finish what you can and report the need to the conductor.';
// Where the guard keeps the state of a worker between two of its calls: the kit's ignored folder.
const GUARD_STATE = '.ddd-ts-kit/guard';
const FREE_OUTPUT = 'Output to /dev/null or to the system temp directory stays free.';
const EDIT_WITH_TOOLS = `Inside your scope, the editor tools and the shell may both write; outside it, nothing may. ${FREE_OUTPUT}`;
// The clean install of each package manager: what installs the lockfile as it is.
const CLEAN_INSTALL = { npm: 'npm ci', pnpm: 'pnpm install --frozen-lockfile' };

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

// How a worker's command can write files without the editor tools: the code an interpreter is
// given inline (from its option, from `-` or from its standard input).
const INLINE_CODE = {
  python: /^-[a-zA-Z]*c$/,
  node: /^(?:-[a-zA-Z]*[ep][a-zA-Z]*|--eval(?:=.*)?|--print(?:=.*)?)$/,
  bun: /^(?:-e|-p|--eval|--print)$/,
  ruby: /^-[a-zA-Z]*e[a-zA-Z]*$/,
  perl: /^-[a-zA-Z]*[eE][a-zA-Z]*$/,
  php: /^-r$/,
};
const OUTPUT_REDIRECTS = new Set(['>', '>>', '>|', '&>', '&>>', '<>']);
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

const MODES = {
  session,
  'pre-write': preWrite,
  'pre-bash': preBash,
  'post-write': postWrite,
  stop,
  'subagent-start': subagentStart,
  'subagent-stop': subagentStop,
};

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
  const directory = input.cwd ?? process.cwd();
  const project = findProject(directory);
  const lines = project ? projectBriefing(project, input) : planPointer(directory);
  if (lines.length === 0) {
    return;
  }
  emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } });
}

// A patch of Codex can touch several files: a refusal of any of them wins over a question.
async function preWrite(input) {
  if (isBuilder(input)) {
    const [first] = writesOf(input);
    await countBuilderCall(input, first && findProject(dirname(first.file)));
  }
  const pending = pendingOfWriter(input);
  if (pending) {
    decide(input, pending.mode === 'advise' ? 'ask' : 'deny', pending.reason);
    return;
  }
  const verdicts = writesOf(input)
    .map((written) => verdictOn(written, input))
    .filter(Boolean);
  const verdict = verdicts.find(({ decision }) => decision === 'deny') ?? verdicts[0];
  if (verdict) {
    decide(input, verdict.decision, verdict.reason);
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
  return pending?.reason ? { mode: project.mode, reason: pending.reason } : undefined;
}

function verdictOn({ file, written, replaced }, input) {
  const project = findProject(dirname(file));
  if (!project || project.mode === 'off') {
    return undefined;
  }
  const refusal =
    generatedFileReason(project, file) ??
    testWriterScopeReason(project, file, input) ??
    workerScopeReason(project, file, input) ??
    handWrittenRoleReason(project, file);
  if (refusal) {
    return { decision: project.mode === 'advise' ? 'ask' : 'deny', reason: refusal };
  }
  const deviation = governedFileReason(project, file) ?? escapeReason(written, replaced);
  return deviation ? { decision: 'ask', reason: deviation } : undefined;
}

async function preBash(input) {
  const command = toolInput(input).command;
  if (typeof command !== 'string') {
    return;
  }
  const project = findProject(commandDirectory(command, input.cwd ?? process.cwd()));
  await countBuilderCall(input, project, command);
  if (!project || project.mode === 'off') {
    return;
  }
  const preparing = workerPlaceReason(input, command) ?? oneSideMergeReason(project, input, command);
  if (preparing) {
    decide(input, project.mode === 'advise' ? 'ask' : 'deny', preparing);
    return;
  }
  const context = workerContext(project, input);
  if (!context) {
    return;
  }
  shell = await import('./shell-commands.mjs');
  const commands = shell.simpleCommands(command, input.cwd ?? process.cwd());
  const refusal = workerCommandReason(project, input, { context, command, commands });
  if (refusal) {
    decide(input, project.mode === 'advise' ? 'ask' : 'deny', refusal);
  }
}

// What a worker may not run: a file it must put back first, then what the command itself would do;
// a command allowed to run inline code has the files outside the scope noted before it.
function workerCommandReason(project, input, { context, command, commands }) {
  const pending = pendingChangeReason(project, input, commands);
  if (pending) {
    return pending.reason;
  }
  const refusal =
    sharedGeneratorReason(project, context, command) ??
    dependencyChangeReason(commands) ??
    workingMigrationReason(command) ??
    formatterReason(project, commands) ??
    fileChangeReason(project, input, commands);
  if (!refusal) {
    noteBeforeInlineCode(project, input, commands);
  }
  return refusal;
}

function postWrite(input) {
  const errors = writesOf(input)
    .filter(({ file }) => isChecked(file))
    .flatMap(({ file }) => {
      const project = findProject(dirname(file));
      return project?.cli && project.mode !== 'off'
        ? errorsOf(runCli(project, ['check-file', file, '--json'], 12000))
        : [];
    });
  if (errors.length === 0) {
    return;
  }
  const feedback = `ddd-ts-kit: the file just written breaks ${errors.length} architecture rule(s). Fix them now, do not suppress.\n${describe(errors)}`;
  // Codex hands the reason of a block to the model in place of the result of the tool.
  if (hostOf(input) === 'codex') {
    return emit({ decision: 'block', reason: feedback });
  }
  process.stderr.write(`${feedback}\n`);
  process.exitCode = 2;
}

// A context-builder of Claude Code: its tool calls are counted, its runs and stops recorded.
function isBuilder(input) {
  return hostOf(input) === 'claude' && String(input.agent_type ?? '').includes(WORKER_AGENT);
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
  return { state: stateFile('turns', home, input), worker };
}

async function countBuilderCall(input, project, command) {
  const places = isBuilder(input) && project?.mode !== 'off' ? builderPlaces(input, project) : undefined;
  if (places) {
    const runs = await import('./builder-runs.mjs');
    notice = runs.countCall(input, places, command);
  }
}

async function subagentStart(input) {
  const places = isBuilder(input) ? builderPlaces(input, undefined) : undefined;
  if (places) {
    (await import('./builder-runs.mjs')).startRun(input, places);
  }
}

async function subagentStop(input) {
  const places = isBuilder(input) ? builderPlaces(input, undefined) : undefined;
  const reason = places ? (await import('./builder-runs.mjs')).stopRun(input, places) : undefined;
  if (reason) {
    emit({ decision: 'block', reason });
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
  const reminder = commitReminder(project, input, { repeat: false });
  // A warning shown to the user, never a block: the size of a commit is advice.
  if (reminder) {
    emit({ systemMessage: reminder });
  }
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

  return alreadyRemembered(join(tmpdir(), `ddd-ts-kit-stop-${key}`));
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
// each followed by its lines, `+` added and `-` removed. Its paths are relative to the session.
function patchWrites(patch, cwd) {
  const writes = [];
  let current;
  for (const line of patch.split('\n')) {
    const header = /^\*\*\* (Add|Update|Delete) File: (.+)$/.exec(line);
    const moved = /^\*\*\* Move to: (.+)$/.exec(line);
    if (header) {
      current = header[1] === 'Delete' ? undefined : { file: resolve(cwd, header[2].trim()), added: [], removed: [] };
      writes.push(current);
    } else if (moved && current) {
      current.file = resolve(cwd, moved[1].trim());
    } else if (current && /^[+-]/.test(line)) {
      (line.startsWith('+') ? current.added : current.removed).push(line.slice(1));
    }
  }

  return writes
    .filter(Boolean)
    .map(({ file, added, removed }) => ({ file, written: added.join('\n'), replaced: removed.join('\n') }));
}

function findProject(from) {
  let directory = resolve(from);
  for (;;) {
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
  const config = readJson(join(root, CONFIG)) ?? {};
  const local = join(root, 'node_modules', '.bin', 'ddd-ts-kit');
  return {
    root,
    cli: existsSync(local) ? local : undefined,
    sourceRoot: config.sourceRoot ?? 'src',
    contextsDir: config.contextsDir ?? 'src/contexts',
    platformDir: config.platformDir ?? 'src/platform',
    commit: commitLimits(config.commit),
    packageManager: config.stack?.packageManager === 'pnpm' ? 'pnpm' : 'npm',
    // enforce: block; advise: ask the user; off: silent.
    mode: process.env.DDD_TS_KIT_GUARD ?? config.guard ?? 'enforce',
  };
}

function commitLimits(configured) {
  const limit = (key) =>
    Number.isInteger(configured?.[key]) && configured[key] > 0 ? configured[key] : COMMIT_DEFAULTS[key];
  return { maxFiles: limit('maxFiles'), maxLines: limit('maxLines') };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function projectBriefing(project, input) {
  const lines = [
    'ddd-ts-kit project (DDD, Clean Architecture). The rules are checked: `npx ddd-ts-kit explain <rule-id>`.',
    'Order of work: glossary of the context (CONTEXT.md), `npx ddd-ts-kit generate <kind> ... --json`, fill only the TODO(domain) places it lists, tests, `npx ddd-ts-kit check --changed-since <ref>`, then commit the slice.',
    'Never write by hand a file a generator produces; never edit a generated file (declaration barrels, contracts).',
    'Read `npx ddd-ts-kit list --json` and the CONTEXT.md of one context instead of browsing the tree.',
    ...(project.mode === 'off' ? [] : versionGap(project)),
    ...planPointer(project.root),
    ...workerNotice(project, input),
    ...workersToResume(project),
  ];
  if (project.cli) {
    lines.push('Contexts:', contextMap(project));
  } else {
    lines.push(installAdvice(project));
  }
  const reminder = project.mode === 'off' ? undefined : commitReminder(project, input, { repeat: true });

  return reminder ? [...lines, reminder] : lines;
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
  const installed = readJson(join(project.root, 'node_modules', 'ddd-ts-kit', 'package.json'))?.version;
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
  const next = /^Next:\s*(.+)$/m.exec(plan)?.[1]?.trim();

  return [
    `Plan: ${PLAN} (resume with /ddd-ts-kit:start). Next: ${(next ?? 'not stated, read the plan').slice(0, 300)}`,
  ];
}

function workerNotice(project, input) {
  const context = workerContext(project, input);
  return context
    ? [
        `Worker scope: bounded context "${context}" only (${project.contextsDir}/${context}/). Shared files belong to the conductor.`,
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
  return stopped.map(
    ({ branch, context, worktree, progress }) =>
      `Worker to resume: ${branch ?? worktree} (${progress.phase}${progress.agent ? `, agent ${progress.agent.agentId}` : ''}): \`npx ddd-ts-kit worker-scope ${context} --resume${workers.filter((other) => other.context === context).length > 1 ? ` --worktree ${worktree}` : ''}\`, then send what it prints.`,
  );
}

// Read from git's own files, without running git: the worktrees of the repository listed under
// its common directory, each with the path of its checkout.
function hasWorkerWorktree(root) {
  const top = repositoryTop(root);
  if (!top) {
    return false;
  }
  const dotGit = join(top, '.git');
  const gitDir = isDirectory(dotGit)
    ? dotGit
    : resolve(top, /^gitdir:\s*(.+)$/m.exec(readText(dotGit) ?? '')?.[1] ?? '');
  const common = resolve(gitDir, (readText(join(gitDir, 'commondir')) ?? '.').trim());
  const prefix = relative(top, root);
  let names;
  try {
    names = readdirSync(join(common, 'worktrees'));
  } catch {
    return false;
  }
  return names.some((name) => {
    const checkout = dirname((readText(join(common, 'worktrees', name, 'gitdir')) ?? '').trim());
    return checkout !== '.' && existsSync(join(checkout, prefix, WORKER_SCOPE));
  });
}

function repositoryTop(from) {
  for (let directory = resolve(from); ; directory = dirname(directory)) {
    if (existsSync(join(directory, '.git'))) {
      return directory;
    }
    if (dirname(directory) === directory) {
      return undefined;
    }
  }
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return undefined;
  }
}

function contextMap(project) {
  const listing = runCli(project, ['list', '--json'], 8000);
  const text = (listing?.contexts ?? []).map(contextLine).join('\n');
  return text.length > SESSION_CONTEXT_LIMIT
    ? `${text.slice(0, SESSION_CONTEXT_LIMIT)}\n(truncated: run \`npx ddd-ts-kit list\` for the rest)`
    : text;
}

function contextLine(context) {
  const size = (key) => (context[key] ?? []).length;
  const upstreams = (context.upstreams ?? []).map((upstream) => upstream.context ?? upstream).join(', ') || 'none';

  return `${context.name} [${context.classification}] upstreams: ${upstreams}; glossary: ${context.glossary ?? 0} terms; ${size('aggregates')} aggregates, ${size('commands')} commands, ${size('queries')} queries, ${size('publishedEvents')} published events`;
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
    ? `${path} is the generated barrel of its context. Never edit it: \`npx ddd-ts-kit generate ...\` and \`npx ddd-ts-kit docs\` rewrite it from the role files.`
    : undefined;
}

function isBarrel(project, path) {
  const [context, file, ...deeper] = insideContexts(project, path) ?? [];
  return deeper.length === 0 && file === `${context}.declarations.ts`;
}

function insideContexts(project, path) {
  return path.startsWith(`${project.contextsDir}/`) ? path.slice(project.contextsDir.length + 1).split('/') : undefined;
}

function testWriterScopeReason(project, file, input) {
  if (!String(input.agent_type ?? '').includes('domain-test-writer')) {
    return undefined;
  }
  const path = projectPath(project, file);
  return /(^|\/)test\//.test(path) || /\.spec\.ts$/.test(path)
    ? undefined
    : `The test writer changes tests only. ${path} is production code: report the defect instead of editing it.`;
}

function workerScopeReason(project, file, input) {
  const context = workerContext(project, input);
  if (!context) {
    return undefined;
  }
  const path = projectPath(project, file);
  if (
    path.startsWith(`${project.contextsDir}/${context}/`) ||
    /^test\/e2e\/[^/]+\.e2e\.spec\.ts$/.test(path) ||
    path === WORKER_REPORT ||
    isWorkingMigration(project, path) ||
    isOwnDecisionRecord(project, path)
  ) {
    return undefined;
  }
  const owner = insideContexts(project, path)
    ? 'belongs to another bounded context, which has its own worker'
    : 'is a shared file (config, composition root, platform, generated documents, migrations, dependencies) that only the conductor or a generator changes';

  return `You build the context "${context}": writes are limited to ${project.contextsDir}/${context}/ and its end-to-end specs. ${path} ${owner}. ${REPORT_TO_CONDUCTOR}`;
}

// A record the worker generated and has not committed yet; the records of the trunk are not its to rewrite.
function isOwnDecisionRecord(project, path) {
  return DECISION_RECORD.test(path) && git(project, ['ls-files', '--', path]) === '';
}

function isWorkingMigration(project, path) {
  return !insideContexts(project, path) && !path.startsWith(`${project.platformDir}/`) && WORKING_MIGRATION.test(path);
}

function workerContext(project, input) {
  if (!String(input.agent_type ?? '').includes(WORKER_AGENT)) {
    return undefined;
  }
  const context = process.env.DDD_TS_KIT_WORKER_CONTEXT ?? readJson(join(project.root, WORKER_SCOPE))?.context;
  return typeof context === 'string' && /^[a-z][a-z0-9-]*$/.test(context) ? context : undefined;
}

function handWrittenRoleReason(project, file) {
  const path = projectPath(project, file);
  if (existsSync(file) || JOURNEY.test(path) || !(insideContexts(project, path) || path.startsWith('test/e2e/'))) {
    return undefined;
  }
  if (/\.ports\.ts$/.test(path)) {
    return `${path} would be a file of tokens. A port is an abstract class and its own injection token, one per \`*.port.ts\`: \`npx ddd-ts-kit generate port <context> <Name> --json\`.`;
  }
  const generator = GENERATORS.find(([suffix]) => suffix.test(path));
  return generator
    ? `${path} is a new file of a generated role. Create it with \`npx ddd-ts-kit generate ${generator[1]} --json\`, then fill the TODO(domain) markers.`
    : undefined;
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
    /^\s*cd\s+("[^"]+"|'[^']+'|[^\s;&|]+)\s*(?:&&|;)/.exec(command);
  const directory = named?.[1]?.replace(/^["']|["']$/g, '');
  if (!directory) {
    return cwd;
  }

  return isAbsolute(directory) ? directory : resolve(cwd, directory);
}

// `worker-scope` adds a worktree and a branch: the conductor's to place, from the trunk. A sub-agent
// reads a briefing (`--dry-run`) or where a worker stands (`--resume`): both create nothing.
function workerPlaceReason(input, command) {
  return input.agent_type &&
    /ddd-ts-kit(?:@\S+)?\s+worker-scope\b/.test(command) &&
    !/--(?:dry-run|resume)\b/.test(command)
    ? 'Only the conductor prepares the place of a worker: `worker-scope` adds a git worktree and a branch. A sub-agent reads a briefing with `worker-scope <context> --dry-run`, or where a worker stands with `--resume`, which create nothing; if a worker is missing, report it to the conductor.'
    : undefined;
}

// Taking one side of a merge erases what the other side added without a conflict: a sub-agent
// resolves each hunk instead. A derived file outside the sources (openapi/, the context map) is
// taken from either side and regenerated, so only the sources and the tests are held.
function oneSideMergeReason(project, input, command) {
  if (!input.agent_type) {
    return undefined;
  }
  const merging = [...command.matchAll(/\bgit\s+(?:-[Cc]\s+\S+\s+)*(?:merge|pull)\b([^;&|]*)/g)].some(([, args]) =>
    /(?:^|\s)(?:-X\s*|--strategy-option[= ]\s*)(?:ours|theirs)\b|(?:^|\s)(?:-s\s*|--strategy[= ]\s*)ours\b/.test(args),
  );
  const directory = commandDirectory(command, input.cwd ?? process.cwd());
  const takingASide = [...command.matchAll(/\bgit\s+(?:-[Cc]\s+\S+\s+)*(?:checkout|restore)\b([^;&|]*)/g)].some(
    ([, args]) => /(?:^|\s)--(?:ours|theirs)\b/.test(args) && heldPaths(project, directory, args),
  );
  return merging || takingASide
    ? 'Taking one side of a merge (`-X theirs`, `-X ours`, `-s ours`, `checkout` or `restore --theirs/--ours` on a source or a test) erases what the other side added, without a conflict to show it. Resolve each hunk keeping the intent of both sides, `git add` the file, commit, then run `npx ddd-ts-kit verify-merge`: it lists any line, row or test the merge lost. A derived file is taken from either side and rewritten by `npm run regenerate`.'
    : undefined;
}

// A path under the source root or the tests, or the whole tree.
function heldPaths(project, directory, args) {
  return args
    .split(/\s+/)
    .filter((token) => token !== '' && !token.startsWith('-'))
    .map((token) => projectPath(project, resolve(directory, token.replace(/^["']|["']$/g, ''))))
    .some(
      (path) =>
        path === '' ||
        [project.sourceRoot, 'test', 'tests'].some((root) => path === root || path.startsWith(`${root}/`)),
    );
}

function sharedGeneratorReason(project, context, command) {
  for (const [, kind, target] of command.matchAll(
    /ddd-ts-kit(?:@\S+)?\s+(?:generate|g)\s+([a-z-]+)(?:\s+([A-Za-z0-9-]+))?/g,
  )) {
    if (kind === 'adr') {
      if (/--deviation\b/.test(command)) {
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
    const aggregate = kind === 'command' ? /--aggregate[= ]\s*([A-Za-z0-9]+)/.exec(command)?.[1] : undefined;
    if (aggregate && !hasRepository(project, context, aggregate)) {
      return `\`generate command --aggregate ${aggregate}\` would also create the repository of ${aggregate}, which registers in shared files. ${REPORT_TO_CONDUCTOR}`;
    }
  }
  return undefined;
}

function hasRepository(project, context, aggregate) {
  const name = aggregate.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  return existsSync(
    join(project.root, project.contextsDir, context, 'domain', 'repositories', `${name}.repository.ts`),
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

  return [...redirected, ...inPlaceTargets(command).map((file) => at(file.word, file.by))].filter(({ place }) =>
    isProjectPath(place),
  );
}

function isProjectPath(place) {
  return place === undefined || findProject(place) !== undefined;
}

function shellWriteReason(project, input, { place, by }) {
  if (place === undefined) {
    return `A worker writes with the shell only to a file it names: ${by} writes files only the shell knows. ${EDIT_WITH_TOOLS}`;
  }
  const owner = findProject(place);
  if (owner.root !== project.root) {
    return `A worker never changes a file outside its scope: ${by} writes ${place}, in another checkout. ${EDIT_WITH_TOOLS}`;
  }
  const refusal =
    generatedFileReason(project, place) ??
    workerScopeReason(project, place, input) ??
    handWrittenRoleReason(project, place);

  return refusal ? `${by}: ${refusal} ${FREE_OUTPUT}` : undefined;
}

// `sed -i`, `perl -i` and `tee` write the files they are given.
function inPlaceTargets({ words }) {
  const name = shell.commandName(words);
  if (name === 'tee') {
    return shell.operands(words.slice(1)).map((word) => ({ word, by: `\`tee\` writing ${word}` }));
  }
  const files = name === 'sed' || name === 'perl' ? inPlaceFiles(words.slice(1)) : [];

  return files.map((word) => ({ word, by: `\`${name} -i\` editing ${word}` }));
}

// The files of an in-place edit: every operand once the script is given by `-e` or `-f`, else all but the first.
function inPlaceFiles(args) {
  if (!args.some((word) => (/^-[a-zA-Z]*i/.test(word) && !word.startsWith('--')) || word.startsWith('--in-place'))) {
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

function inlineCode({ words, heredoc, piped, redirects }) {
  const name = shell.commandName(words);
  const language = name.replace(/[\d.]+$/, '');
  const args = words.slice(1);
  if (name === 'deno' && args[0] === 'eval') {
    return '`deno eval` runs inline code, which can write any file';
  }
  if (!(language in INLINE_CODE)) {
    return undefined;
  }
  const flag = args.find((word) => INLINE_CODE[language].test(word));
  const script = args.find((word) => !word.startsWith('-') || word === '-');
  const fed = heredoc || piped || redirects.some(({ operator }) => operator === '<' || operator === '<<<');
  const fromInput = script === '-' || (script === undefined && fed && !args.includes('-m'));

  return flag || fromInput
    ? `\`${name}${flag ? ` ${flag}` : ''}\` runs inline code, which can write any file`
    : undefined;
}

// The paths a command changes, each with what changes it.
function changedPaths({ words, directory }) {
  const name = shell.commandName(words);
  const at = (word, by) => ({ place: shell.placeOf(word, directory), by });
  if (name in PATH_COMMANDS) {
    return pathOperands(name, words.slice(1)).map((word) => at(word, name));
  }
  if (name === 'dd') {
    return words.filter((word) => word.startsWith('of=')).map((word) => at(word.slice(3), 'dd'));
  }
  if (name === 'find' && words.includes('-delete')) {
    const roots = words.slice(1, shell.firstExpression(words));
    return (roots.length > 0 ? roots : ['.']).map((root) => at(`${root}/{}`, 'find -delete'));
  }
  if (name === 'patch' && !words.includes('--dry-run')) {
    return [{ place: undefined, by: 'patch' }];
  }

  return name === 'git' ? gitChangedPaths(words.slice(1), directory) : [];
}

function pathOperands(name, args) {
  const { valued, changes } = PATH_COMMANDS[name];
  const target = args.findIndex((word) => word === '-t' || word === '--target-directory');
  const joined = args.find((word) => word.startsWith('--target-directory='));
  const words = shell.operands(args, [...valued, '-t', '--target-directory']);
  if (changes === 'all' || (name === 'install' && args.includes('-d'))) {
    return target === -1 ? words : [...words, args[target + 1]];
  }
  if (target !== -1 || joined) {
    return [target === -1 ? joined.slice('--target-directory='.length) : args[target + 1]];
  }

  return words.slice(-1);
}

// `git checkout -- <path>`, `git restore`, `git rm`, `git mv` and `git clean` rewrite or delete
// files of the work tree; `git apply` writes the files of a patch.
function gitChangedPaths(args, directory) {
  const { subcommand, tail, moved } = gitInvocation(args, directory);
  const at = (word) => ({ place: shell.placeOf(word, moved), by: `git ${subcommand}` });
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
    return (named.length > 0 ? named : ['.']).map(at);
  }
  const checking = tail.some((word) => /^--(check|stat|numstat|summary|cached)$/.test(word));

  return subcommand === 'apply' && !checking ? [{ place: undefined, by: 'git apply' }] : [];
}

// The options before the subcommand of git; `-C <directory>` moves where its paths are read from.
function gitInvocation(args, directory) {
  let index = 0;
  let moved = directory;
  while (index < args.length && args[index].startsWith('-')) {
    if (args[index] === '-C') {
      moved = shell.placeOf(args[index + 1] ?? shell.UNKNOWN, moved);
    }
    index += args[index] === '-C' || args[index] === '-c' ? 2 : 1;
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

// A path of no project is free; a path only the shell knows, or of another checkout, is not.
function outsideScope(project, input, place) {
  if (place === undefined) {
    return true;
  }
  const owner = findProject(place);
  if (owner === undefined) {
    return false;
  }

  return owner.root !== project.root || workerScopeReason(project, place, input) !== undefined;
}

// Inline code of a worker (`python3 - <<EOF`, `node -e`) runs, but its writes cannot be read in
// advance: the files outside the scope are noted before it, and compared at the next call of the
// guard by that worker. A file it changed there stops the worker until it is put back; the
// commands that put back exactly those files stay allowed.
function noteBeforeInlineCode(project, input, commands) {
  if (commands.some((command) => inlineCode(command) !== undefined)) {
    const before = Object.fromEntries(outsideChanges(project, input));
    writeState(stateFile('before-inline', project, input), before);
  }
}

function pendingChangeReason(project, input, commands) {
  settleInlineCode(project, input);
  const recorded = stateFile('outside', project, input);
  const changed = readJson(recorded);
  if (!changed) {
    return undefined;
  }
  const now = outsideChanges(project, input);
  const left = Object.entries(changed).filter(([path, was]) => (now.get(path)?.hash ?? null) !== (was?.hash ?? null));
  if (left.length === 0) {
    rmSync(recorded, { force: true });
    return undefined;
  }
  const paths = new Set(left.map(([path]) => path));
  if (commands.length > 0 && commands.every((command) => putsBack(project, command, paths))) {
    return { undoing: true };
  }

  return { reason: putBackReason(left, now) };
}

function settleInlineCode(project, input) {
  const noted = stateFile('before-inline', project, input);
  const before = readJson(noted);
  if (!before) {
    return;
  }
  rmSync(noted, { force: true });
  const now = outsideChanges(project, input);
  const changed = [...new Set([...Object.keys(before), ...now.keys()])].filter(
    (path) => (before[path]?.hash ?? null) !== (now.get(path)?.hash ?? null),
  );
  if (changed.length > 0) {
    const recorded = readJson(stateFile('outside', project, input)) ?? {};
    for (const path of changed) {
      recorded[path] ??= before[path] ?? null;
    }
    writeState(stateFile('outside', project, input), recorded);
  }
}

// A command that only puts back some of `paths`: `git restore`, `git checkout --`, `rm` of a new file.
function putsBack(project, command, paths) {
  const touched = [...changedPaths(command), ...writtenTargets(command)];
  return (
    touched.length > 0 &&
    touched.every(({ place }) => place !== undefined && paths.has(projectPath(project, place))) &&
    inlineCode(command) === undefined
  );
}

function putBackReason(left, now) {
  const restore = left.filter(([path, was]) => was !== null || !now.get(path)?.untracked).map(([path]) => path);
  const remove = left.filter(([path, was]) => was === null && now.get(path)?.untracked).map(([path]) => path);
  const steps = [
    ...(restore.length > 0 ? [`\`git restore -- ${restore.join(' ')}\``] : []),
    ...(remove.length > 0 ? [`\`rm ${remove.join(' ')}\``] : []),
  ];

  return `Your inline code changed files outside your scope: ${left.map(([path]) => path).join(', ')}. Put them back before anything else (${steps.join(', then ')}: allowed for these files), then change only files of your scope. ${REPORT_TO_CONDUCTOR}`;
}

// The files outside the scope that differ from HEAD, each with the hash of its content (null when
// deleted) and whether git tracks it; generated files are left out: a generator rewrites them.
function outsideChanges(project, input) {
  const status = git(project, ['status', '--porcelain=v1', '-z', '--untracked-files=all']) ?? '';
  const entries = status.split('\0');
  const changes = new Map();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (entry.length < 4) {
      continue;
    }
    const path = entry.slice(3);
    index += /^[RC]/.test(entry) ? 1 : 0;
    if (path.startsWith('.ddd-ts-kit/')) {
      continue;
    }
    const file = join(project.root, path);
    if (workerScopeReason(project, file, input) && !generatedFileReason(project, file)) {
      changes.set(path, { hash: contentHash(file), untracked: entry.startsWith('??') });
    }
  }
  return changes;
}

function contentHash(file) {
  try {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
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
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(state), { mode: 0o600 });
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

function runCli(project, args, timeout) {
  const run = spawnSync(project.cli, args, { cwd: project.root, encoding: 'utf8', timeout });
  try {
    return JSON.parse(run.stdout ?? '');
  } catch {
    return undefined;
  }
}

function errorsOf(report) {
  return (report?.violations ?? []).filter((violation) => violation.severity === 'error');
}

function hasPendingChanges(project) {
  const status = spawnSync('git', ['status', '--porcelain'], { cwd: project.root, encoding: 'utf8', timeout: 5000 });
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

function git(project, args) {
  const run = spawnSync('git', args, { cwd: project.root, encoding: 'utf8', timeout: 5000 });
  return run.status === 0 ? run.stdout : undefined;
}

function numstatChange(entry) {
  const [added, deleted, ...path] = entry.split('\t');
  return { path: path.join('\t'), lines: (Number(added) || 0) + (Number(deleted) || 0) };
}

// Sized and read through one descriptor: the file measured is the file counted.
function lineCount(file) {
  let descriptor;
  try {
    descriptor = openSync(file, 'r');

    return fstatSync(descriptor).size > COUNTED_FILE_BYTES
      ? 0
      : readFileSync(descriptor, 'utf8')
          .split('\n')
          .filter((line, index, all) => index < all.length - 1 || line !== '').length;
  } catch {
    return 0;
  } finally {
    if (descriptor !== undefined) {
      closeSync(descriptor);
    }
  }
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
  const [context, layer, kind, useCase] = inside;
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
  return join(tmpdir(), `ddd-ts-kit-commit-reminder-${key}`);
}

// Leaves the marker and says whether it was there, in one exclusive creation: the temp dir is shared,
// so the marker is private and never follows nor rewrites a file put under its name.
function alreadyRemembered(marker) {
  try {
    writeFileSync(marker, '', { flag: 'wx', mode: 0o600 });

    return false;
  } catch (error) {
    // Without a marker the reminder is only said more often.
    return error?.code === 'EEXIST';
  }
}

function forget(marker) {
  rmSync(marker, { force: true });
  return undefined;
}

function emit(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
