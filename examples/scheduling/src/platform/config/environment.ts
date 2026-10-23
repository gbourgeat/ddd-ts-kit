import { ConfigError } from '@/platform/config/config-error';

/** The variables of a process, as `process.env` gives them. */
export type Variables = Readonly<Record<string, string | undefined>>;

interface Bounds {
  readonly fallback: number;
  readonly min: number;
  readonly max: number;
}

/**
 * The variables of the process, read one at a time: `env.url('DATABASE_URL')`,
 * `env.integer('PORT', { fallback: 3000, min: 0, max: 65535 })`. A variable that is missing or
 * malformed is a problem, kept by name only (values may be secrets) and reported with every
 * other one at once by `assertValid`, before anything starts listening. A blank value counts
 * as left out.
 */
export class Environment {
  private readonly found: string[] = [];

  constructor(private readonly variables: Variables) {}

  /** Every problem found so far, in the order the variables were read. */
  get problems(): readonly string[] {
    return this.found;
  }

  /** The value as written, trimmed; `undefined` when the variable is left out. */
  optional(name: string): string | undefined {
    const value = (this.variables[name] ?? '').trim();

    return value === '' ? undefined : value;
  }

  /** A value that has to be there: a realm, an audience, a bucket. */
  text(name: string): string {
    const value = this.optional(name);

    if (value === undefined) {
      this.problem(`${name} must be set`);
    }

    return value ?? '';
  }

  /** A value that has to be there and be a URL: where a database, a broker or an issuer is reached. */
  url(name: string): string {
    const value = this.optional(name) ?? '';

    if (!URL.canParse(value)) {
      this.problem(`${name} must be a URL`);
    }

    return value;
  }

  /** A URL, or nothing: `whenEmpty` says what leaving it out means, as in `or empty to report nothing`. */
  optionalUrl(name: string, whenEmpty: string): string | undefined {
    const value = this.optional(name);

    if (value !== undefined && !URL.canParse(value)) {
      this.problem(`${name} must be a URL, or empty ${whenEmpty}`);
    }

    return value;
  }

  /** An integer within the bounds; the fallback when left out. */
  integer(name: string, { fallback, min, max }: Bounds): number {
    const written = this.optional(name);
    const value = written === undefined ? fallback : Number(written);

    if (!Number.isInteger(value) || value < min || value > max) {
      this.problem(`${name} must be an integer between ${min} and ${max}`);
    }

    return value;
  }

  /** `true`, `1`, `false` or `0`; the fallback when left out. */
  flag(name: string, fallback: boolean): boolean {
    const written = this.optional(name);

    if (written === undefined) {
      return fallback;
    }

    const value = FLAGS[written];

    if (value === undefined) {
      this.problem(`${name} must be true or false`);
    }

    return value ?? fallback;
  }

  /** One of the words, such as a log level or a mode; the fallback when left out. */
  oneOf<Word extends string>(name: string, words: readonly Word[], fallback: NoInfer<Word>): Word {
    const written = this.optional(name);
    const word = written === undefined ? fallback : words.find((candidate) => candidate === written);

    if (word === undefined) {
      this.problem(`${name} must be one of ${words.join(', ')}`);
    }

    return word ?? fallback;
  }

  /** A problem a reader found on its own, said in the words of its variable. */
  problem(text: string): void {
    this.found.push(text);
  }

  /** Throws `ConfigError` with every problem at once. Called once every variable was read. */
  assertValid(): void {
    if (this.found.length > 0) {
      throw new ConfigError(this.found);
    }
  }
}

const FLAGS: Readonly<Record<string, boolean>> = { true: true, '1': true, false: false, '0': false };
