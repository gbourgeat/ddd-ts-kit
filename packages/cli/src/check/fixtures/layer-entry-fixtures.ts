import { CONFIG_FILE } from '../../config';
import { aggregate } from './aggregate';
import { config } from './config';
import type { Fixture } from './fixture';
import { handler } from './handler';
import { outsidePackageDeviation } from './outside-package-deviation';
import { PATHS } from './paths';
import { project } from './project';

const { AGGREGATE, HANDLER } = PATHS;

/** An allowed package of the kit does not allow its entries for adapters, wiring and test doubles. */
export const LAYER_ENTRY_FIXTURES: readonly Fixture[] = [
  {
    ruleId: 'layer/domain-purity',
    name: 'the test doubles of the kernel in the domain: the allow-list names the kernel, not its testing entry',
    expect: { file: AGGREGATE },
    files: project(
      aggregate(
        "import { FixedClock } from '@ddd-ts-kit/kernel/testing';\nexport class Invoice {}\nexport { FixedClock };\n",
      ),
    ),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'an authentication adapter of @ddd-ts-kit/auth in a handler: the allow-list names the package, not its adapters',
    expect: { file: HANDLER },
    files: project(
      handler(
        "import { passportAuthenticator } from '@ddd-ts-kit/auth/passport';\nexport class IssueInvoiceHandler {}\nexport { passportAuthenticator };\n",
      ),
    ),
  },
  {
    ruleId: 'layer/application-inward',
    name: 'an entry of @ddd-ts-kit/auth the allow-list names itself',
    expect: 'pass',
    files: project(
      handler(
        "import type { RelationTuple } from '@ddd-ts-kit/auth/rebac';\nexport class IssueInvoiceHandler {}\nexport type T = RelationTuple;\n",
      ),
      {
        [CONFIG_FILE]: config({
          applicationAllowedPackages: ['@ddd-ts-kit/kernel', '@ddd-ts-kit/auth', '@ddd-ts-kit/auth/rebac'],
          deviations: [outsidePackageDeviation('applicationAllowedPackages', '@ddd-ts-kit/auth/rebac')],
        }),
      },
    ),
  },
];
