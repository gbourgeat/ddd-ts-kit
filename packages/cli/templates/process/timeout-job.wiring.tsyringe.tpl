@@imports
import { ProcessRunner } from '@ddd-ts-kit/kernel';
import { {{name.pascal}}TimeoutBackgroundJob } from '{{alias.context}}/application/background/{{name.kebab}}-timeout.background-job{{alias.ext}}';
@@registrations
builder.backgroundJob({{name.pascal}}TimeoutBackgroundJob.jobName).handledBy({{name.pascal}}TimeoutBackgroundJob, [ProcessRunner]);
