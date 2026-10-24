import {
  CONFIG_FILE,
  COVERAGE_LAYERS,
  COVERAGE_METRICS,
  defaultAllowedPackages,
  MUTATION_LAYERS,
  REFERENCE_COVERAGE,
  REFERENCE_MUTATION,
  type Config,
  type Deviation,
} from '../../config';
import { DEFAULT_SEVERITIES } from '../catalogue/default-severities';
import { commentLines } from '../comments/comment-lines';
import { ADR_DIRECTORY } from '../governance/adr-directory';
import { DecisionRecords } from '../governance/decision-records';
import { recordNumber } from '../governance/record-number';
import { referencedRecord } from '../governance/referenced-record';
import type { Finding } from '../model/finding';
import type { Flaw } from '../model/flaw';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { findSuppressions } from '../suppressions/find-suppressions';
import { lineOfSequence } from '../support/line-of-sequence';
import { perFile } from '../support/per-file';
import { reporter } from '../support/reporter';
import { toViolations } from '../support/to-violations';

const DIRECTIVE = /^((?:ddd-ts-kit|eslint)-disable(?:-next-line|-line)?)(?![\w-])(.*)$/;
const RECORD_SHAPE = `${ADR_DIRECTORY}/NNNN-<slug>.md (context, what is deviated from, why, scope, condition for removing it)`;

const PACKAGE_LISTS = [
  'domainAllowedPackages',
  'applicationAllowedPackages',
  'publishedLanguageAllowedPackages',
] as const;

/** What the config relaxes, the `what` a deviation has to carry for it, and where the setting is written. */
interface Relaxation {
  readonly what: string;
  readonly said: string;
  readonly where: readonly string[];
}

interface ConfigFinding extends Flaw {
  readonly where: readonly string[];
}

export const governanceRecordedDeviation: Rule = {
  id: 'governance/recorded-deviation',
  description:
    'A suppression, a lowered severity, a lowered coverage threshold, an extra directory or an extra allowed package carries a reason and points to a decision record in docs/adr/.',
  scope: 'file',
  run(project) {
    const records = new DecisionRecords(project.root);

    return perFile(project, this.id, (file) => unrecordedSuppressions(file, records));
  },
  acrossProject(project) {
    const records = new DecisionRecords(project.root);
    const { config, configText } = project;

    const findings = [
      ...unrecordedRelaxations(config),
      ...config.deviations.flatMap((deviation) => flawedDeviation(deviation, records)),
    ];

    const located = findings.map(({ where, message, fix }) => ({
      line: lineOfSequence(configText, where),
      message,
      fix,
    }));

    return toViolations(reporter(project, this.id), CONFIG_FILE, located);
  },
};

function unrecordedSuppressions(file: SourceFile, records: DecisionRecords): Finding[] {
  const incomplete = findSuppressions(file).filter(
    (suppression) => suppression.ruleId === '' || suppression.reason === '',
  );

  const reportedElsewhere = new Set(incomplete.map((suppression) => suppression.line));

  return commentLines(file).flatMap((comment) => {
    const directive = comment.sample ? null : DIRECTIVE.exec(comment.text);

    if (directive === null || reportedElsewhere.has(comment.line)) {
      return [];
    }

    const [, name = '', rest = ''] = directive;
    const reason = rest.split('--').slice(1).join('--').trim();

    // A lint suppression without any reason is reported by clean/no-escape-hatch.
    if (reason === '' && name.startsWith('eslint')) {
      return [];
    }

    return withoutRecord(name, reason, records).map((flaw) => ({ line: comment.line, ...flaw }));
  });
}

function withoutRecord(name: string, reason: string, records: DecisionRecords): Flaw[] {
  const number = referencedRecord(reason);

  if (number === undefined) {
    const fix = `Fix the cause instead; if the deviation is deliberate, write ${RECORD_SHAPE} and end the comment with \`-- ADR-NNNN: <reason>\`.`;

    return [{ message: `The suppression (${name}) points to no decision record.`, fix }];
  }

  if (records.has(number)) {
    return [];
  }

  return [
    {
      message: `The suppression (${name}) refers to ADR-${number}, but ${ADR_DIRECTORY}/ holds no record with that number.`,
      fix: missingRecordFix(number),
    },
  ];
}

function missingRecordFix(number: number): string {
  return `Write ${ADR_DIRECTORY}/${String(number).padStart(4, '0')}-<slug>.md (context, what is deviated from, why, scope, condition for removing it), or correct the number.`;
}

