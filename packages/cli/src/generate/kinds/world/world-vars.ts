import { specifierOf } from '../../../alias';
import { LINE_WIDTH } from '../../../layout/line-width';
import type { Name } from '../../../naming';
import type { RenderContext } from '../../../templating';
import { assembledContext } from '../../assembled-context';
import { contextImports } from '../../context-imports';
import { isDeclared } from '../../is-declared';
import type { Scope } from '../../scope';
import type { ContextFake } from './context-fakes';
import { WORLD_COMMENTS } from './world-comments';

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
    tenanted: scope.config.stack.tenancy !== 'none',
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
      '  const built = [',
      fakes.map((fake) => `fake(${fake.port.name}, fakes.${fake.key})`),
      '];',
    ),
    replacing: `// ${WORLD_COMMENTS.replacing()}`,
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
    'type Override',
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
