import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';
import { installAsPublished } from '../e2e/install-as-published';
import { bin } from '../e2e/run-in';
import { NATIVE_COMPILER } from '../e2e/type-errors';
import { cli, read, REPO_ROOT, tempDir, write } from '../helpers';
import type { Finding } from './finding';
import type { Change, Injection } from './injection';
import { toolRun, type ToolRun } from './tool-run';

const EXAMPLE = path.join(REPO_ROOT, 'examples/scheduling');
const NOT_COPIED = ['node_modules', 'dist', 'coverage'];
const FORMATTER_CONFIG = path.join(REPO_ROOT, 'packages/cli/templates/pipeline/biome.json.tpl');

interface CheckJson {
  readonly violations: readonly { ruleId: string; file: string; message: string }[];
}

interface LintJson {
  readonly filePath: string;
  readonly messages: readonly { ruleId: string | null; message: string }[];
}

/**
 * The example application copied outside the workspace and installed as a published kit: a project
 * of its own, which a test breaks one rule at a time and puts back. The example itself is never written.
 */
export class ExampleCopy {
  private readonly untouched = new Map<string, string | undefined>();

  private constructor(readonly root: string) {}

  static create(): ExampleCopy {
    const root = fs.realpathSync(tempDir('conformance'));

    fs.cpSync(EXAMPLE, root, {
      recursive: true,
      filter: (source) => !NOT_COPIED.includes(path.basename(source)),
    });

    installAsPublished(root);
    // In the workspace the example extends the formatter configuration of the root; a project of its own holds the file `init` writes,
    // which `ddd-ts-kit sdk` wires around the clients the example asks for.
    fs.copyFileSync(FORMATTER_CONFIG, path.join(root, 'biome.json'));
    expect(cli(root, 'sdk').code).toBe(0);

    return new ExampleCopy(root);
  }

  apply({ changes, removes = [] }: Pick<Injection, 'changes' | 'removes'>): void {
    for (const change of changes) {
      this.remember(change.file);
      write(this.root, change.file, this.changed(change));
    }

    for (const file of removes) {
      this.remember(file);
      fs.rmSync(path.join(this.root, file));
    }
  }

  restore(): void {
    for (const [file, content] of this.untouched) {
      if (content === undefined) {
        this.forget(file);
      } else {
        write(this.root, file, content);
      }
    }

    this.untouched.clear();
  }

  /** What `ddd-ts-kit check` reports, errors and warnings alike. */
  checked(): Finding[] {
    const { violations } = cli(this.root, 'check', '--json').json() as CheckJson;

    return violations.map(({ ruleId, file, message }) => ({ rule: ruleId, file, message }));
  }

  /** What ESLint, with the preset of the project, says of these files; of the whole project without any. */
  linted(files: readonly string[] = ['.']): Finding[] {
    const run = toolRun(this.root, { command: bin('eslint'), args: ['--format', 'json', ...files] });

    expect(run.stdout, run.stderr).toMatch(/^\[/);

    return (JSON.parse(run.stdout) as LintJson[]).flatMap(({ filePath, messages }) =>
      messages.map(({ ruleId, message }) => ({
        rule: ruleId ?? 'fatal',
        file: path.relative(this.root, filePath),
        message,
      })),
    );
  }

  formatted(...files: string[]): ToolRun {
    return toolRun(this.root, { command: bin('biome'), args: ['format', ...files] });
  }

  graph(): ToolRun {
    return toolRun(this.root, { command: bin('depcruise'), args: ['src', '--config', '.dependency-cruiser.cjs'] });
  }

  deadCode(): ToolRun {
    return toolRun(this.root, { command: bin('knip'), args: [] });
  }

  typeChecked(): ToolRun {
    return toolRun(this.root, {
      command: process.execPath,
      args: [NATIVE_COMPILER, '-p', 'tsconfig.json', '--noEmit'],
    });
  }

  /** Removes a file an injection created, and the directories it created for it. */
  private forget(file: string): void {
    fs.rmSync(path.join(this.root, file), { force: true });

    let directory = path.dirname(file);

    while (directory !== '.' && fs.readdirSync(path.join(this.root, directory)).length === 0) {
      fs.rmdirSync(path.join(this.root, directory));
      directory = path.dirname(directory);
    }
  }

  private changed({ file, from, where, to }: Change): string {
    if (from === undefined && where === undefined) {
      return to;
    }

    const content = read(this.root, file);

    if (from === undefined) {
      return where === 'start' ? `${to}${content}` : `${content}${to}`;
    }

    expect(content.includes(from), `${file} no longer holds what the injection replaces: ${from}`).toBe(true);

    return content.replace(from, to);
  }

  private remember(file: string): void {
    if (this.untouched.has(file)) {
      return;
    }

    const exists = fs.existsSync(path.join(this.root, file));

    this.untouched.set(file, exists ? read(this.root, file) : undefined);
  }
}
