@@imports
import { CommandBus } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}Job } from '{{alias.context}}/application/scheduling/{{name.kebab}}.job.js';
@@registrations
builder.job('{{job.name}}', {{job.schedule}}).handledBy({{name.pascal}}Job, [CommandBus]);
