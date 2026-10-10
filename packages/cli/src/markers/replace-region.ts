import { marker } from './marker.js';

/** Replaces the whole content of a region. Returns undefined when the file has no such region. */
export function replaceRegion(content: string, region: string, body: readonly string[]): string | undefined {
  const lines = content.split('\n');
  const open = lines.findIndex((line) => marker(region, false).test(line));
  const close = lines.findIndex((line, index) => index > open && marker(region, true).test(line));

  if (open === -1 || close === -1) return undefined;

  const indent = /^\s*/.exec(lines[close] ?? '')?.[0] ?? '';

  lines.splice(open + 1, close - open - 1, ...body.map((line) => `${indent}${line}`));

  return lines.join('\n');
}
