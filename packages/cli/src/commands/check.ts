import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runCheck, summarize, type CheckResult } from '../check/engine.js';
import { RULE_DOCS } from '../check/explain.js';
import { runSelfCheck } from '../check/fixtures.js';
import { formatCheck, type CheckFormat } from '../check/format.js';
import { loadLooseProject, loadProject, toPosix } from '../check/project.js';
import { CLEAN_RULE_IDS, ESLINT_AUTHORITY, ESLINT_ONLY_RULES, KNOWN_RULE_IDS, RULE_IDS, RULES, SUPPRESSION_RULE } from '../check/rules/index.js';
import { DEFAULT_SEVERITIES } from '../check/severity.js';
import type { Violation } from '../check/types.js';
import { CONFIG_FILE, isOneOf, readConfig, SEVERITIES } from '../config.js';
import { CliError } from '../errors.js';
import { Arguments, findRoot, type Command, type Io } from './args.js';

export const checkCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {
    rule: { type: 'string', multiple: true },
    format: { type: 'string' },
    'changed-since': { type: 'string' },
    self: { type: 'boolean', default: false },
    'clean-only': { type: 'boolean', default: false },
  });
  if (args.flag('self')) return selfCheck(args, io);
  const format = formatOf(args);
  const rules = knownRules(args.many('rule'));
  const result = args.flag('clean-only') ? checkCleanliness(args, rules) : checkProject(args, rules);
  io.out(formatCheck(result, format));
  return result.errorCount > 0 ? 1 : 0;
};

function selfCheck(args: Arguments, io: Io): number {
  const outcomes = runSelfCheck();
  const failed = outcomes.filter((outcome) => !outcome.ok);
  if (args.json) {
    const fixtures = outcomes.map(({ fixture, ok, detail }) => ({ ruleId: fixture.ruleId, name: fixture.name, ok, detail }));
    io.out(JSON.stringify({ ok: failed.length === 0, fixtures }, null, 2));
  } else {
    for (const { fixture, ok, detail } of outcomes) io.out(`${ok ? 'ok  ' : 'FAIL'}  ${fixture.ruleId}: ${fixture.name}${ok ? '' : `\n      ${detail}`}`);
    io.out(`\n${outcomes.length - failed.length}/${outcomes.length} rule fixtures behave as expected.`);
  }
  return failed.length === 0 ? 0 : 1;
}

function formatOf(args: Arguments): CheckFormat {
  const format = args.json ? 'json' : (args.text('format') ?? 'text');
  if (isOneOf<CheckFormat>(['text', 'json', 'github', 'gitlab'], format)) return format;
  throw new CliError(`Unknown format "${format}".`, 'Use one of: text, json, github, gitlab.');
}

function knownRules(ids: readonly string[]): readonly string[] {
  const unknown = ids.find((id) => !RULE_IDS.includes(id));
  if (unknown === undefined) return ids;
  if (KNOWN_RULE_IDS.includes(unknown)) {
    throw new CliError(`The rule "${unknown}" is ${ESLINT_AUTHORITY}, not by this command.`, 'Run `npm run lint` for it; `ddd-ts-kit check` holds the rules listed by `ddd-ts-kit rules` without that mention.');
  }
  throw new CliError(`Unknown rule "${unknown}".`, `Use one of: ${RULE_IDS.join(', ')}.`);
}

/** The rules that judge a file on its own, on any directories: no project, no config. */
function checkCleanliness(args: Arguments, rules: readonly string[]): CheckResult {
  const directories = args.positionals.length > 0 ? args.positionals : ['.'];
  const selected = rules.length > 0 ? rules.filter((id) => CLEAN_RULE_IDS.includes(id)) : CLEAN_RULE_IDS;
  const project = loadLooseProject(args.workingDirectory, directories.map((entry) => toPosix(path.normalize(entry))));
  return runCheck(project, { rules: selected });
}

function checkProject(args: Arguments, rules: readonly string[]): CheckResult {
  const cwd = args.workingDirectory;
  const root = findRoot(cwd);
  const result = runCheck(loadProject(root), { rules });
  const scopes = args.positionals.map((entry) => toPosix(path.relative(root, path.resolve(cwd, entry))).replace(/\/$/, ''));
  const ref = args.text('changed-since');
  const changed = ref === undefined ? undefined : changedFiles(root, ref);
  const reported = result.violations.filter((violation) => isInScope(violation, scopes) && (changed === undefined || changed.has(violation.file)));
  return summarize(reported, result);
}

function isInScope(violation: Violation, scopes: readonly string[]): boolean {
  return scopes.length === 0 || scopes.some((scope) => scope === '' || violation.file === scope || violation.file.startsWith(`${scope}/`));
}

