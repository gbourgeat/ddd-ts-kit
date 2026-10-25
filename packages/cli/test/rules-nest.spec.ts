import { describe, expect, it } from 'vitest';
import { runCheck } from '../src/check/engine/run-check';
import { loadProject } from '../src/check/project/load-project';
import { lines, projectWith, reported } from './rules-support';

const RULE = 'nest/no-parallel-pipeline';
const BILLING = 'src/contexts/billing';
const CONTROLLER = `${BILLING}/presentation/http/invoices.controller.ts`;
const ADAPTER = `${BILLING}/infrastructure/external/stripe-payment.gateway.ts`;

describe('nest/no-parallel-pipeline', () => {
  it('says, for each tool of Nest an import brings into a context, what the kit does in its place', () => {
    const files = {
      [CONTROLLER]: lines(
        "import { Controller, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';",
        "import { ApiTags } from '@nestjs/swagger';",
      ),
    };

    const { violations } = runCheck(loadProject(projectWith(files)), { rules: [RULE] });
    const [controller, swagger] = violations;

    expect(controller?.message).toBe(
      '"@nestjs/common" brings a controller Nest serves and a guard and a pipe of Nest into a context, where the pipeline of the kit does not see it.',
    );

    expect(controller?.fix).toContain('`@KitRoute` of `@ddd-ts-kit/http/nest` on each method');
    expect(controller?.fix).toContain('which the bus checks on every door: HTTP, /rpc, /trpc, a job, an event');
    expect(controller?.fix).toContain('the schemas of the route');
    expect(swagger?.message).toContain('brings Swagger of Nest');
    expect(swagger?.fix).toContain('the OpenAPI contract the kit generates from the routes');
  });

  it('judges presentation/, infrastructure/ and the module file of a context, outside its tests', () => {
    const files = {
      [CONTROLLER]: lines("import { HttpException } from '@nestjs/common';"),
      [ADAPTER]: lines(
        "import { Injectable, Logger } from '@nestjs/common';",
        "import { CommandBus } from '@nestjs/cqrs';",
      ),
      [`${BILLING}/billing.module.ts`]: lines("import { ConfigService } from '@nestjs/config';"),
      [`${BILLING}/test/unit/invoice.spec.ts`]: lines("import { Controller } from '@nestjs/common';"),
      'src/platform/http/app-module.ts': lines("import { Module, UseGuards } from '@nestjs/common';"),
      'src/shared-kernel/money.vo.ts': lines("import { Injectable } from '@nestjs/common';"),
    };

    expect(found(files)).toEqual([
      `${BILLING}/billing.module.ts:1 "@nestjs/config" brings its configuration of Nest`,
      `${ADAPTER}:1 "@nestjs/common" brings its logger of Nest`,
      `${ADAPTER}:2 "@nestjs/cqrs" brings CQRS of Nest`,
      `${CONTROLLER}:1 "@nestjs/common" brings an exception filter or an HTTP exception of Nest`,
    ]);
  });

  it('leaves the packages of Nest the kit has no answer to, its container, and everything that is not Nest', () => {
    const files = {
      [ADAPTER]: lines(
        "import type { ClientProxy } from '@nestjs/microservices';",
        "import { WebSocketGateway } from '@nestjs/websockets';",
        "import { Resolver } from '@nestjs/graphql';",
        "import { Controller } from '@ddd-ts-kit/http';",
        "import { Inject, Injectable } from '@nestjs/common';",
        "// import { Controller } from '@nestjs/common';",
      ),
    };

    expect(found(files)).toEqual([]);

    expect(
      found({ [CONTROLLER]: lines("import { Get } from '@nestjs/common';") }, { rules: { [RULE]: 'off' } }),
    ).toEqual([]);
  });

  it('lets a controller the kit serves declare its routes with the decorators of Nest, and refuses there what the kit does not read', () => {
    const files = {
      [CONTROLLER]: lines(
        "import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';",
        "import { CurrentActor, KitRoutes } from '@ddd-ts-kit/http/nest';",
      ),
    };

    expect(found(files)).toEqual([
      `${CONTROLLER}:1 "@nestjs/common" brings the raw request or answer and a guard of Nest`,
    ]);
  });

  it('refuses outside the contexts a controller Nest serves that reaches a use case, through a bus or a context', () => {
    const files = {
      'src/platform/http/invoices.controller.ts': lines(
        "import { Controller, Post } from '@nestjs/common';",
        "import type { CommandBus } from '@ddd-ts-kit/kernel';",
      ),
      'src/platform/http/billing.controller.ts': lines(
        "import { Controller, Get } from '@nestjs/common';",
        "import { IssueInvoiceCommand } from '@/contexts/billing/application/commands/issue-invoice/issue-invoice.command';",
      ),
      'src/platform/http/served.controller.ts': lines(
        "import { Controller, Post } from '@nestjs/common';",
        "import type { CommandBus } from '@ddd-ts-kit/kernel';",
        "import { KitRoute } from '@ddd-ts-kit/http/nest';",
      ),
      'src/platform/http/health.controller.ts': lines("import { Controller, Get } from '@nestjs/common';"),
      'src/platform/http/invoices.controller.spec.ts': lines(
        "import { Controller } from '@nestjs/common';",
        "import type { CommandBus } from '@ddd-ts-kit/kernel';",
      ),
    };

    const routed = reported(projectWith(files), RULE).map(({ file, line }) => `${file}:${line}`);

    expect(routed.sort()).toEqual([
      'src/platform/http/billing.controller.ts:1',
      'src/platform/http/invoices.controller.ts:1',
    ]);
  });
});

function found(files: Readonly<Record<string, string>>, config: Record<string, unknown> = {}): string[] {
  return reported(projectWith(files, config), RULE)
    .map(({ file, line, message }) => `${file}:${line} ${message.slice(0, message.indexOf(' into a context'))}`)
    .sort();
}
