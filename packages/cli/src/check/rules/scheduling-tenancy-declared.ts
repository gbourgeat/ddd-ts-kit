import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import { jobsDeclared } from '../scheduling/jobs-declared';
import { perFile } from '../support/per-file';
import { callArguments } from '../text/call-arguments';
import type { ListPart } from '../text/list-part';

const TENANCY_KEY = /^tenancy\s*:/;
const TENANCY_LITERAL = /^tenancy\s*:\s*(['"`])(?:global|per-tenant)\1$/;

const FIX =
  "Say it in the options of the job: `tenancy: 'per-tenant'` to run it once per tenant of the TenantDirectory, each run in the execution scope of that tenant (the default for a job that reads or writes tenant data), or `tenancy: 'global'` for work across tenants, which runs in no tenant and so reaches no tenant-scoped repository.";

export const schedulingTenancyDeclared: Rule = {
  id: 'scheduling/tenancy-declared',
  description:
    'In a multi-tenant project ("stack.tenancy" other than "none"), a job states whether it runs per tenant or globally: `tenancy: \'per-tenant\'` or `tenancy: \'global\'` in the options of `@Scheduled(..)` and of `builder.job(..)`.',
  scope: 'file',
  run(project) {
    if (project.config.stack.tenancy === 'none') {
      return [];
    }

    return perFile(project, this.id, (file) => (file.isTest ? [] : undeclared(file)));
  },
};

function undeclared(file: SourceFile): Finding[] {
  return jobsDeclared(file).flatMap(({ owner, line, args }) => {
    const reading = tenancyOf(file, args[1]);

    if (reading === 'declared') {
      return [];
    }

    const what =
      reading === 'missing'
        ? `The options given to ${owner} do not say whether the job runs per tenant or globally: without \`tenancy\` it runs globally, in no tenant, and a tenant-scoped repository refuses it at run time.`
        : `The checker cannot read the \`tenancy\` option given to ${owner} (the options are not an object literal, spread another object, or give \`tenancy\` something other than a literal), so it cannot tell whether the job states it.`;

    return [{ line, message: what, fix: FIX }];
  });
}

/** What the options of a job say about its tenancy: a literal `global` or `per-tenant`, nothing, or something the checker cannot read. */
function tenancyOf(file: SourceFile, options: ListPart | undefined): 'declared' | 'missing' | 'unread' {
  if (options === undefined || !options.code.startsWith('{')) {
    return 'unread';
  }

  const members = callArguments(file.scan.code, options.start).map(({ start, code }) =>
    file.text.slice(start, start + code.length),
  );

  if (members.some((member) => member.startsWith('...') || member.startsWith('['))) {
    return 'unread';
  }

  const written = members.find((member) => TENANCY_KEY.test(member) || member === 'tenancy');

  if (written === undefined) {
    return 'missing';
  }

  return TENANCY_LITERAL.test(written) ? 'declared' : 'unread';
}
