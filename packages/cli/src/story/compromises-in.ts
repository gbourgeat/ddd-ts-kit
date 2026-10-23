import { sectionOf } from '../stories/section-of.js';

const COMPROMISES = /^###\s+compromises\s*$/i;
const HEADING = /^#{1,3}\s/;

/**
 * The names the report of a story lists as compromises, each as inline code under
 * `### Compromises` of its `## Report`, as a design cites them (a `:line`, `()` or type arguments
 * after a name left out): what the row built otherwise than its design, said.
 */
export function compromisesIn(text: string): Set<string> {
  const report = sectionOf(text, 'Report');

  if (report === undefined) {
    return new Set();
  }

  const lines = report.split('\n');
  const heading = lines.findIndex((line) => COMPROMISES.test(line.trim()));

  if (heading === -1) {
    return new Set();
  }

  const end = lines.findIndex((line, at) => at > heading && HEADING.test(line));
  const listed = lines.slice(heading + 1, end === -1 ? undefined : end).join('\n');

  return new Set([...listed.matchAll(/`([^`\s]+)`/g)].map(([, name = '']) => cleaned(name)));
}

function cleaned(name: string): string {
  return name
    .replace(/:\d+(?::\d+)?$/, '')
    .replace(/\(\)$/, '')
    .replace(/^([\w.]+)<.*>$/, '$1');
}