function changedFiles(root: string, ref: string): Set<string> {
  try {
    // The only place git is invoked, and only to read the user's own history.
    const output = execFileSync('git', ['diff', '--name-only', '--relative', `${ref}...`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return new Set(output.split('\n').map((line) => line.trim()).filter((line) => line !== ''));
  } catch {
    throw new CliError(`Could not list the files changed since "${ref}".`, 'Check that the directory is a git repository and that the ref exists (fetch it in CI with enough history).');
  }
}

export const checkFileCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const [target, ...extra] = args.positionals;
  if (target === undefined || extra.length > 0) {
    throw new CliError('check-file expects exactly one path.', 'Usage: ddd-ts-kit check-file <path> [--json]');
  }
  const absolute = path.resolve(args.workingDirectory, target);
  const root = findRoot(path.dirname(absolute));
  const file = toPosix(path.relative(root, absolute));
  const result = isProjectSource(root, file) ? runCheck(loadProject(root, { onlyFile: file }), { fileScopeOnly: true }) : summarize([]);
  io.out(formatCheck(result, args.json ? 'json' : 'text'));
  return result.errorCount > 0 ? 1 : 0;
};

/** Files outside the source root, or that are not sources, have no per-file rule: a hook stays silent on them. */
function isProjectSource(root: string, file: string): boolean {
  const { config } = readConfig(root);
  return /\.(?:ts|mts|cts)$/.test(file) && !file.endsWith('.d.ts') && file.startsWith(`${config.sourceRoot}/`) && fs.existsSync(path.join(root, file));
}

export const rulesCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const rules = listedRules(args.projectRoot);
  const width = Math.max(...rules.map((rule) => rule.id.length));
  io.out(args.json ? JSON.stringify(rules, null, 2) : rules.map((rule) => `${rule.id.padEnd(width)}  ${rule.severity.padEnd(5)}  ${rule.description}`).join('\n'));
  return 0;
};

interface ListedRule {
  readonly id: string;
  readonly severity: string;
  readonly description: string;
  /** Which analyzer decides: this checker, or ESLint for the rules that need a syntax tree. */
  readonly checkedBy: string;
}

function listedRules(root: string): ListedRule[] {
  const configured = fs.existsSync(path.join(root, CONFIG_FILE)) ? readConfig(root).config.rules : {};
  const severityOf = (id: string): string => {
    const severity = configured[id];
    return isOneOf(SEVERITIES, severity) ? severity : (DEFAULT_SEVERITIES[id] ?? 'error');
  };
  const own = [...RULES, SUPPRESSION_RULE].map((rule) => ({ id: rule.id, severity: severityOf(rule.id), description: rule.description, checkedBy: 'ddd-ts-kit check' }));
  const delegated = ESLINT_ONLY_RULES.map((rule) => ({ id: rule.id, severity: severityOf(rule.id), description: `${rule.description} (${ESLINT_AUTHORITY})`, checkedBy: '@ddd-ts-kit/eslint-plugin' }));
  return [...own, ...delegated];
}

export const explainCommand: Command = (argv, io) => {
  const args = Arguments.parse(argv, {});
  const [id] = args.positionals;
  if (id === undefined) throw new CliError('explain needs a rule id.', `Use one of: ${KNOWN_RULE_IDS.join(', ')}.`);
  const delegated = ESLINT_ONLY_RULES.find((rule) => rule.id === id);
  if (delegated !== undefined) {
    io.out(args.json ? JSON.stringify({ ...delegated, checkedBy: '@ddd-ts-kit/eslint-plugin' }, null, 2) : explainDelegated(delegated));
    return 0;
  }
  const explanation = explanationOf(id);
  io.out(args.json ? JSON.stringify(explanation, null, 2) : formatExplanation(explanation));
  return 0;
};

function explainDelegated(rule: { id: string; description: string }): string {
  const eslintName = `ddd-ts-kit/${rule.id.replace('/', '-')}`;
  return [rule.id, '', rule.description, '', `This rule reads the shape of a class, which needs a syntax tree: it is ${ESLINT_AUTHORITY} as \`${eslintName}\` (\`npm run lint\`), not by \`ddd-ts-kit check\`. Its severity is still set under "rules" in ${CONFIG_FILE}.`].join('\n');
}

interface Explanation {
  readonly id: string;
  readonly description: string;
  readonly why: string;
  readonly bad: string;
  readonly good: string;
}

function explanationOf(id: string): Explanation {
  knownRules([id]);
  const rule = [...RULES, SUPPRESSION_RULE].find((candidate) => candidate.id === id);
  const doc = RULE_DOCS[id];
  if (rule === undefined || doc === undefined) throw new CliError(`The rule "${id}" has no explanation.`, 'Report this as a bug of ddd-ts-kit.');
  return { id, description: rule.description, ...doc };
}

function formatExplanation(explanation: Explanation): string {
  const indent = (block: string): string => block.split('\n').map((line) => `    ${line}`).join('\n');
  const suppress = `Suppress one line (with a reason): // ddd-ts-kit-disable-next-line ${explanation.id} -- <reason>`;
  const { id, description, why, bad, good } = explanation;
  return [id, '', description, '', `Why: ${why}`, '', 'Bad:', indent(bad), '', 'Good:', indent(good), '', suppress].join('\n');
}
