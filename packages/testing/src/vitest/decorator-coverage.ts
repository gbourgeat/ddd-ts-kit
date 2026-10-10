/** A statement the transform of the runner writes to apply legacy decorators: `Handler = _decorate([...], Handler);`. */
const APPLIES_DECORATORS = /^\s*(?:[\w$.]+\s*=\s*)?_decorate\d*\(/;
const HINT = '/* v8 ignore next */';

/** The part of a Vite plugin this one fills: it is listed in `plugins` as it is. */
export interface DecoratorCoveragePlugin {
  readonly name: string;
  readonly enforce: 'post';
  transform(code: string, id: string): { code: string; map: null } | undefined;
}

/**
 * Keeps the statements that apply legacy decorators out of the coverage measure. Under
 * `experimentalDecorators` with `emitDecoratorMetadata` (class-validator, NestJS) the transform
 * of the runner writes, for every type a decorated constructor or property names,
 * `typeof Port === "undefined" ? Object : Port`: a branch no test can take, mapped to the line of
 * the decorator. A handler with two ports would lose two branches a spec cannot win back, and the
 * branch threshold would measure the compiler instead of the code.
 *
 * Each such statement is marked, after the transform, with the hint the coverage provider reads,
 * written at the end of the line above it so that no column of the source map moves. The provider
 * does the same by itself for the output of SWC.
 *
 *     // vitest.config.ts
 *     import { decoratorCoverage } from '@ddd-ts-kit/testing/vitest';
 *     export default defineConfig({ plugins: [decoratorCoverage()] });
 */
export function decoratorCoverage(): DecoratorCoveragePlugin {
  return {
    name: 'ddd-ts-kit:decorator-coverage',
    enforce: 'post',
    transform(code, id) {
      if (id.includes('/node_modules/') || !code.includes('_decorate')) {
        return undefined;
      }

      const lines = code.split('\n');
      const marked = lines.map((line, index) => (isApplied(lines[index + 1]) ? withHint(line) : line)).join('\n');

      return marked === code ? undefined : { code: marked, map: null };
    },
  };
}

function isApplied(line: string | undefined): boolean {
  return line !== undefined && APPLIES_DECORATORS.test(line);
}

/** A line that ends in a line comment would swallow the hint: it is left as it is. */
function withHint(line: string): string {
  return line.includes('//') ? line : `${line} ${HINT}`;
}
