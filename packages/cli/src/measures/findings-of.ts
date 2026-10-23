import { sectionOf } from '../stories/section-of.js';
import type { Finding } from './finding.js';

const PASS_ITEM = /^\s*[-*]\s+\**([A-Za-z][\w -]{0,30}?)\**\s*:\s*(.+)$/;
const ITEM = /^\s*[-*]\s+(.+)$/;
const HEADING = /^###\s+(.+)$/;

/**
 * The items of `## Findings` of a review file, each under its pass: the `### <pass>` heading
 * above it, else the word before the colon of the item, else `unsorted`. None without the section.
 */
export function findingsOf(review: string): Finding[] {
  const section = sectionOf(review, 'Findings');

  if (section === undefined) {
    return [];
  }

  let pass = '';

  return section.split('\n').flatMap((line) => {
    const heading = HEADING.exec(line.trim());

    if (heading !== null) {
      pass = (heading[1] ?? '').trim().toLowerCase();

      return [];
    }

    return findingOf(line, pass);
  });
}

function findingOf(line: string, heading: string): Finding[] {
  const named = PASS_ITEM.exec(line);

  if (named !== null && heading === '') {
    return [{ pass: (named[1] ?? '').trim().toLowerCase(), text: (named[2] ?? '').trim() }];
  }

  const item = ITEM.exec(line);

  return item === null ? [] : [{ pass: heading === '' ? 'unsorted' : heading, text: (item[1] ?? '').trim() }];
}