function unrecordedRelaxations(config: Config): ConfigFinding[] {
  const relaxations = [
    ...loweredRules(config),
    ...loweredCoverage(config),
    ...loweredMutation(config),
    ...extraDirectories(config),
    ...extraPackages(config),
    ...guardMode(config),
    ...eventsWithoutOutbox(config),
  ];

  return relaxations
    .filter(({ what }) => !config.deviations.some((deviation) => deviation.what === what))
    .map(({ what, said, where }) => ({
      where,
      message: `${said}, and no deviation records why.`,
      fix: `Restore the default, or add { "what": "${what}", "adr": "NNNN", "reason": "<why>" } to "deviations" in ${CONFIG_FILE} and write ${RECORD_SHAPE}.`,
    }));
}

function loweredRules({ rules }: Config): Relaxation[] {
  return Object.entries(rules).flatMap(([id, setting]) => {
    const severity = typeof setting === 'string' ? setting : setting.severity;
    const lowered = severity === 'off' || (severity === 'warn' && (DEFAULT_SEVERITIES[id] ?? 'error') === 'error');
    const scope = typeof setting === 'string' ? '' : ' for some files';

    return lowered
      ? [
          {
            what: `rules.${id}`,
            said: `The rule "${id}" is lowered to "${severity}"${scope}`,
            where: ['"rules"', `"${id}":`],
          },
        ]
      : [];
  });
}

/** Raising a threshold is free; a rate under the reference accepts code no test has run. */
function loweredCoverage({ coverage }: Config): Relaxation[] {
  return COVERAGE_LAYERS.flatMap((layer) =>
    COVERAGE_METRICS.filter((metric) => coverage[layer][metric] < REFERENCE_COVERAGE[layer][metric]).map((metric) => ({
      what: `coverage.${layer}.${metric}`,
      said: `The coverage threshold "${layer}.${metric}" is ${coverage[layer][metric]}, below the reference of ${REFERENCE_COVERAGE[layer][metric]}`,
      where: ['"coverage"', `"${layer}"`, `"${metric}"`],
    })),
  );
}

/** A floor under the reference accepts mutants no test notices. */
function loweredMutation({ mutation }: Config): Relaxation[] {
  return MUTATION_LAYERS.filter((layer) => mutation[layer] < REFERENCE_MUTATION[layer]).map((layer) => ({
    what: `mutation.${layer}`,
    said: `The mutation floor "${layer}" is ${mutation[layer]}, below the reference of ${REFERENCE_MUTATION[layer]}`,
    where: ['"mutation"', `"${layer}"`],
  }));
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

function extraPackages(config: Config): Relaxation[] {
  const defaults = defaultAllowedPackages(config.stack.validation);

  return PACKAGE_LISTS.flatMap((list) =>
    config[list]
      .filter((name) => !defaults[list].includes(name))
      .map((name) => ({
        what: `${list}.${name}`,
        said: `The package "${name}" is added to ${list}`,
        where: [`"${list}"`, `"${name}"`],
      })),
  );
}

function guardMode({ guard }: Config): Relaxation[] {
  return guard === 'enforce'
    ? []
    : [
        {
          what: 'guard',
          said: `"guard" is "${guard}": the editor hook no longer refuses a violation`,
          where: ['"guard"'],
        },
      ];
}

function eventsWithoutOutbox({ stack }: Config): Relaxation[] {
  if (stack.orm === 'none' || stack.database === 'none' || stack.events === 'outbox') {
    return [];
  }

  return [
    {
      what: 'stack.events',
      said: `"stack.events" is "${stack.events}" although the project has a database`,
      where: ['"stack"', '"events"'],
    },
  ];
}

function flawedDeviation({ what, adr, reason }: Deviation, records: DecisionRecords): ConfigFinding[] {
  const entry = what === '' ? 'A deviation' : `The deviation "${what}"`;
  const flaws: Flaw[] = [];

  if (what === '') {
    flaws.push({
      message: 'A deviation does not say what it relaxes.',
      fix: 'Set "what" to the setting it justifies, for example "rules.<id>", "guard", "coverage.<layer>.<rate>", "mutation.domain" or "domainAllowedPackages.<package>".',
    });
  }

  if (reason.trim() === '') {
    flaws.push({
      message: `${entry} gives no reason.`,
      fix: 'Write in "reason" why the default does not fit this project, in one sentence.',
    });
  }

  return [...flaws, ...unrecorded(entry, adr, records)].map((flaw) => ({
    where: ['"deviations"', `"${what}"`],
    ...flaw,
  }));
}

function unrecorded(entry: string, adr: string, records: DecisionRecords): Flaw[] {
  const number = recordNumber(adr);

  if (number === undefined) {
    return [
      {
        message: `${entry} names no decision record.`,
        fix: `Set "adr" to the number of the record, and write ${RECORD_SHAPE}.`,
      },
    ];
  }

  if (records.has(number)) {
    return [];
  }

  return [
    {
      message: `${entry} points to ADR-${number}, but ${ADR_DIRECTORY}/ holds no record with that number.`,
      fix: missingRecordFix(number),
    },
  ];
}
