@@imports
{{#if style.declared}}
import { IdentityProviderAdmin } from '{{alias.context}}/application/ports/identity-provider-admin.port{{alias.ext}}';
{{/if}}
{{#unless style.declared}}
import { {{context.camel}}Module } from '{{alias.context}}/{{context.kebab}}.module{{alias.ext}}';
{{/unless}}
import { FakeIdentityProviderAdmin } from '{{alias.context}}/test/fakes/identity-provider-admin.fake{{alias.ext}}';
@@e2e-fakes
{{#if style.declared}}
builder.rebind(IdentityProviderAdmin).toValue(new FakeIdentityProviderAdmin());
{{/if}}
{{#unless style.declared}}
if (module === {{context.camel}}Module) {
  return (platform) => {{context.camel}}Module(platform, { identityProvider: new FakeIdentityProviderAdmin() });
}
{{/unless}}
