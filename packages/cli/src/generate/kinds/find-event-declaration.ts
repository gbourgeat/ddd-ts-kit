import type { Scope } from '../scope.js';
import type { EventDeclaration } from './event-declaration.js';

/** Looks for the declaration of `eventType` in the published language of an upstream of this repository. */
export function findEventDeclaration(scope: Scope, upstream: string, eventType: string): EventDeclaration | undefined {
  const directory = `${scope.config.contextsDir}/${upstream}/published-language`;

  const declarations = scope.ws
    .list(directory)
    .map((file) => scope.ws.read(`${directory}/${file}`) ?? '')
    .filter((content) => content.includes(`type: '${eventType}'`))
    .flatMap(declarationIn);

  // A new consumer has no reason to start on an old contract.
  return declarations.reduce<EventDeclaration | undefined>((newest, candidate) => (newest === undefined || candidate.version > newest.version ? candidate : newest), undefined);
}

function declarationIn(content: string): EventDeclaration[] {
  const definition = /export const (\w+) = defineIntegrationEvent\b/.exec(content)?.[1];
  const typeName = /export type (\w+) = IntegrationEvent</.exec(content)?.[1];
  const version = Number(/\bversion:\s*(\d+)/.exec(content)?.[1] ?? '1');

  return definition === undefined || typeName === undefined ? [] : [{ definition, typeName, version }];
}
