@@imports
{{#if di.container}}
import { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
{{/if}}
{{#unless di.container}}
import { {{context.camel}}Module } from '{{alias.context}}/{{context.kebab}}.module{{alias.ext}}';
{{/unless}}
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';
@@e2e-fakes
{{#if di.container}}
builder.rebind(IdentityProviderAdmin).toValue(new FakeIdentityProviderAdmin());
{{/if}}
{{#unless di.container}}
if (module === {{context.camel}}Module) {
  return (platform) => {{context.camel}}Module(platform, { identityProvider: new FakeIdentityProviderAdmin() });
}
{{/unless}}
