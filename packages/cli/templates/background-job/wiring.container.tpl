@@imports
import { CommandBus } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}BackgroundJob } from '{{alias.context}}/application/background/{{name.kebab}}.background-job{{alias.ext}}';
@@registrations
builder.backgroundJob({{name.pascal}}BackgroundJob.jobName).handledBy({{name.pascal}}BackgroundJob, [CommandBus]);
