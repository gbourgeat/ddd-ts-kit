import type { Fixture } from './fixture';
import { project } from './project';
import { TENANCY_ADAPTERS } from './tenancy-adapters';
import { tenancyConfig } from './tenancy-config';

/** A fixture of one ORM: a name, the body of the one method of a repository, and members beside that method. */
type ConjunctCase = (name: string, body: string, members?: string) => Fixture;

/** The fixtures of one ORM on the tenant condition: what the rule refuses, and what it accepts. */
export function conjunctCases(orm: keyof typeof TENANCY_ADAPTERS): {
  readonly refused: ConjunctCase;
  readonly accepted: ConjunctCase;
} {
  const { file, owner } = TENANCY_ADAPTERS[orm];

  const fixture = (name: string, expect: Fixture['expect'], source: string): Fixture => ({
    ruleId: 'tenancy/scoped-statement',
    name,
    expect,
    files: project({ [file]: source }, tenancyConfig(orm)),
  });

  const source = (body: string, members = ''): string =>
    `export class ${owner} {\n  find() {\n    ${body}\n  }\n${members}}\n`;

  return {
    refused: (name, body, members) =>
      fixture(`${orm}, the tenant is no conjunct: ${name}`, { file }, source(body, members)),
    accepted: (name, body, members) =>
      fixture(`${orm}, the tenant is a conjunct: ${name}`, 'pass', source(body, members)),
  };
}
