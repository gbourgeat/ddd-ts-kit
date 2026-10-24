@@imports
import { {{name.pascal}}TimeoutBackgroundJob } from '{{alias.context}}/application/background/{{name.kebab}}-timeout.background-job{{alias.ext}}';
@@registrations
platform.backgroundJobs.register({{name.pascal}}TimeoutBackgroundJob, [platform.processes]);
