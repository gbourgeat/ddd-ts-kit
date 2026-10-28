@@imports
import { {{module.camel}}Module } from '{{alias.context}}/{{module.kebab}}/{{module.kebab}}.module{{alias.ext}}';
@@handlers
{{module.camel}}Module.registerHandlers(platform);
@@reactions
{{module.camel}}Module.registerReactions(platform);
@@jobs
{{module.camel}}Module.registerJobs(platform);
@@authorization
...{{module.camel}}Module.useCases(),
{{#if http.any}}
@@routes
...{{module.camel}}Module.routes(platform),
{{/if}}
