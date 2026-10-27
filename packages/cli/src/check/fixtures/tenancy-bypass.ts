import type { Fixture } from './fixture';
import { project } from './project';
import { TENANCY_ADAPTERS } from './tenancy-adapters';
import { tenancyConfig } from './tenancy-config';

/** A repository of a shared-table project whose one method goes around the helpers: what `tenancy/scoped-statement` reports. */
export function tenancyBypass(orm: keyof typeof TENANCY_ADAPTERS, name: string, body: string): Fixture {
  const { file: adapter, owner } = TENANCY_ADAPTERS[orm];

  return {
    ruleId: 'tenancy/scoped-statement',
    name: `${orm}: ${name}`,
    expect: { file: adapter },
    files: project({ [adapter]: `export class ${owner} {\n  find() {\n    ${body}\n  }\n}\n` }, tenancyConfig(orm)),
  };
}
