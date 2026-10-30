import type { Scope } from '../scope';
import type { EventDeclaration } from './event-declaration';

export type FoundDeclaration = { readonly file: string; readonly declaration: EventDeclaration };

/** The declarations of `eventType` in the published language of an upstream, one per version written. */
export function declarationsOf(scope: Scope, upstream: string, eventType: string): FoundDeclaration[] {
  const directory = `${scope.config.contextsDir}/${upstream}/published-language`;

  return scope.ws.list(directory).flatMap((name) => {
    const file = `${directory}/${name}`;
    const content = scope.ws.read(file) ?? '';

    return content.includes(`type: '${eventType}'`)
      ? declarationIn(content).map((declaration) => ({ file, declaration }))
      : [];
  });
}

function declarationIn(content: string): EventDeclaration[] {
  const definition = /export const (\w+) = defineIntegrationEvent\b/.exec(content)?.[1];
  const typeName = /export type (\w+) = IntegrationEvent</.exec(content)?.[1];
  const version = Number(/\bversion:\s*(\d+)/.exec(content)?.[1] ?? '1');

  return definition === undefined || typeName === undefined ? [] : [{ definition, typeName, version }];
}
