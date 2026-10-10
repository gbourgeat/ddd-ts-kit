import { marker } from './marker.js';
import { mergeImports } from './merge-imports.js';

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

  if (open === -1 || close === -1) return undefined;

  const indent = /^\s*/.exec(lines[close] ?? '')?.[0] ?? '';
  const indented = (line: string): string => (line.trim() === '' ? '' : `${indent}${line}`);
  const inside = lines.slice(open + 1, close);
  const wanted = trimBlankEdges(block.split('\n'));

  if (wanted.length === 0) return content;

  const merged = LINEWISE.has(region) ? mergeImports(inside.map((line) => line.trim()), wanted).map(indented) : [...inside, ...added(region, inside, wanted).map(indented)];

  lines.splice(open + 1, close - open - 1, ...merged);

  return lines.join('\n');
}

/** The lines a block adds to a region: none when its lines are already there, in order; a blank line first when the block is a paragraph. */
function added(region: string, inside: readonly string[], wanted: readonly string[]): string[] {
  const written = (lines: readonly string[]): string => lines.map((line) => line.trim()).filter((line) => line !== '').join('\n');

  if (`\n${written(inside)}\n`.includes(`\n${written(wanted)}\n`)) return [];

  const paragraph = PARAGRAPHS.has(region) || wanted.length > 1;

  return [...(paragraph && inside.some((line) => line.trim() !== '') ? [''] : []), ...wanted];
}

function trimBlankEdges(lines: readonly string[]): string[] {
  const first = lines.findIndex((line) => line.trim() !== '');
  const last = lines.findLastIndex((line) => line.trim() !== '');

  return first === -1 ? [] : lines.slice(first, last + 1);
}
