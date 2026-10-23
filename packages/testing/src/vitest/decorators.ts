import path from 'node:path';
import { compilerScript } from './compiler-script';
import { DecoratorCompiler } from './decorator-compiler';

export interface DecoratorsOptions {
  /**
   * The tsconfig whose `target`, `useDefineForClassFields`, `verbatimModuleSyntax` and
   * `experimentalDecorators` are followed. Default: for each file, the nearest `tsconfig.json`
   * above it, which is also the one the test runner follows.
   */
  readonly tsconfig?: string;
  /**
   * The package whose `tsc` compiles, resolved from the root of the project, or the path of a
   * `tsc` script. Default: `typescript`. Any version from 5.6 fits, the native one included.
   */
  readonly compiler?: string;
  /** Where compiled files are kept between runs. Default: `ddd-ts-kit-decorators` in the cache directory of Vite. */
  readonly cacheDir?: string;
}

/** The part of a Vite plugin this one fills: it is listed in `plugins` as it is. */
export interface DecoratorsPlugin {
  readonly name: string;
  readonly enforce: 'pre';
  configResolved(config: { readonly root: string; readonly cacheDir: string }): void;
  transform(code: string, id: string): { code: string; map: string } | undefined;
}

/**
 * Lets Vitest run TypeScript sources that hold standard (TC39) decorators, which its own
 * transform does not lower: a file holding one is compiled by the TypeScript compiler of the
 * project, with its compiler options and a source map, before the runner reads it. Every other
 * file is left to the runner, and so is every file of a project compiled with
 * `experimentalDecorators`: the runner lowers legacy decorators by itself.
 *
 *     // vitest.config.ts
 *     import { decorators } from '@ddd-ts-kit/testing/vitest';
 *     export default defineConfig({ plugins: [decorators()] });
 */
export function decorators(options: DecoratorsOptions = {}): DecoratorsPlugin {
  let compiler: DecoratorCompiler | undefined;

  return {
    name: 'ddd-ts-kit:decorators',
    enforce: 'pre',
    configResolved({ root, cacheDir }) {
      compiler = new DecoratorCompiler({
        script: compilerScript(options.compiler ?? 'typescript', root),
        cacheDir: options.cacheDir ?? path.join(cacheDir, 'ddd-ts-kit-decorators'),
        ...(options.tsconfig === undefined ? {} : { tsconfig: path.resolve(root, options.tsconfig) }),
      });
    },
    transform(code, id) {
      const file = withoutQuery(id);

      if (compiler === undefined || !holdsADecorator(file, code)) {
        return undefined;
      }

      return compiler.compile(file, code);
    },
  };
}

const QUERY = /[?#]/;
const SOURCE = /\.[cm]?ts$/;
const DECLARATION = /\.d\.[cm]?ts$/;
/** A line that starts with a decorator, after `export` or `export default` at most. */
const DECORATOR = /^[ \t]*(?:export\s+(?:default\s+)?)?@[A-Za-z_$]/m;

/** The file of a module id, without the query or the fragment a plugin added to it. */
function withoutQuery(id: string): string {
  const end = id.search(QUERY);

  return end === -1 ? id : id.slice(0, end);
}

function holdsADecorator(file: string, code: string): boolean {
  return SOURCE.test(file) && !DECLARATION.test(file) && DECORATOR.test(code);
}
