import { specifierOf } from '../../../alias/index.js';
import { LINE_WIDTH } from '../../../layout/line-width.js';
import type { Name } from '../../../naming/index.js';
import type { RenderContext } from '../../../templating/index.js';
import { assembledContext } from '../../assembled-context.js';
import { contextImports } from '../../context-imports.js';
import { isDeclared } from '../../is-declared.js';
import type { Scope } from '../../scope.js';
import type { ContextFake } from './context-fakes.js';

/**
 * What a world template reads: its name, the imports of the fakes and of the ports they stand
 * for, the object that builds them, and the module of the context as the style assembles it.
 */
export function worldVars(scope: Scope, name: Name, fakes: readonly ContextFake[]): RenderContext {
  const imported = (exported: string, file: string): string =>
    `import { ${exported} } from '${specifierOf(scope.config, file)}';`;

  return {
    ...name,
    hasFakes: fakes.length > 0,
    given: fakes.length > 0 ? 'given, ' : '',
    diImport: diImport(scope, fakes.length > 0),
    contextImport: contextImports(scope),
    assembles: isDeclared(scope.config),
    context: assembledContext(scope, '../../'),
    contextModule: isDeclared(scope.config) ? 'context' : assembledContext(scope, '../../'),
    portImports: fakes.map((fake) => imported(fake.port.name, fake.port.file)).join('\n'),
    fakeImports: fakes.map((fake) => imported(fake.name, fake.file)).join('\n'),
    members: fakes.map((fake) => `  readonly ${fake.key}: ${fake.name};`).join('\n'),
    built: laidOut(
      '  const fakes = { ',
      fakes.map((fake) => `${fake.key}: new ${fake.name}()`),
      ' };',
    ),
    overrides: laidOut(
      '    fakes: [',
      fakes.map((fake) => `fake(${fake.port.name}, fakes.${fake.key})`),
      '],',
    ),
    returnedBuses: laidOut('  return { ', ['...buses', ...returnedFakes(fakes)], ' };'),
  };
}

/** Every fake, a repository as the application hands it to a handler: its save announces the events of the aggregate. */
function returnedFakes(fakes: readonly ContextFake[]): string[] {
  const dispatched = fakes
    .filter((fake) => fake.port.repository)
    .map((fake) => `${fake.key}: buses.dispatching(fakes.${fake.key})`);

  return fakes.length === 0 ? [] : ['...fakes', ...dispatched];
}

function diImport(scope: Scope, withFakes: boolean): string {
  const listed = isDeclared(scope.config) && scope.config.stack.assembly !== 'discovery';

  const names = [
    ...(listed ? ['contextModule'] : []),
    'createTestApplication',
    ...(withFakes ? ['fake'] : []),
    'type ContextModule',
  ];

  return `import { ${names.join(', ')} } from '@ddd-ts-kit/di';`;
}

/** A list on one line when it fits, one entry per line otherwise, as the formatter lays it out. */
function laidOut(head: string, entries: readonly string[], tail: string): string {
  const line = `${head}${entries.join(', ')}${tail}`;

  if (line.length <= LINE_WIDTH) {
    return line;
  }

  const indent = /^\s*/.exec(head)?.[0] ?? '';

  return [head.trimEnd(), ...entries.map((entry) => `${indent}  ${entry},`), `${indent}${tail.trimStart()}`].join('\n');
}
