import { citedRows } from './cited-rows';
import { countsOf, type PageCounts } from './counts-of';
import type { PageEntry, PageSection } from './page-section';
import type { RuleGroup, SpecRules } from './rules-in';

/**
 * A page of what the tests state, in the words of their titles: a heading, how it is made, the
 * counts, then one section per part of the page (the use cases, the model, the reactions, a
 * directory of specs), one heading per entry, the specs it reads and their rules as they are
 * grouped. A planned rule (`it.todo`) and one put aside (`.skip`) say so.
 */
export function behaviourPage(heading: string, intro: string, sections: readonly PageSection[]): string {
  const body = sections.filter((section) => section.entries.length > 0).flatMap(sectionLines);

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
  return ['', `## ${section.title}`, ...section.entries.flatMap(entryLines)];
}

function entryLines({ heading, specs }: PageEntry): string[] {
  return [
    '',
    `### ${heading}`,
    '',
    specs.map((spec) => `\`${spec.file}\``).join(', '),
    '',
    ...specs.flatMap((spec) => rulesLines(spec.rules, 0)),
  ];
}

function rulesLines(rules: SpecRules, depth: number): string[] {
  const indent = '  '.repeat(depth);

  return [
    ...rules.rules.map((rule) => `${indent}- ${citedRows(rule.title).text}${suffix(rule.state)}`),
    ...rules.groups.flatMap((group) => groupLines(group, depth)),
  ];
}

function groupLines(group: RuleGroup, depth: number): string[] {
  return [`${'  '.repeat(depth)}- **${group.title}**`, ...rulesLines(group, depth + 1)];
}

function suffix(state: 'stated' | 'planned' | 'aside'): string {
  return state === 'planned' ? ' (planned)' : state === 'aside' ? ' (put aside)' : '';
}
