#!/usr/bin/env node
// Fails open by design: a guard that breaks must never block the work it guards.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

const CONFIG = 'ddd-ts-kit.config.json';
// SessionStart context is capped at 10 000 characters by the host.
const SESSION_CONTEXT_LIMIT = 8000;

const GENERATED_FILES = [
  'openapi/openapi.json',
  'docs/integration/asyncapi.json',
  'docs/integration/event-catalog.md',
];

const GENERATORS = [
  [/\.aggregate\.ts$/, 'aggregate <context> <Name>'],
  [/\.entity\.ts$/, 'entity <context> <Name>'],
  [/\.vo\.ts$/, 'value-object <context> <Name>'],
  [/\.event\.ts$/, 'domain-event <context> <Aggregate> <Fact>'],
  [/\.error\.ts$/, 'domain-error <context> <Name>'],
  [/\.command\.ts$/, 'command <context> <UseCase>'],
  [/\.query\.ts$/, 'query <context> <UseCase>'],
  [/\.port\.ts$/, 'port <context> <Name>'],
  [/\.route\.ts$/, 'route <context> <UseCase> --method <M> --path <p>'],
  [/\.consumer\.ts$/, 'consumer <context> <upstream> <event-type>'],
  [/\.publisher\.ts$/, 'integration-event <context> <Aggregate> <Fact>'],
  [/\.builder\.ts$/, 'builder <context> <Aggregate>'],
];

// Changing these is a decision about the rules themselves: the project owner confirms it.
const GOVERNED_FILES = [
  /^ddd-ts-kit\.config\.json$/,
  /^eslint\.config\.[cm]?js$/,
  /^\.dependency-cruiser\.c?js$/,
  /^knip\.json$/,
  /^lefthook\.yml$/,
  /^\.gitlab-ci\.yml$/,
  /^\.github\/workflows\//,
  /^\.claude\/settings\.json$/,
];

const ESCAPES = [
  [/ddd-ts-kit-disable/g, 'an architecture rule suppression'],
  [/eslint-disable/g, 'a lint suppression'],
  [/@ts-(ignore|nocheck|expect-error)/g, 'a compiler diagnostic suppression'],
  [/\b(it|test|describe)\.(skip|only)\b/g, 'a skipped or focused test'],
  [/\bas any\b/g, 'an `any` assertion'],
];

const MODES = { session, 'pre-write': preWrite, 'post-write': postWrite, stop };

main();

function main() {
  try {
    const run = MODES[process.argv[2]];
    if (run) run(readInput());
  } catch {
    process.exitCode = 0;
  }
}

function session(input) {
  const project = findProject(input.cwd ?? process.cwd());
  if (!project) return;
  const lines = [
    'This project follows ddd-ts-kit (DDD, Clean Architecture). The rules are checked: `npx ddd-ts-kit rules`.',
    'Order of work: glossary of the context (CONTEXT.md), then model, then `npx ddd-ts-kit generate <kind> ... --json`, then fill the TODO(domain) markers, then tests, then the quality gate.',
    'Never write by hand a file the generator produces. Never edit generated contracts.',
  ];
  if (project.cli) lines.push('Context map:', contextMap(project));
  else lines.push('The CLI is not installed in this project: `npm i -D ddd-ts-kit`.');
  emit({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } });
}

function preWrite(input) {
  const file = input.tool_input?.file_path;
  if (typeof file !== 'string') return;
  const project = findProject(dirname(file));
  if (!project || project.mode === 'off') return;
  const refusal =
    generatedFileReason(project, file) ??
    testWriterScopeReason(project, file, input) ??
    handWrittenRoleReason(project, file);
  if (refusal) return decide(project.mode === 'advise' ? 'ask' : 'deny', refusal);
  const deviation = governedFileReason(project, file) ?? escapeReason(input.tool_input);
  if (deviation) decide('ask', deviation);
}

