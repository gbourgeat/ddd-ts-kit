import { readEventDefinitions, type EventDefinition } from '../../describe/read-event-definitions';
import type { Scope } from '../scope';
import type { EventDeclaration } from './event-declaration';

/** One version of an event type that `list` shows; the declaration is there when its exported type can be read. */
export type FoundDeclaration = {
  readonly file: string;
  readonly version: number;
  readonly declaration: EventDeclaration | undefined;
};

/** The versions of `eventType` the published language of an upstream declares, read as `list` reads them. */
export function declarationsOf(scope: Scope, upstream: string, eventType: string): FoundDeclaration[] {
  return readEventDefinitions(scope.ws, `${scope.config.contextsDir}/${upstream}`)
    .filter(({ type }) => type === eventType)
    .map((definition) => ({
      file: definition.file,
      version: definition.version,
      declaration: declarationIn(scope, definition),
    }));
}

function declarationIn(scope: Scope, { name, file, version }: EventDefinition): EventDeclaration | undefined {
  const exported = [...(scope.ws.read(file) ?? '').matchAll(/export type (\w+) = IntegrationEvent</g)].map(
    (match) => match[1] ?? '',
  );

  const typeName = exported.find((candidate) => candidate.toLowerCase() === name.toLowerCase());

  return typeName === undefined ? undefined : { definition: name, typeName, version };
}
