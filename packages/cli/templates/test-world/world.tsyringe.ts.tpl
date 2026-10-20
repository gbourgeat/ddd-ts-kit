import { RoleBasedAuthorizer } from '@ddd-ts-kit/auth';
import { authorizationModule } from '@ddd-ts-kit/auth/di';
{{world.diImport}}
{{world.contextImport}}
import { platformTestModule } from '{{alias.platform}}/composition/platform-test.module{{alias.ext}}';
{{#if world.hasFakes}}
{{world.portImports}}
{{world.fakeImports}}
{{/if}}

const nobody = authorizationModule({ authorizer: new RoleBasedAuthorizer({ roles: {} }) });
{{#if world.hasFakes}}

export interface {{world.pascal}}WorldFakes {
{{world.members}}
}
{{/if}}

export interface {{world.pascal}}WorldOptions {
  readonly now?: Date;
  readonly idPrefix?: string;
  readonly modules?: readonly ContextModule[];
{{#if world.hasFakes}}
  readonly given?: (fakes: {{world.pascal}}WorldFakes) => Promise<void>;
{{/if}}
}

export async function {{world.article}}{{world.pascal}}World({ modules = [nobody], {{world.given}}...settings }: {{world.pascal}}WorldOptions = {}) {
{{#if world.assembles}}
  const context = {{world.context}};

{{/if}}
{{#if world.hasFakes}}
{{world.built}}

  await given?.(fakes);

{{/if}}
  const application = createTestApplication({
    ...settings,
    eventBusFailures: 'as-thrown',
    modules: [platformTestModule, {{world.contextModule}}, ...modules],
{{#if world.hasFakes}}
{{world.overrides}}
{{/if}}
  });

{{#if world.hasFakes}}
  return { application, ...fakes };
{{/if}}
{{#unless world.hasFakes}}
  return { application };
{{/unless}}
}
