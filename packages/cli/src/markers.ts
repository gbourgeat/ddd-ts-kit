/**
 * Generated files carry marker comments delimiting the regions the generator may extend:
 * `// ddd-ts-kit:<region>` ... `// /ddd-ts-kit:<region>` (or the HTML comment form in Markdown).
 */

/** Regions made of independent lines (imports): each line is added unless already there. */
const LINEWISE = new Set(['imports']);

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
  const inside = lines.slice(open + 1, close).map((line) => line.trim());
  const wanted = block.split('\n').filter((line) => line.trim() !== '');
  if (wanted.length === 0) return content;

  if (LINEWISE.has(region)) {
    lines.splice(open + 1, close - open - 1, ...mergeImports(inside, wanted).map((line) => `${indent}${line}`));
    return lines.join('\n');
  }
  // A block is already there when its lines appear, in order and contiguous, in the region.
  const blockPresent = `\n${inside.join('\n')}\n`.includes(`\n${wanted.map((line) => line.trim()).join('\n')}\n`);
  lines.splice(close, 0, ...(blockPresent ? [] : wanted).map((line) => `${indent}${line}`));
  return lines.join('\n');
}

const NAMED_IMPORT = /^import (type )?\{ ([^}]+) \} from '([^']+)';$/;

/** Adds import lines to those already there; names imported from one module end up on one line. */
function mergeImports(present: readonly string[], wanted: readonly string[]): string[] {
  const merged = [...present];
  for (const line of wanted.map((candidate) => candidate.trim())) {
    const added = NAMED_IMPORT.exec(line);
    const twin = added === null ? -1 : merged.findIndex((existing) => sameSource(NAMED_IMPORT.exec(existing), added));
    if (twin === -1) {
      if (!merged.includes(line)) merged.push(line);
      continue;
    }
    const names = new Set([...namesOf(merged[twin] ?? ''), ...namesOf(line)]);
    merged[twin] = `import ${added?.[1] ?? ''}{ ${[...names].join(', ')} } from '${added?.[3] ?? ''}';`;
  }
  return merged;
}

const sameSource = (left: RegExpExecArray | null, right: RegExpExecArray | null): boolean =>
  left !== null && right !== null && left[1] === right[1] && left[3] === right[3];

const namesOf = (line: string): string[] => (NAMED_IMPORT.exec(line)?.[2] ?? '').split(',').map((name) => name.trim());

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

/** A wiring template is a list of `@@<region>` sections, each holding what to add there. */
export function parseWiring(text: string): Map<string, string> {
  const sections = new Map<string, string>();
  let current: string | undefined;
  for (const line of text.split('\n')) {
    const header = /^@@([\w-]+)\s*$/.exec(line);
    if (header?.[1] !== undefined) {
      current = header[1];
      sections.set(current, '');
    } else if (current !== undefined) {
      sections.set(current, `${sections.get(current) ?? ''}${line}\n`);
    }
  }
  return sections;
}

function marker(region: string, closing: boolean): RegExp {
  return new RegExp(`^\\s*(?://|<!--)\\s*${closing ? '/' : ''}ddd-ts-kit:${region}\\s*(?:-->)?\\s*$`);
}
