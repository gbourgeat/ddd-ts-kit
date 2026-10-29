import type { Scope } from '../scope';
import type { EventDeclaration } from './event-declaration';

/**
 * Looks for the declaration of `eventType` in the published language of an upstream of this
 * repository; the file of the one found is what the command builds on.
 */
export function findEventDeclaration(scope: Scope, upstream: string, eventType: string): EventDeclaration | undefined {
  const directory = `${scope.config.contextsDir}/${upstream}/published-language`;

  const declarations = scope.ws.list(directory).flatMap((name) => {
    const file = `${directory}/${name}`;
    const content = scope.ws.read(file) ?? '';

    return content.includes(`type: '${eventType}'`)
      ? declarationIn(content).map((declaration) => ({ file, declaration }))
      : [];
  });

  // A new consumer has no reason to start on an old contract.
  const newest = declarations.reduce<(typeof declarations)[number] | undefined>(
    (found, candidate) =>
      found === undefined || candidate.declaration.version > found.declaration.version ? candidate : found,
    undefined,
  );

  if (newest !== undefined) {
    scope.flags.builtOn?.(newest.file);
  }

  return newest?.declaration;
}

function declarationIn(content: string): EventDeclaration[] {
  const definition = /export const (\w+) = defineIntegrationEvent\b/.exec(content)?.[1];
  const typeName = /export type (\w+) = IntegrationEvent</.exec(content)?.[1];
  const version = Number(/\bversion:\s*(\d+)/.exec(content)?.[1] ?? '1');

  return definition === undefined || typeName === undefined ? [] : [{ definition, typeName, version }];
}
