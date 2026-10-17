import type { DocumentPart } from './document-part.js';
import { mentionedRows } from './mentioned-rows.js';
import { textUnits } from './text-units.js';

/** A Markdown file of the project, relative to its root, with its text. */
export interface MarkdownFile {
  readonly path: string;
  readonly text: string;
}

interface Heading {
  readonly index: number;
  readonly level: number;
  readonly title: string;
}

interface Section {
  readonly title: string;
  readonly start: number;
  readonly end: number;
  readonly rows: readonly string[];
}

const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const FENCE = /^\s{0,3}(?:```|~~~)/;

/**
 * The parts of a design document and the rows each belongs to. A row named in a heading owns
 * that section, to the next heading of the same level or higher. A row named only in the text,
 * or in `linked` (its rule line links to the document), owns the whole document. When no row is
 * named outside the headings, what lies outside the sections of rows is a part linked to none.
 */
export function partsOfDocument(
  file: MarkdownFile,
  known: readonly string[],
  linked: readonly string[],
): DocumentPart[] {
  const lines = withoutFences(file.text.split('\n'));
  const sections = rowSections(lines, known);
  const inHeadings = new Set(sections.flatMap((section) => section.rows));
  const body = lines.filter((line) => !HEADING.test(line)).join('\n');
  const whole = [...new Set([...mentionedRows(body, known).filter((id) => !inHeadings.has(id)), ...linked])];

  const parts = sections.map(({ title, start, end, rows }) => ({
    document: file.path,
    section: title,
    rows,
    texts: textUnits(lines.slice(start, end), start + 1),
  }));

  const rest = whole.length > 0 ? lines : lines.map((line, index) => (inSection(sections, index) ? '' : line));

  return [...parts, { document: file.path, rows: whole, texts: textUnits(rest, 1) }];
}

/** The lines of a document with those of its fenced blocks blanked: a heading or a name in them is an example. */
function withoutFences(lines: readonly string[]): string[] {
  let fenced = false;

  return lines.map((line) => {
    const fence = FENCE.test(line);

    fenced = fence ? !fenced : fenced;

    return fence || fenced ? '' : line;
  });
}

function rowSections(lines: readonly string[], known: readonly string[]): Section[] {
  const headings = lines.flatMap((line, index): Heading[] => {
    const [, marks = '', title = ''] = HEADING.exec(line) ?? [];

    return marks === '' ? [] : [{ index, level: marks.length, title }];
  });

  return headings.flatMap((heading, position) => {
    const rows = mentionedRows(heading.title, known);
    const next = headings.slice(position + 1).find((other) => other.level <= heading.level);

    return rows.length === 0
      ? []
      : [{ title: heading.title, start: heading.index, end: next?.index ?? lines.length, rows }];
  });
}

function inSection(sections: readonly Section[], index: number): boolean {
  return sections.some((section) => index >= section.start && index < section.end);
}
