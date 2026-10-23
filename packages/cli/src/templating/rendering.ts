import { CliError } from '../cli-error';
import type { RenderContext, RenderValue } from './render-context';

/** One rendering in progress: the text kept so far and the blocks that are open. */
export class Rendering {
  private output = '';

  /** One entry per open block: whether its content is kept. */
  private readonly open: boolean[] = [];

  constructor(
    private readonly context: RenderContext,
    private readonly origin: string,
  ) {}

  text(text: string): void {
    if (this.emitting()) {
      this.output += text;
    }
  }

  tag(block: string | undefined, path: string): void {
    if (block === '#if' || block === '#unless') {
      this.open.push(this.condition(path) === (block === '#if'));
    } else if (block !== undefined) {
      if (this.open.pop() === undefined) {
        throw this.failure(`"{{${block}}}" closes nothing`);
      }
    } else if (this.emitting()) {
      this.output += this.value(path);
    }
  }

  result(): string {
    if (this.open.length > 0) {
      throw this.failure('an "{{#if}}" block is never closed');
    }

    const leftover = /(?<!\$)\{\{[^}]*\}\}/.exec(this.output);

    if (leftover !== null) {
      throw this.failure(`leftover placeholder "${leftover[0]}"`);
    }

    return this.output;
  }

  private emitting(): boolean {
    return this.open.every(Boolean);
  }

  private condition(path: string): boolean {
    const value = lookup(this.context, path);

    if (typeof value === 'boolean') {
      return value;
    }

    throw this.failure(`condition "${path}" is not a known boolean`);
  }

  private value(path: string): string {
    const value = lookup(this.context, path);

    if (value === undefined || typeof value === 'object') {
      throw this.failure(`unknown placeholder "{{${path}}}"`);
    }

    return String(value);
  }

  private failure(problem: string): CliError {
    return new CliError(`${this.origin}: ${problem}`, 'Fix the template or pass the missing variable to the renderer.');
  }
}

function lookup(context: RenderContext, path: string): RenderValue | undefined {
  let current: RenderValue | undefined = context;

  for (const key of path.split('.')) {
    if (typeof current !== 'object') {
      return undefined;
    }

    current = current[key];
  }

  return current;
}
