import { CONFIG_FILE, defaultAllowedPackages, type Config, type Deviation } from '../../config.js';
import { commentLines } from '../comments.js';
import { ADR_DIRECTORY, DecisionRecords, recordNumber, referencedRecord } from '../decision-records.js';
import { DEFAULT_SEVERITIES } from '../severity.js';
import { findSuppressions } from '../suppressions.js';
import type { Rule, SourceFile } from '../types.js';
import { lineOfSequence, reporter, toViolations, type Finding } from './helpers.js';

const DIRECTIVE = /^((?:ddd-ts-kit|eslint)-disable(?:-next-line|-line)?)(?![\w-])(.*)$/;
const RECORD_SHAPE = `${ADR_DIRECTORY}/NNNN-<slug>.md (context, what is deviated from, why, scope, condition for removing it)`;

export const governanceRecordedDeviation: Rule = {
  id: 'governance/recorded-deviation',
  description: 'A suppression, a lowered severity, an extra directory or an extra allowed package carries a reason and points to a decision record in docs/adr/.',
  scope: 'file',
  run(project) {
    const report = reporter(project, this.id);
    const records = new DecisionRecords(project.root);
    return project.files.flatMap((file) => toViolations(report, file.path, unrecordedSuppressions(file, records)));
  },
  acrossProject(project) {
    const records = new DecisionRecords(project.root);
    const { config, configText } = project;
    const findings = [...unrecordedRelaxations(config), ...config.deviations.flatMap((deviation) => flawedDeviation(deviation, records))];
    const located = findings.map(({ where, message, fix }) => ({ line: lineOfSequence(configText, where), message, fix }));
    return toViolations(reporter(project, this.id), CONFIG_FILE, located);
  },
};

function unrecordedSuppressions(file: SourceFile, records: DecisionRecords): Finding[] {
  const reportedElsewhere = new Set(
    findSuppressions(file)
      .filter((suppression) => suppression.ruleId === '' || suppression.reason === '')
      .map((suppression) => suppression.line),
  );
  return commentLines(file).flatMap((comment) => {
    const directive = comment.sample ? null : DIRECTIVE.exec(comment.text);
    if (directive === null || reportedElsewhere.has(comment.line)) return [];
    const [, name = '', rest = ''] = directive;
    const reason = rest.split('--').slice(1).join('--').trim();
    // A lint suppression without any reason is reported by clean/no-escape-hatch.
    if (reason === '' && name.startsWith('eslint')) return [];
    return withoutRecord(name, reason, records).map((finding) => ({ line: comment.line, ...finding }));
  });
}

type Unplaced = Omit<Finding, 'line'>;

function withoutRecord(name: string, reason: string, records: DecisionRecords): Unplaced[] {
  const number = referencedRecord(reason);
  if (number === undefined) {
    const fix = `Fix the cause instead; if the deviation is deliberate, write ${RECORD_SHAPE} and end the comment with \`-- ADR-NNNN: <reason>\`.`;
    return [{ message: `The suppression (${name}) points to no decision record.`, fix }];
  }
  if (records.has(number)) return [];
  return [{ message: `The suppression (${name}) refers to ADR-${number}, but ${ADR_DIRECTORY}/ holds no record with that number.`, fix: missingRecordFix(number) }];
}

function missingRecordFix(number: number): string {
  return `Write ${ADR_DIRECTORY}/${String(number).padStart(4, '0')}-<slug>.md (context, what is deviated from, why, scope, condition for removing it), or correct the number.`;
}

/** What the config relaxes, the `what` a deviation has to carry for it, and where the setting is written. */
interface Relaxation {
  readonly what: string;
  readonly said: string;
  readonly where: readonly string[];
}

interface ConfigFinding extends Unplaced {
  readonly where: readonly string[];
}

function unrecordedRelaxations(config: Config): ConfigFinding[] {
  const relaxations = [...loweredRules(config), ...extraDirectories(config), ...extraPackages(config), ...guardMode(config), ...eventsWithoutOutbox(config)];
  return relaxations
    .filter(({ what }) => !config.deviations.some((deviation) => deviation.what === what))
    .map(({ what, said, where }) => ({
      where,
      message: `${said}, and no deviation records why.`,
      fix: `Restore the default, or add { "what": "${what}", "adr": "NNNN", "reason": "<why>" } to "deviations" in ${CONFIG_FILE} and write ${RECORD_SHAPE}.`,
    }));
}

function loweredRules({ rules }: Config): Relaxation[] {
  return Object.entries(rules)
    .filter(([id, severity]) => severity === 'off' || (severity === 'warn' && (DEFAULT_SEVERITIES[id] ?? 'error') === 'error'))
    .map(([id, severity]) => ({ what: `rules.${id}`, said: `The rule "${id}" is lowered to "${severity}"`, where: ['"rules"', `"${id}":`] }));
}

function extraDirectories({ contexts }: Config): Relaxation[] {
  return Object.entries(contexts).flatMap(([name, context]) =>
    context.extraDirectories.map((directory) => ({
      what: `contexts.${name}.extraDirectories.${directory}`,
      said: `The context "${name}" adds the directory "${directory}" to the canonical tree`,
      where: ['"contexts"', `"${name}":`, '"extraDirectories"', `"${directory}"`],
    })),
  );
}

const PACKAGE_LISTS = ['domainAllowedPackages', 'applicationAllowedPackages', 'publishedLanguageAllowedPackages'] as const;

function extraPackages(config: Config): Relaxation[] {
  const defaults = defaultAllowedPackages(config.stack.validation);
  return PACKAGE_LISTS.flatMap((list) =>
    config[list]
      .filter((name) => !defaults[list].includes(name))
      .map((name) => ({ what: `${list}.${name}`, said: `The package "${name}" is added to ${list}`, where: [`"${list}"`, `"${name}"`] })),
  );
}

function guardMode({ guard }: Config): Relaxation[] {
  return guard === 'enforce' ? [] : [{ what: 'guard', said: `"guard" is "${guard}": the editor hook no longer refuses a violation`, where: ['"guard"'] }];
}

function eventsWithoutOutbox({ stack }: Config): Relaxation[] {
  if (stack.orm === 'none' || stack.database === 'none' || stack.events === 'outbox') return [];
  return [{ what: 'stack.events', said: `"stack.events" is "${stack.events}" although the project has a database`, where: ['"stack"', '"events"'] }];
}

function flawedDeviation({ what, adr, reason }: Deviation, records: DecisionRecords): ConfigFinding[] {
  const where = ['"deviations"', `"${what}"`];
  const number = recordNumber(adr);
  const entry = what === '' ? 'A deviation' : `The deviation "${what}"`;
  const flaws: Unplaced[] = [];
  if (what === '') flaws.push({ message: 'A deviation does not say what it relaxes.', fix: 'Set "what" to the setting it justifies, for example "rules.<id>", "guard" or "domainAllowedPackages.<package>".' });
  if (reason.trim() === '') flaws.push({ message: `${entry} gives no reason.`, fix: 'Write in "reason" why the default does not fit this project, in one sentence.' });
  if (number === undefined) flaws.push({ message: `${entry} names no decision record.`, fix: `Set "adr" to the number of the record, and write ${RECORD_SHAPE}.` });
  else if (!records.has(number)) flaws.push({ message: `${entry} points to ADR-${number}, but ${ADR_DIRECTORY}/ holds no record with that number.`, fix: missingRecordFix(number) });
  return flaws.map((flaw) => ({ where, ...flaw }));
}
