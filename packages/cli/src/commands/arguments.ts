import path from 'node:path';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import { CliError } from '../cli-error';
import { findRoot } from './find-root';

type Options = NonNullable<ParseArgsConfig['options']>;

const COMMON: Options = {
  json: { type: 'boolean', default: false },
  cwd: { type: 'string' },
  help: { type: 'boolean', short: 'h', default: false },
};

/** The arguments of one command, with typed accessors. */
export class Arguments {
  constructor(
    private readonly values: Readonly<Record<string, unknown>>,
    readonly positionals: readonly string[],
  ) {}

  static parse(args: readonly string[], options: Options): Arguments {
    try {
      const { values, positionals } = parseArgs({
        args: [...args],
        options: { ...COMMON, ...options },
        allowPositionals: true,
        strict: true,
      });

      return new Arguments(values, positionals);
    } catch (error) {
      throw new CliError(
        error instanceof Error ? error.message : 'Invalid arguments.',
        'Run `ddd-ts-kit --help` for the accepted options.',
      );
    }
  }

  text(key: string): string | undefined {
    const value = this.values[key];

    return typeof value === 'string' ? value : undefined;
  }

  flag(key: string): boolean {
    return this.values[key] === true;
  }

  many(key: string): string[] {
    const value: unknown = this.values[key];

    return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
  }

  /** The given keys that were passed, as an object without undefined values. */
  texts<K extends string>(keys: readonly K[]): { [P in K]?: string } {
    const picked: { [P in K]?: string } = {};

    for (const key of keys) {
      const value = this.text(key);

      if (value !== undefined) {
        picked[key] = value;
      }
    }

    return picked;
  }

  get json(): boolean {
    return this.flag('json');
  }

  get workingDirectory(): string {
    return path.resolve(this.text('cwd') ?? process.cwd());
  }

  /** The project root: the closest directory, upward from the working directory, holding the config file. */
  get projectRoot(): string {
    return findRoot(this.workingDirectory);
  }
}
