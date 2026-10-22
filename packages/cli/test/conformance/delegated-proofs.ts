import type { Change } from './injection';
import { PATHS } from './paths';
import { SOURCE_ALIAS } from './source-alias';
import { SOURCE_SUFFIX } from './source-suffix';

const { HANDLER_SPEC, NOTIFICATION, ROUTE } = PATHS;
const SERVICE = 'src/contexts/analytics/domain/services/occupancy-measure.service.ts';

/** A mistake only one of the delegated tools of the baseline sees, and what that tool has to print. */
export interface DelegatedProof {
  readonly tool: 'graph' | 'deadCode' | 'typeChecked';
  readonly what: string;
  readonly changes: readonly Change[];
  /** Printed by the tool: the rule or the name it reports, and the file. */
  readonly prints: readonly string[];
}

export const DELEGATED_PROOFS: readonly DelegatedProof[] = [
  {
    tool: 'graph',
    what: 'dependency-cruiser follows a re-export of an adapter out of the presentation layer',
    changes: [
      {
        file: ROUTE,
        where: 'end',
        to: `\nexport * from '${SOURCE_ALIAS}contexts/notification/infrastructure/persistence/notification.mapper${SOURCE_SUFFIX}';\n`,
      },
    ],
    prints: [
      'layer-presentation-no-infrastructure',
      ROUTE,
      `${NOTIFICATION}/infrastructure/persistence/notification.mapper.ts`,
    ],
  },
  {
    tool: 'deadCode',
    what: 'knip reports an export nothing uses',
    changes: [{ file: SERVICE, where: 'end', to: '\nexport const FORGOTTEN_RATE = 0.2;\n' }],
    prints: ['FORGOTTEN_RATE', SERVICE],
  },
  {
    tool: 'typeChecked',
    what: 'the type checker reads the specs: a wrong argument in a test is an error',
    changes: [
      {
        file: HANDLER_SPEC,
        from: ".plannedFor(startsAt)\n        .sent(new Date('2026-01-09T10:00:00.000Z'))",
        to: ".plannedFor(startsAt)\n        .sent('2026-01-09T10:00:00.000Z')",
      },
    ],
    prints: [HANDLER_SPEC, 'TS2345'],
  },
];
