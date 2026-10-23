import { DECLARED_CONTEXT } from './declared-context';
import { DECLARED_DECLARATIONS, ROLE_FOLDER_DECLARATIONS } from './declared-declarations';
import { declaredProject } from './declared-project';
import type { Fixture } from './fixture';
import type { FixtureFiles } from './fixture-files';
import { PATHS } from './paths';
import { SINGLE_FILE_DECLARATIONS } from './single-file-declarations';
import { withoutFile } from './without-file';

const { APPLICATION_DECLARATIONS, BARREL, BILLING } = PATHS;

/** The billing context declared in the single file of 0.84: no declarations file in a role folder. */
const singleFile = (declarations: string): FixtureFiles =>
  Object.fromEntries(
    Object.entries(declaredProject(DECLARED_CONTEXT, { [BARREL]: declarations })).filter(
      ([file]) => file === BARREL || !file.startsWith(`${BILLING}/`) || !file.endsWith('.declarations.ts'),
    ),
  );

/** The layouts of the declarations an earlier version wrote: accepted while current, then refused. */
export const EARLIER_DECLARATIONS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'declarations/barrel-current',
    name: 'the declarations of a role folder that 0.85 and 0.86 wrote, left behind next to those of the layers',
    expect: { file: `${BILLING}/application/commands/commands.declarations.ts` },
    files: declaredProject(DECLARED_CONTEXT, {
      ...DECLARED_DECLARATIONS,
      [`${BILLING}/application/commands/commands.declarations.ts`]:
        ROLE_FOLDER_DECLARATIONS[`${BILLING}/application/commands/commands.declarations.ts`] ?? '',
    }),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'the declarations of the role folders of 0.85 and 0.86, current and not moved yet: a warning, until a later minor version',
    expect: { file: BARREL },
    severity: 'warn',
    files: withoutFile(
      withoutFile(declaredProject(DECLARED_CONTEXT, ROLE_FOLDER_DECLARATIONS), APPLICATION_DECLARATIONS),
      `${BILLING}/infrastructure/infrastructure.declarations.ts`,
    ),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'the single declarations file of 0.84, current and not moved yet: a warning, until a later minor version',
    expect: { file: BARREL },
    severity: 'warn',
    files: singleFile(SINGLE_FILE_DECLARATIONS),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'the single declarations file of 0.84 that misses a role file: stale, an error',
    expect: { file: BARREL },
    files: singleFile(
      SINGLE_FILE_DECLARATIONS.replace(
        "export * from '@/contexts/billing/application/scheduling/send-reminders.job.js';\n",
        '',
      ),
    ),
  },
  {
    ruleId: 'declarations/barrel-current',
    name: 'a context half moved, the single declarations file of 0.84 next to the declarations of its layers: an error',
    expect: { file: BARREL },
    files: declaredProject(DECLARED_CONTEXT, { [BARREL]: SINGLE_FILE_DECLARATIONS }),
  },
];
