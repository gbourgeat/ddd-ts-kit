@@imports
import { {{name.pascal}}BackgroundJob } from '{{alias.context}}/application/background/{{name.kebab}}.background-job{{alias.ext}}';
@@registrations
platform.backgroundJobs.register({{name.pascal}}BackgroundJob, [platform.commands]);
