import { specifierOf } from '../../../alias/index.js';
import { LINE_WIDTH } from '../../../layout/index.js';
import type { Name } from '../../../naming/index.js';
import type { Scope } from '../../scope.js';

/**
 * How the spec of a background job imports it, with its payload type when it has one: on one
 * line when it fits, a name per line otherwise, as the formatter of the project writes it.
 */
export function jobImport(scope: Scope, name: Name, hasPayload: boolean): string {
  const file = `${scope.config.contextsDir}/${scope.context.kebab}/application/background/${name.kebab}.background-job.ts`;
  const from = `from '${specifierOf(scope.config, file)}';`;
  const names = [`${name.pascal}BackgroundJob`, ...(hasPayload ? [`type ${name.pascal}Payload`] : [])];
  const line = `import { ${names.join(', ')} } ${from}`;

  if (line.length <= LINE_WIDTH || names.length === 1) {
    return line;
  }

  return ['import {', ...names.map((imported) => `  ${imported},`), `} ${from}`].join('\n');
}
