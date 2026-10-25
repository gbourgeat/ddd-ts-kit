import { CONFIG_FILE } from '../../config';
import { renderControllersFile } from '../../nest-controllers/render-controllers-file';
import { config } from './config';
import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';

const { BILLING, CATALOG } = PATHS;
const RULE = 'nest/controllers-current';
const FOLDER = `${BILLING}/presentation/http/invoices/issue-invoice`;
const CONTROLLER = `${FOLDER}/issue-invoice.controller.ts`;
const ANSWER = `${FOLDER}/issue-invoice.answer.ts`;
const BILLING_FILE = `${BILLING}/billing.controllers.ts`;
const CATALOG_FILE = `${CATALOG}/catalog.controllers.ts`;
const NEST = { stack: { http: 'nest', di: 'nest', validation: 'class-validator', routes: 'nest' } };

const controller = (answered: string): string =>
  `import { Controller, Post } from '@nestjs/common';
import { KitRoutes } from '@ddd-ts-kit/http/nest';
import { IssueInvoiceAnswer } from '@/contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.answer.js';

@Controller('invoices')
@KitRoutes({ guards: [] })
export class IssueInvoiceController {
  @Post()
  async issueInvoice(): Promise<${answered}> {
    return new IssueInvoiceAnswer();
  }
}
`;

const ANSWERED = renderControllersFile('billing', 'billingControllers', [
  {
    file: CONTROLLER,
    className: 'IssueInvoiceController',
    specifier: '@/contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.controller.js',
    methods: [
      {
        name: 'issueInvoice',
        line: 9,
        answer: {
          kind: 'class',
          name: 'IssueInvoiceAnswer',
          specifier: '@/contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.answer.js',
        },
        declaresResponse: false,
      },
    ],
  },
]);

export const NEST_CONTROLLERS_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'the generated list of a context, the answer of each method read from its signature',
    expect: 'pass',
    files: nestProject({ [CONTROLLER]: controller('IssueInvoiceAnswer'), [BILLING_FILE]: ANSWERED }),
  },
  {
    ruleId: RULE,
    name: 'the generated list left behind a controller written since',
    expect: { file: BILLING_FILE },
    files: nestProject({
      [CONTROLLER]: controller('IssueInvoiceAnswer'),
      [BILLING_FILE]: renderControllersFile('billing', 'billingControllers', []),
    }),
  },
  {
    ruleId: RULE,
    name: 'a method that answers a list the kit cannot read into a schema',
    expect: { file: CONTROLLER },
    files: nestProject({
      [CONTROLLER]: controller('IssueInvoiceAnswer[]'),
      [BILLING_FILE]: renderControllersFile('billing', 'billingControllers', [
        {
          file: CONTROLLER,
          className: 'IssueInvoiceController',
          specifier: '@/contexts/billing/presentation/http/invoices/issue-invoice/issue-invoice.controller.js',
          methods: [{ name: 'issueInvoice', line: 9, answer: { kind: 'unread', text: '' }, declaresResponse: false }],
        },
      ]),
    }),
  },
];

function nestProject(files: Record<string, string>): Record<string, string> {
  return project(
    {
      [ANSWER]: 'export class IssueInvoiceAnswer {}\n',
      [CATALOG_FILE]: renderControllersFile('catalog', 'catalogControllers', []),
      ...files,
    },
    { [CONFIG_FILE]: config(NEST) },
  );
}
