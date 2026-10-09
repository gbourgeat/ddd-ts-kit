import { execFile } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const MODULES = path.resolve(import.meta.dirname, '../../../../node_modules');
const COMPILERS = {
  'TypeScript 7 (native)': path.join(MODULES, '@typescript/native/bin/tsc'),
  'TypeScript 6': path.join(MODULES, 'typescript/bin/tsc'),
};
const SETTINGS = {
  'standard decorators': ['--experimentalDecorators', 'false'],
  'standard decorators, fields assigned': ['--experimentalDecorators', 'false', '--useDefineForClassFields', 'false'],
  'experimentalDecorators': ['--experimentalDecorators', 'true'],
  'experimentalDecorators with emitDecoratorMetadata': ['--experimentalDecorators', 'true', '--emitDecoratorMetadata', 'true'],
  'experimentalDecorators, fields assigned': ['--experimentalDecorators', 'true', '--useDefineForClassFields', 'false'],
};

/** One way a project may be built: a compiler and its decorator settings. */
export interface DecoratorMode {
  readonly label: string;
  /** Compiles the fixture project this way, type errors included, and answers where it was emitted. */
  compile(): Promise<string>;
}

/** Every compiler with every decorator setting, for a fixture project whose tsconfig is in `fixtures`. */
export function decoratorModes(fixtures: string): DecoratorMode[] {
  return Object.entries(COMPILERS).flatMap(([compiler, script], compilerIndex) =>
    Object.entries(SETTINGS).map(([setting, flags], settingIndex) => {
      const output = path.join(fixtures, 'dist', `${compilerIndex}-${settingIndex}`);
      let compiled: Promise<unknown> | undefined;
      return {
        label: `${compiler}, ${setting}`,
        async compile(): Promise<string> {
          compiled ??= run(process.execPath, [script, '-p', fixtures, '--outDir', output, ...flags]);
          await compiled.catch(explained);
          return output;
        },
      };
    }),
  );
}

export function removeCompiled(fixtures: string): void {
  rmSync(path.join(fixtures, 'dist'), { recursive: true, force: true });
}

function explained(error: unknown): never {
  const output = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '';
  throw new Error(`The fixture project does not compile:\n${output}`, { cause: error });
}
