import { specifierOf } from '../../../alias';
import { barrelFile, routesFile } from '../../../declared';
import { fitStatement } from '../../../layout';
import { assembledContext } from '../../assembled-context';
import { hostImports } from '../../host-imports';
import { isDeclared } from '../../is-declared';
import { listsRoutes } from '../../lists-routes';
import { relativeTo } from '../../relative-to';
import type { Scope } from '../../scope';

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
  const inContext = (file: string): string => specifierOf(config, `${config.contextsDir}/${context.kebab}/${file}`);

  if (config.stack.di !== 'tsyringe') {
    return { selection: argument(`[${module}]`), imports: moduleImports(scope, inContext).join('\n') };
  }

  const withRoutes = listsRoutes(config);

  const routes = withRoutes
    ? [`import { ${context.camel}Routes } from '${inContext(routesFile(context.kebab))}';`]
    : [];

  return {
    selection: argument(`{ modules: [${module}]${withRoutes ? `, routes: [${context.camel}Routes]` : ''} }`),
    imports: [...moduleImports(scope, inContext), ...routes].join('\n'),
  };
}

function argument(selection: string): string {
  return fitStatement(`${selection},`, '  ').join('\n').trimStart();
}

/** The same imports as in the composition root of the whole application, for this context alone. */
function moduleImports({ context, config }: Scope, inContext: (file: string) => string): string[] {
  if (!isDeclared(config)) {
    return [`import { ${context.camel}Module } from '${inContext(`${context.kebab}.module.ts`)}';`];
  }

  if (config.stack.assembly === 'discovery') {
    return ["import { discoverContext } from '@ddd-ts-kit/di/discovery';"];
  }

  return [
    ...hostImports(config),
    `import * as ${context.camel}Declarations from '${inContext(barrelFile(context.kebab))}';`,
  ];
}