function postWrite(input) {
  const file = input.tool_input?.file_path;
  if (typeof file !== 'string' || !isChecked(file)) return;
  const project = findProject(dirname(file));
  if (!project?.cli || project.mode === 'off') return;
  const report = runCli(project, ['check-file', file, '--json'], 12000);
  const errors = errorsOf(report);
  if (errors.length === 0) return;
  process.stderr.write(
    `ddd-ts-kit: the file just written breaks ${errors.length} architecture rule(s). Fix them now, do not suppress.\n${describe(errors)}\n`,
  );
  process.exitCode = 2;
}

function stop(input) {
  if (input.stop_hook_active) return;
  const project = findProject(input.cwd ?? process.cwd());
  if (!project?.cli || project.mode !== 'enforce' || !hasPendingChanges(project)) return;
  const errors = errorsOf(runCli(project, ['check', '--format', 'json'], 60000));
  if (errors.length === 0) return;
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

function findProject(from) {
  let directory = resolve(from);
  for (;;) {
    if (existsSync(join(directory, CONFIG))) return describeProject(directory);
    const parent = dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}

function describeProject(root) {
  const config = readJson(join(root, CONFIG)) ?? {};
  const local = join(root, 'node_modules', '.bin', 'ddd-ts-kit');
  return {
    root,
    cli: existsSync(local) ? local : undefined,
    contextsDir: config.contextsDir ?? 'src/contexts',
    // enforce: block; advise: ask the user; off: silent.
    mode: process.env.DDD_TS_KIT_GUARD ?? config.guard ?? 'enforce',
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function contextMap(project) {
  const listing = spawnSync(project.cli, ['list'], { cwd: project.root, encoding: 'utf8', timeout: 8000 });
  const text = listing.status === 0 ? listing.stdout.trim() : '';
  return text.length > SESSION_CONTEXT_LIMIT
    ? `${text.slice(0, SESSION_CONTEXT_LIMIT)}\n(truncated: run \`npx ddd-ts-kit list\` for the rest)`
    : text;
}

function generatedFileReason(project, file) {
  const path = projectPath(project, file);
  return GENERATED_FILES.includes(path)
    ? `${path} is generated. Change the route or event declaration, then run \`npm run docs:generate\`.`
    : undefined;
}

function testWriterScopeReason(project, file, input) {
  if (!String(input.agent_type ?? '').includes('domain-test-writer')) return undefined;
  const path = projectPath(project, file);
  return /(^|\/)test\//.test(path) || /\.spec\.ts$/.test(path)
    ? undefined
    : `The test writer changes tests only. ${path} is production code: report the defect instead of editing it.`;
}

function handWrittenRoleReason(project, file) {
  const path = projectPath(project, file);
  if (!path.startsWith(`${project.contextsDir}/`) || existsSync(file)) return undefined;
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

function escapeReason(toolInput) {
  const added = ESCAPES.find(([pattern]) => count(writtenText(toolInput), pattern) > count(replacedText(toolInput), pattern));
  return added
    ? `This change adds ${added[1]}. Fix the cause instead; if the deviation is deliberate, the project owner confirms it and it carries a reason pointing to a decision record in docs/adr/.`
    : undefined;
}

function writtenText(toolInput) {
  const edits = Array.isArray(toolInput.edits) ? toolInput.edits.map((edit) => edit.new_string ?? '') : [];
  return [toolInput.content ?? '', toolInput.new_string ?? '', ...edits].join('\n');
}

function replacedText(toolInput) {
  const edits = Array.isArray(toolInput.edits) ? toolInput.edits.map((edit) => edit.old_string ?? '') : [];
  return [toolInput.old_string ?? '', ...edits].join('\n');
}

function count(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

function projectPath(project, file) {
  return relative(project.root, resolve(file)).split(sep).join('/');
}

function decide(permissionDecision, reason) {
  emit({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision,
      permissionDecisionReason: `ddd-ts-kit: ${reason}`,
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

function emit(output) {
  process.stdout.write(`${JSON.stringify(output)}\n`);
}
