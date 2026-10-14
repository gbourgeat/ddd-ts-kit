import type { Name } from '../../naming/index.js';
import type { Output } from '../emit.js';
import type { Scope } from '../scope.js';

/** The files of a command, relative to its context. */
export function commandOutputs(scope: Scope, name: Name): Output[] {
  const folder = `application/commands/${name.kebab}`;

  return [
    ['command/command.ts.tpl', `${folder}/${name.kebab}.command.ts`],
    ['command/handler.ts.tpl', `${folder}/${name.kebab}.handler.ts`],
    [
      `command/handler.spec.${scope.config.stack.di === 'tsyringe' ? 'tsyringe' : 'buses'}.ts.tpl`,
      `test/unit/${name.kebab}.handler.spec.ts`,
    ],
  ];
}
