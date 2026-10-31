import type { Config } from '../../config';
import type { Workspace } from '../../workspace';
import { applyWiring } from '../apply-wiring';

const DI = '@ddd-ts-kit/di';
const DI_IMPORT = /import \{(\s*)([^}]*)\} from '@ddd-ts-kit\/di';\n/;

/** The line width of the formatter of a generated project (`biome.json`, `lineWidth`). */
const LINE_WIDTH = 120;

/**
 * What turns the declarations of a context into its module (`contextModule`, or `discoverContext`
 * under discovery) is imported by the file that assembles the contexts with the first of them:
 * before it nothing names the function, and the linter reports an import nobody uses.
 */
export function importAssembler(ws: Workspace, config: Config, file: string): void {
  const content = ws.read(file);
  const discovered = config.stack.assembly === 'discovery';
  const name = discovered ? 'discoverContext' : 'contextModule';

  if (content === undefined || new RegExp(`\\b${name}\\b`).test(content)) {
    return;
  }

  if (!DI_IMPORT.test(content)) {
    applyWiring(ws, file, `@@imports\nimport { ${name} } from '${discovered ? `${DI}/discovery` : DI}';\n`);

    return;
  }

  ws.update(file, discovered ? followedByDiscovery(content) : namedFirst(content, name));
}

/** The name joins the statement that already imports from the package, first, on a line of its own when the others are or when they no longer fit. */
function namedFirst(content: string, name: string): string {
  return content.replace(DI_IMPORT, (_statement, gap: string, names: string) => {
    const statement = `import {${gap}${name},${gap}${names}} from '${DI}';`;

    return statement.length <= LINE_WIDTH || gap.includes('\n') ? `${statement}\n` : oneNamePerLine(name, names);
  });
}

function oneNamePerLine(name: string, names: string): string {
  const others = names.split(',').map((other) => other.trim());

  return `import {\n${[name, ...others].map((entry) => `  ${entry},\n`).join('')}} from '${DI}';\n`;
}

function followedByDiscovery(content: string): string {
  return content.replace(
    DI_IMPORT,
    (statement: string) => `${statement}import { discoverContext } from '${DI}/discovery';\n`,
  );
}
