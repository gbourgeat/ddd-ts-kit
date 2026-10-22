import { describe, expect, it } from 'vitest';
import { DECLARED } from '../src/check/fixtures/declared';
import { declaredProject } from '../src/check/fixtures/declared-project';
import { PATHS } from '../src/check/fixtures/paths';
import { SAMPLES } from '../src/check/fixtures/samples';
import { tempDir, write } from './helpers';
import { reported } from './rules-support';

const { JOB, JOB_SPEC } = PATHS;
const RULE = 'scheduling/job-triggers-use-case';

function messagesFor(job: string): string[] {
  const root = tempDir('scheduling-job-reach');

  for (const [file, content] of Object.entries(declaredProject({ [JOB]: job, [JOB_SPEC]: SAMPLES.SPEC }))) {
    write(root, file, content);
  }

  return reported(root, RULE).map(({ message }) => message);
}

function withImports(...imports: string[]): string {
  return `${imports.join('\n')}\n${DECLARED.job}`;
}

describe('scheduling/job-triggers-use-case on what a job reaches', () => {
  it('reports a job file that exports no class', () => {
    expect(messagesFor('export const sendReminders = 1;\n')).toEqual(['The job file exports no class.']);
  });

  it('reports a job that imports infrastructure/ of its context', () => {
    const job = withImports(
      "import { SmtpMailer } from '@/contexts/billing/infrastructure/external/smtp-mailer.adapter.js';",
    );

    expect(messagesFor(job)).toEqual(['The job imports infrastructure/: the work is in the command, not in the job.']);
  });

  it('lets a job import the platform, the events of its domain and a repository it does not depend on', () => {
    const job = withImports(
      "import { Database } from '@/platform/database.js';",
      "import { InvoiceIssued } from '@/contexts/billing/domain/events/invoice-issued.event.js';",
      "import type { InvoiceRepository } from '@/contexts/billing/domain/repositories/invoice.repository.js';",
    );

    expect(messagesFor(job)).toEqual([]);
  });
});
