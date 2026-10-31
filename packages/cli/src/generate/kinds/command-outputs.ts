import { onKitContainer } from '../../config';
import type { Name } from '../../naming';
import type { Output } from '../emit';
import type { Scope } from '../scope';

/** The files of a command, relative to its context. */
export function commandOutputs(scope: Scope, name: Name): Output[] {
  const folder = `application/commands/${name.kebab}`;

  return [
    ['command/command.ts.tpl', `${folder}/${name.kebab}.command.ts`],
    ['command/handler.ts.tpl', `${folder}/${name.kebab}.handler.ts`],
    [
      `command/handler.spec.${onKitContainer(scope.config) ? 'container' : 'buses'}.ts.tpl`,
      `test/unit/${name.kebab}.handler.spec.ts`,
    ],
  ];
}
