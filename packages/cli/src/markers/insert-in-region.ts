import { fitBlock } from '../layout';
import { marker } from './marker';
import { mergeImports } from './merge-imports';

/** Regions made of independent lines (imports): each line is added unless already there. */
const LINEWISE = new Set(['imports']);

/** Regions made of statements: each block added there is a paragraph, set apart by a blank line. */
const PARAGRAPHS = new Set(['registrations', 'start']);

/**
 * Inserts `block` at the end of the region, with the indentation of its closing marker.
 * Returns undefined when the file has no such region (the user removed the markers).
 */
export function insertInRegion(content: string, region: string, block: string): string | undefined {
  const lines = content.split('\n');
  const open = lines.findIndex((line) => marker(region, false).test(line));
  const close = lines.findIndex((line, index) => index > open && marker(region, true).test(line));

  if (open === -1 || close === -1) {
    return undefined;
  }

  const indent = /^\s*/.exec(lines[close] ?? '')?.[0] ?? '';
  const indented = (line: string): string => (line.trim() === '' ? '' : `${indent}${line}`);
  const inside = lines.slice(open + 1, close);
  const written = trimBlankEdges(block.split('\n'));

  if (written.length === 0) {
    return content;
  }

  const merged = LINEWISE.has(region)
    ? mergeImports(
        inside.map((line) => line.trim()),
        written,
      ).map(indented)
    : [...inside, ...added(inside, additionTo(region, written, indent)).map(indented)];

  lines.splice(open + 1, close - open - 1, ...merged);

  return lines.join('\n');
}

interface Addition {
  readonly lines: readonly string[];
  /** Set apart from what the region already holds by a blank line. */
  readonly isParagraph: boolean;
}

/** What a block adds once laid out for the width left at the indentation of the region: a block of statements, or a statement that takes several lines, is a paragraph. */
function additionTo(region: string, written: readonly string[], indent: string): Addition {
  const lines = fitBlock(written, indent);
  const isBrokenStatement = lines.length > 1 && lines.at(-1)?.endsWith(';') === true;

  return { lines, isParagraph: PARAGRAPHS.has(region) || written.length > 1 || isBrokenStatement };
}

/** The lines a block adds to a region: none when its lines are already there, in order; a blank line first when the block is a paragraph. */
function added(inside: readonly string[], { lines, isParagraph }: Addition): string[] {
  const written = (rows: readonly string[]): string =>
    rows
      .map((line) => line.trim())
      .filter((line) => line !== '')
      .join('\n');

  if (`\n${written(inside)}\n`.includes(`\n${written(lines)}\n`)) {
    return [];
  }

  return [...(isParagraph && inside.some((line) => line.trim() !== '') ? [''] : []), ...lines];
}

function trimBlankEdges(lines: readonly string[]): string[] {
  const first = lines.findIndex((line) => line.trim() !== '');
  const last = lines.findLastIndex((line) => line.trim() !== '');

  return first === -1 ? [] : lines.slice(first, last + 1);
}
