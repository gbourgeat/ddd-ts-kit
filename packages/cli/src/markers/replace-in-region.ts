import { fitBlock } from '../layout/index.js';
import { marker } from './marker.js';

/**
 * Replaces, inside a region, the lines a block was added as by the lines another block is added
 * as, both laid out for the indentation of the region. Undefined when the file has no such region
 * or the region no longer holds the first block as it was written.
 */
export function replaceInRegion(
  content: string,
  region: string,
  { replaced, by }: { readonly replaced: string; readonly by: string },
): string | undefined {
  const lines = content.split('\n');
  const open = lines.findIndex((line) => marker(region, false).test(line));
  const close = lines.findIndex((line, index) => index > open && marker(region, true).test(line));

  if (open === -1 || close === -1) {
    return undefined;
  }

  const indent = /^\s*/.exec(lines[close] ?? '')?.[0] ?? '';
  const inside = lines.slice(open + 1, close).join('\n');
  const before = laidOut(replaced, indent);

  if (before === '' || !inside.includes(before)) {
    return undefined;
  }

  lines.splice(open + 1, close - open - 1, ...inside.replace(before, laidOut(by, indent)).split('\n'));

  return lines.join('\n');
}

function laidOut(block: string, indent: string): string {
  const written = block.split('\n').filter((line) => line.trim() !== '');

  return fitBlock(written, indent)
    .map((line) => (line.trim() === '' ? '' : `${indent}${line}`))
    .join('\n');
}
