import { defineContextModule } from '@ddd-ts-kit/di';
{{#if persistence.packagedToken}}
import { {{persistence.token}} } from '{{persistence.tokenPackage}}';
{{/if}}
{{#if persistence.ownDatabase}}
import { Database } from '{{alias.platform}}/database/database{{alias.ext}}';
{{/if}}
// ddd-ts-kit:imports
// /ddd-ts-kit:imports

/** The platform of a handler spec: no storage behind it, so every repository a test touches has to be faked. */
export const platformTestModule = defineContextModule({
  name: 'platform',
  register(builder) {
    {{#if persistence.hasDatabase}}
    builder.bind({{persistence.token}}).toFactory(() => {
      throw new Error('A handler spec has no database: give a fake for the repository it uses.');
    });

    {{/if}}
    // ddd-ts-kit:test-bindings
    // /ddd-ts-kit:test-bindings
  },
});
