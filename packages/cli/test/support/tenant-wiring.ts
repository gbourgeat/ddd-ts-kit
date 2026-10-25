import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DeclaredTenantGap } from './support-matrix';

/** The packages of the kit a generated project calls into, beside the CLI and its tools. */
const PACKAGES = fileURLToPath(new URL('../../../', import.meta.url));

const NOT_CALLED = ['cli', 'eslint-plugin', 'testing'];

/**
 * The classes and functions of the kit whose options take a `tenant`, read from the sources of
 * the packages: an export that gains the option is checked without being listed anywhere.
 */
export function tenantTakers(): Set<string> {
  const takers = new Set<string>();

  for (const name of fs.readdirSync(PACKAGES).filter((entry) => !NOT_CALLED.includes(entry))) {
    const sources = filesUnder(path.join(PACKAGES, name, 'src')).map((file) => fs.readFileSync(file, 'utf8'));
    const withTenant = optionsWithTenant(sources);

    for (const text of sources) {
      for (const [exported, parameters] of exportsWithParameters(text)) {
        if ([...parameters.matchAll(/:\s*(\w+Options)\b/g)].some((match) => withTenant.has(match[1] ?? ''))) {
          takers.add(exported);
        }
      }
    }
  }

  return takers;
}

/**
 * The calls of a generated project to a taker that pass no `tenant`, but those a line of
 * `declared` explains: what a multi-tenant project would run outside the tenant of the work.
 */
export function untenantedCalls(root: string, takers: Set<string>, declared: readonly DeclaredTenantGap[]): string[] {
  const calls = filesUnder(path.join(root, 'src')).flatMap((file) => {
    const text = fs.readFileSync(file, 'utf8');
    const relative = path.relative(root, file).split(path.sep).join('/');

    return [...takers].flatMap((taker) => callsOf(text, taker).map((call) => ({ relative, taker, call })));
  });

  return calls
    .filter(({ call }) => !/\btenant\b/.test(call))
    .filter(({ relative, taker }) => !declared.some((line) => line.call.test(`${relative}: ${taker}`)))
    .map(({ relative, taker }) => `${relative}: ${taker}(...) passes no tenant`);
}

function optionsWithTenant(sources: readonly string[]): Set<string> {
  const names = new Set<string>();

  for (const text of sources) {
    for (const match of text.matchAll(/export interface (\w+Options)\b[^{]*\{(?:\}|([\s\S]*?)\n\})/g)) {
      if (/^ {2}(?:readonly )?tenant\??:/m.test(match[2] ?? '')) {
        names.add(match[1] ?? '');
      }
    }
  }

  return names;
}

/** Each exported function with its parameters, each exported class with the parameters of its constructor. */
function exportsWithParameters(text: string): [string, string][] {
  const functions = [...text.matchAll(/export (?:async )?function (\w+)(?:<[^(]*>)?\(([^)]*)\)/g)];
  const classes = [...text.matchAll(/export class (\w+)[\s\S]*?constructor\(([\s\S]*?)\)\s*\{/g)];

  return [...functions, ...classes].map((match): [string, string] => [match[1] ?? '', match[2] ?? '']);
}

/** The text of each call of `name`, with `new` or without, up to its closing parenthesis. */
function callsOf(text: string, name: string): string[] {
  return [...text.matchAll(new RegExp(`\\b${name}(?:<[^()]*>)?\\(`, 'g'))]
    .filter((match) => !/(?:function|class|import|interface)\s+$|\.$/.test(text.slice(0, match.index)))
    .map((match) => {
      const open = match.index + match[0].length - 1;

      return text.slice(open, closingOf(text, open) + 1);
    });
}

function closingOf(text: string, open: number): number {
  let depth = 0;

  for (let index = open; index < text.length; index += 1) {
    depth += text[index] === '(' ? 1 : text[index] === ')' ? -1 : 0;

    if (depth === 0) {
      return index;
    }
  }

  return text.length - 1;
}

function filesUnder(directory: string): string[] {
  if (!fs.existsSync(directory)) {
    return [];
  }

  return fs
    .readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
    .map((entry) => path.join(entry.parentPath, entry.name));
}
