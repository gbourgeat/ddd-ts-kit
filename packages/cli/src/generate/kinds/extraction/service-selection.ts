import { barrelFile, routesFile } from '../../../declared/index.js';
import { fitStatement } from '../../../layout/index.js';
import { assembledContext } from '../../assembled-context.js';
import { hostImports } from '../../host-imports.js';
import { isDeclared } from '../../is-declared.js';
import { relativeTo } from '../../relative-to.js';
import type { Scope } from '../../scope.js';

/** What the entry point of a context hands to `composeApplication` so that it hosts this context only, and what it imports for it. */
export interface ServiceSelection {
  /** The last argument of the call, laid out for the two spaces it is written after. */
  readonly selection: string;
  readonly imports: string;
}

export function serviceSelection(scope: Scope): ServiceSelection {
  const { context, config } = scope;
  const directory = `${relativeTo(`${config.sourceRoot}/apps/${context.kebab}`, config.contextsDir)}/${context.kebab}`;
  const module = assembledContext(scope, `${directory}/`);

  if (config.stack.di !== 'tsyringe') {
    return { selection: argument(`[${module}]`), imports: moduleImports(scope, directory).join('\n') };
  }

  const withRoutes = config.stack.http !== 'none';

  const routes = withRoutes
    ? [`import { ${context.camel}Routes } from '${directory}/${compiled(routesFile(context.kebab))}';`]
    : [];

  return {
    selection: argument(`{ modules: [${module}]${withRoutes ? `, routes: [${context.camel}Routes]` : ''} }`),
    imports: [...moduleImports(scope, directory), ...routes].join('\n'),
  };
}

function argument(selection: string): string {
  return fitStatement(`${selection},`, '  ').join('\n').trimStart();
}

/** The same imports as in the composition root of the whole application, for this context alone. */
function moduleImports({ context, config }: Scope, directory: string): string[] {
  if (!isDeclared(config)) {
    return [`import { ${context.camel}Module } from '${directory}/${context.kebab}.module.js';`];
  }

  if (config.stack.assembly === 'discovery') {
    return ["import { discoverContext } from '@ddd-ts-kit/di/discovery';"];
  }

  return [
    ...hostImports(config),
    `import * as ${context.camel}Declarations from '${directory}/${compiled(barrelFile(context.kebab))}';`,
  ];
}

function compiled(file: string): string {
  return file.replace(/\.ts$/, '.js');
}
