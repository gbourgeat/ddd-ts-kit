import { createHash } from 'node:crypto';

/** One acceptance criterion of a story, as its specification states it. */
export interface Criterion {
  readonly id: string;
  readonly text: string;
  readonly line: number;
  /** The digest of its text, white space aside: a scenario may change when this changes. */
  readonly fingerprint: string;
}

const SECTION = /^##\s+acceptance criteria\s*$/i;
const ITEM = /^\s*[-*]\s+\**(AC\d+)\**\s*[:.)]\**\s*(.*)$/;

/**
 * The criteria under the `## Acceptance criteria` heading of a story's specification, one list item
 * each, `- AC1: <what a client observes>`, an indented line continuing the item above it.
 */
export function criteriaIn(text: string): Criterion[] {
  const lines = text.split('\n');
  const heading = lines.findIndex((line) => SECTION.test(line));

  if (heading === -1) {
    return [];
  }

  const end = lines.findIndex((line, at) => at > heading && /^#{1,2}\s/.test(line));
  const section = lines.slice(heading + 1, end === -1 ? undefined : end);
  const found = section.reduce<Stated[]>((stated, line, at) => withLine(stated, line, heading + at + 2), []);

  return found.map((criterion) => ({ ...criterion, fingerprint: digest(criterion.text) }));
}

interface Stated {
  readonly id: string;
  readonly text: string;
  readonly line: number;
}

/** The criteria read so far and one more line of the section: a new item, or the continuation of the last one. */
function withLine(stated: readonly Stated[], line: string, number: number): Stated[] {
  const item = ITEM.exec(line);
  const last = stated.at(-1);

  if (item !== null) {
    return [...stated, { id: item[1] ?? '', text: item[2] ?? '', line: number }];
  }

  if (last === undefined || !/^\s+\S/.test(line)) {
    return [...stated];
  }

  return [...stated.slice(0, -1), { ...last, text: `${last.text} ${line.trim()}` }];
}

function digest(text: string): string {
  return createHash('sha256').update(text.replace(/\s+/g, ' ').trim()).digest('hex').slice(0, 16);
}
