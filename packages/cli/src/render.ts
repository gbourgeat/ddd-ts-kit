import { CliError } from './errors.js';

export type RenderValue = string | number | boolean | RenderContext;
export interface RenderContext {
  readonly [key: string]: RenderValue;
}

const TAG = /\{\{\s*(#if|#unless|\/if|\/unless)?\s*([A-Za-z0-9_.]*)\s*\}\}/g;
/** A block tag alone on its line leaves no blank line behind. */
const STANDALONE_BLOCK_TAG = /^[ \t]*(\{\{\s*[#/](?:if|unless)[^}\n]*\}\})[ \t]*\r?\n/gm;

export function render(template: string, context: RenderContext, origin = 'template'): string {
  const rendering = new Rendering(context, origin);
  const source = template.replace(STANDALONE_BLOCK_TAG, '$1');
  let cursor = 0;
  for (const match of source.matchAll(TAG)) {
    rendering.text(source.slice(cursor, match.index));
    rendering.tag(match[1], match[2] ?? '');
    cursor = match.index + match[0].length;
  }
  rendering.text(source.slice(cursor));
  return rendering.result();
}

class Rendering {
  #output = '';
  /** One entry per open block: whether its content is kept. */
  readonly #open: boolean[] = [];

  constructor(
    private readonly context: RenderContext,
    private readonly origin: string,
  ) {}

  text(text: string): void {
    if (this.#emitting()) this.#output += text;
  }

  tag(block: string | undefined, path: string): void {
    if (block === '#if' || block === '#unless') {
      this.#open.push(this.#condition(path) === (block === '#if'));
    } else if (block !== undefined) {
      if (this.#open.pop() === undefined) throw this.#failure(`"{{${block}}}" closes nothing`);
    } else if (this.#emitting()) {
      this.#output += this.#value(path);
    }
  }

  result(): string {
    if (this.#open.length > 0) throw this.#failure('an "{{#if}}" block is never closed');
    const leftover = /\{\{[^}]*\}\}/.exec(this.#output);
    if (leftover !== null) throw this.#failure(`leftover placeholder "${leftover[0]}"`);
    return this.#output;
  }

  #emitting(): boolean {
    return this.#open.every(Boolean);
  }

  #condition(path: string): boolean {
    const value = lookup(this.context, path);
    if (typeof value === 'boolean') return value;
    throw this.#failure(`condition "${path}" is not a known boolean`);
  }

  #value(path: string): string {
    const value = lookup(this.context, path);
    if (value === undefined || typeof value === 'object') throw this.#failure(`unknown placeholder "{{${path}}}"`);
    return String(value);
  }

  #failure(problem: string): CliError {
    return new CliError(`${this.origin}: ${problem}`, 'Fix the template or pass the missing variable to the renderer.');
  }
}

function lookup(context: RenderContext, path: string): RenderValue | undefined {
  let current: RenderValue | undefined = context;
  for (const key of path.split('.')) {
    if (typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}
