import { expect } from 'vitest';
import { cli, DEFAULT_STACK, read, scaffoldEverything, tempDir, write } from '../helpers';
import { eslintOn } from './analyzers';
import { installAsPublished } from './install-as-published';
import { bin, findingsOf } from './run-in';

interface Reported {
  readonly ruleId: string;
  readonly severity: string;
  readonly file: string;
  readonly message: string;
}

/** A project of the default stack, installed as a published kit, in which a test breaks one rule in one file and puts the file back. */
export class EditedProject {
  private readonly generated = new Map<string, string>();

  private constructor(readonly root: string) {}

  /** `prepare` generates more into the scaffold of `stack` before the kit is installed. */
  static generate(prepare: (root: string) => void = () => undefined, stack = DEFAULT_STACK): EditedProject {
    const root = tempDir('violations');

    scaffoldEverything(root, stack);
    prepare(root);
    installAsPublished(root);

    return new EditedProject(root);
  }

  /** Replaces `from`, which the generated file has to hold, by `to`. */
  edit(file: string, from: string, to: string): void {
    const content = this.original(file);

    expect(content).toContain(from);
    write(this.root, file, content.replaceAll(from, to));
  }

  append(file: string, text: string): void {
    write(this.root, file, `${this.original(file)}${text}`);
  }

  prepend(file: string, text: string): void {
    write(this.root, file, `${text}${this.original(file)}`);
  }

  restore(): void {
    for (const [file, content] of this.generated) {
      write(this.root, file, content);
    }
  }

  /** What `ddd-ts-kit check` reports, the way `npm run check:arch` runs it. */
  checked(): readonly Reported[] {
    return (cli(this.root, 'check', '--json').json() as { violations: Reported[] }).violations;
  }

  /** The rule ids `ddd-ts-kit check` reports. */
  checkedRules(): string[] {
    return this.checked().map((violation) => violation.ruleId);
  }

  /** What ESLint, with the preset of the project, says of these files. */
  linted(...files: string[]): string {
    return findingsOf(this.root, eslintOn(...files));
  }

  /** What the formatter of the project, with its configuration, would change in these files. */
  unformatted(...files: string[]): string {
    return findingsOf(this.root, { command: bin('biome'), args: ['format', ...files] });
  }

  private original(file: string): string {
    const known = this.generated.get(file) ?? read(this.root, file);

    this.generated.set(file, known);

    return known;
  }
}
