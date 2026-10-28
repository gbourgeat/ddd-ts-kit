@@imports
{{#if di.tsyringe}}
import { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
{{/if}}
{{#unless di.tsyringe}}
import { {{context.camel}}Module } from '{{alias.context}}/{{context.kebab}}.module{{alias.ext}}';
{{/unless}}
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';
@@e2e-fakes
{{#if di.tsyringe}}
builder.rebind(IdentityProviderAdmin).toValue(new FakeIdentityProviderAdmin());
{{/if}}
{{#unless di.tsyringe}}
if (module === {{context.camel}}Module) {
  return (platform) => {{context.camel}}Module(platform, { identityProvider: new FakeIdentityProviderAdmin() });
}
{{/unless}}
