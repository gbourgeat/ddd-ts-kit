@@imports
{{#if command.hasAggregate}}
import { CLOCK, ID_GENERATOR } from '@ddd-ts-kit/di';
import { DOMAIN_EVENTS } from '{{paths.contextToPlatform}}/platform.module.js';
{{/if}}
import { {{name.pascal}}Command } from './application/commands/{{name.kebab}}/{{name.kebab}}.command.js';
import { {{name.pascal}}Handler } from './application/commands/{{name.kebab}}/{{name.kebab}}.handler.js';
@@registrations
{{#if command.hasAggregate}}
builder.command({{name.pascal}}Command).handledBy({{name.pascal}}Handler, [{{aggregate.constant}}_REPOSITORY, DOMAIN_EVENTS, ID_GENERATOR, CLOCK]);
{{/if}}
{{#unless command.hasAggregate}}
builder.command({{name.pascal}}Command).handledBy({{name.pascal}}Handler);
{{/unless}}
