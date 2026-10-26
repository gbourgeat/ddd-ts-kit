import { CRITERION, ROW } from '../acceptance/scenarios-in';
import { countsOf, type PageCounts } from './counts-of';
import type { PageSection, SpecOfPage } from './page-section';
import type { RuleGroup, SpecRules } from './rules-in';

/** The word of a role, read from the suffix of a spec file: `slot.vo.spec.ts` is a value object. */
const ROLES: Readonly<Record<string, string>> = {
  aggregate: 'aggregate',
  entity: 'entity',
  vo: 'value object',
  service: 'domain service',
  'state-machine': 'state machine',
  handler: 'handler',
  policy: 'policy',
  'event-handler': 'event handler',
  'integration-handler': 'integration handler',
  publisher: 'publisher',
  job: 'job',
  'background-job': 'background job',
  process: 'process manager',
  projection: 'projection',
  repository: 'repository',
  contract: 'contract',
  controller: 'controller',
  route: 'route',
  guard: 'guard',
  mapper: 'mapper',
  reader: 'reader',
  document: 'document',
  e2e: 'end to end',
  acceptance: 'acceptance',
  regression: 'regression',
};

/**
 * A page of what the tests state, in the words of their titles: a heading, how it is made, the
 * counts, then one section per directory of specs, one heading per spec and its rules as they are
 * grouped. A planned rule (`it.todo`) and one put aside (`.skip`) say so.
 */
export function behaviourPage(heading: string, intro: string, sections: readonly PageSection[]): string {
  const body = sections.filter((section) => section.specs.length > 0).flatMap(sectionLines);

  return [
    `# ${heading}`,
    '',
    intro,
    '',
    summary(countsOf(sections)),
    ...(body.length === 0 ? ['', 'No spec yet.'] : body),
    '',
  ].join('\n');
}

function summary({ stated, planned, aside, specs }: PageCounts): string {
  const parts = [
    `${stated} ${stated === 1 ? 'rule' : 'rules'} stated`,
    ...(planned > 0 ? [`${planned} planned`] : []),
    ...(aside > 0 ? [`${aside} put aside`] : []),
  ];

  return `${parts.join(', ')}, in ${specs} ${specs === 1 ? 'spec' : 'specs'}.`;
}

function sectionLines(section: PageSection): string[] {
  return ['', `## ${section.title}`, ...section.specs.flatMap(specLines)];
}

function specLines({ file, rules }: SpecOfPage): string[] {
  return ['', `### ${specHeading(file)}`, '', `\`${file}\``, '', ...rulesLines(rules, 0)];
}

/** `calendars/slot.vo.spec.ts` reads `slot (value object), in calendars`. */
function specHeading(file: string): string {
  const directory = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
  const base = file.slice(directory === '' ? 0 : directory.length + 1).replace(/\.spec\.ts$/, '');
  const dot = base.lastIndexOf('.');
  const role = dot === -1 ? undefined : ROLES[base.slice(dot + 1)];
  const name = role === undefined ? base : base.slice(0, dot);

  return `${name}${role === undefined ? '' : ` (${role})`}${directory === '' ? '' : `, in ${directory}`}`;
}

function rulesLines(rules: SpecRules, depth: number): string[] {
  const indent = '  '.repeat(depth);

  return [
    ...rules.rules.map((rule) => `${indent}- ${ruleText(rule.title)}${suffix(rule.state)}`),
    ...rules.groups.flatMap((group) => groupLines(group, depth)),
  ];
}

function groupLines(group: RuleGroup, depth: number): string[] {
  return [`${'  '.repeat(depth)}- **${group.title}**`, ...rulesLines(group, depth + 1)];
}

function suffix(state: 'stated' | 'planned' | 'aside'): string {
  return state === 'planned' ? ' (planned)' : state === 'aside' ? ' (put aside)' : '';
}

/** The ids a title may open with: a row (`#US1.04`, `#FIX1`) and a criterion (`AC1`), as `acceptance` reads them. */
const LEADING_IDS = new RegExp(`^(?:\\s*(?:${ROW.source}|${CRITERION.source})[\\s,:;-]*)+`);

/** A rule as the business reads it: the title without the row ids and criteria it opens with, which date it to a change. */
function ruleText(title: string): string {
  const text = title.replace(LEADING_IDS, '').trim();

  return text === '' ? title : text;
}
