@@imports
import { {{name.pascal}}Job } from '{{alias.context}}/application/scheduling/{{name.kebab}}.job{{alias.ext}}';
@@registrations
const {{name.camel}}Job = new {{name.pascal}}Job(platform.commands);

platform.jobs.register({
  name: '{{job.name}}',
  schedule: {{job.schedule}},
  run: (execution) => {{name.camel}}Job.run(execution),
});
