import { createTestBuses } from '@ddd-ts-kit/testing';
{{#if world.hasFakes}}
{{world.fakeImports}}

export interface {{world.pascal}}WorldFakes {
{{world.members}}
}
{{/if}}

export interface {{world.pascal}}WorldOptions {
  readonly now?: Date;
  readonly idPrefix?: string;
{{#if world.hasFakes}}
  readonly given?: (fakes: {{world.pascal}}WorldFakes) => Promise<void>;
{{/if}}
}

{{#if world.hasFakes}}
export async function {{world.article}}{{world.pascal}}World({ given, ...settings }: {{world.pascal}}WorldOptions = {}) {
{{/if}}
{{#unless world.hasFakes}}
export async function {{world.article}}{{world.pascal}}World(settings: {{world.pascal}}WorldOptions = {}) {
{{/unless}}
{{#if world.hasFakes}}
{{world.built}}

  await given?.(fakes);

{{/if}}
  const buses = createTestBuses(settings);

{{world.returnedBuses}}
}
