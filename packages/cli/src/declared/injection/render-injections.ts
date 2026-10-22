import type { ClassInjection } from './class-injection';
import { LocalNames } from './local-names';
import type { RenderedInjections } from './rendered-injections';
import type { TokenReference } from './token-reference';

const KERNEL = { name: 'injected', from: { kind: 'package', specifier: '@ddd-ts-kit/kernel/declarations' } } as const;
/** The width the formatter of a generated project breaks at: what is written here is what it would write. */
const WIDTH = 120;

/**
 * The statements that register what the classes are given: `injected(Class, [Tokens])` for each
 * class whose constructor takes something and whose decorator lists nothing, with the imports
 * they need. A class with a list in its decorator, with no parameter or with a constructor that
 * cannot be read is left out: the first is complete, the second needs nothing, the third is
 * reported by `declarations/constructor-injection` and refused when the application is composed.
 */
export function renderInjections(
  injections: readonly ClassInjection[],
  specifierOfFile: (file: string) => string,
): RenderedInjections {
  const names = new LocalNames(({ from }) => (from.kind === 'package' ? from.specifier : specifierOfFile(from.path)));
  const injected = names.of(KERNEL);

  const calls = injections.flatMap(({ className, file, listed, dependencies = [] }) => {
    if (listed !== undefined || dependencies.length === 0) {
      return [];
    }

    const target = names.of({ name: className, from: { kind: 'file', path: file } });

    return [
      callOf(
        injected,
        target,
        dependencies.map((dependency: TokenReference) => names.of(dependency)),
      ),
    ];
  });

  return calls.length === 0 ? { imports: [], calls: [] } : { imports: importsOf(names), calls };
}

function importsOf(names: LocalNames): string[] {
  return [...names.bySpecifier()]
    .sort(([left], [right]) => rankOf(left, right))
    .map(([specifier, bound]) => {
      const sorted = [...bound].sort();
      const line = `import { ${sorted.join(', ')} } from '${specifier}';`;

      // The formatter never breaks an import of one name, however long its specifier is.
      return sorted.length === 1 || line.length <= WIDTH
        ? line
        : `import {\n${sorted.map((name) => `  ${name},\n`).join('')}} from '${specifier}';`;
    });
}

/** The declarations entry of the kernel first, then every specifier in order. */
function rankOf(left: string, right: string): number {
  if (left === KERNEL.from.specifier || right === KERNEL.from.specifier) {
    return left === KERNEL.from.specifier ? -1 : 1;
  }

  return left < right ? -1 : 1;
}

function callOf(injected: string, target: string, tokens: readonly string[]): string {
  const line = `${injected}(${target}, [${tokens.join(', ')}]);`;

  return line.length <= WIDTH
    ? line
    : `${injected}(${target}, [\n${tokens.map((token) => `  ${token},\n`).join('')}]);`;
}
