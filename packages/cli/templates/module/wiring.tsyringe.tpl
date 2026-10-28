@@imports
import { {{module.camel}}Module } from '{{alias.context}}/{{module.kebab}}/{{module.kebab}}.module{{alias.ext}}';
@@registrations
{{module.camel}}Module.register(builder);
@@start
{{module.camel}}Module.onStart({ resolve });
