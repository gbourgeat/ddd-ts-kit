import type { Fixture } from './fixture';
import { PATHS } from './paths';
import { project } from './project';

const { BILLING, ADAPTER, GATEWAY, MODULE } = PATHS;
const RULE = 'nest/no-parallel-pipeline';
const NEST_CONTROLLER = `${BILLING}/presentation/http/invoices.controller.ts`;

export const NEST_FIXTURES: readonly Fixture[] = [
  {
    ruleId: RULE,
    name: 'Nest in the platform, a client of Nest microservices in an adapter, and the testing module of Nest in a spec',
    expect: 'pass',
    files: project({
      'src/platform/http/app-module.ts':
        "import { Module } from '@nestjs/common';\nimport { APP_GUARD } from '@nestjs/core';\n\n@Module({})\nexport class AppModule {\n  readonly guard = APP_GUARD;\n}\n",
      [GATEWAY]:
        "import type { ClientProxy } from '@nestjs/microservices';\n\nexport class InProcessPriceCatalogGateway {\n  constructor(private readonly client: ClientProxy) {}\n}\n",
      [`${BILLING}/test/unit/invoices.spec.ts`]:
        "import { Test } from '@nestjs/testing';\nimport { it } from 'vitest';\n\nit.todo(String(Test));\n",
    }),
  },
  {
    ruleId: RULE,
    name: 'a controller of Nest in a context, behind a guard of Nest',
    expect: { file: NEST_CONTROLLER },
    files: project({
      [NEST_CONTROLLER]:
        "import { Controller, Post, UseGuards } from '@nestjs/common';\n\n@Controller('invoices')\nexport class InvoicesController {\n  @Post()\n  @UseGuards()\n  issue(): void {}\n}\n",
    }),
  },
  {
    ruleId: RULE,
    name: 'an HTTP exception of Nest thrown by an adapter',
    expect: { file: ADAPTER },
    files: project({
      [ADAPTER]:
        "import { NotFoundException } from '@nestjs/common';\n\nexport class InMemoryInvoiceRepository {\n  find(): never {\n    throw new NotFoundException();\n  }\n}\n",
    }),
  },
  {
    ruleId: RULE,
    name: 'the configuration module of Nest in the module file of a context',
    expect: { file: MODULE },
    files: project({
      [MODULE]: "import { ConfigService } from '@nestjs/config';\n\nexport const settings = ConfigService;\n",
    }),
  },
];
