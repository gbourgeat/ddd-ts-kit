import { purityNoAmbientRandomness, purityNoEnvironment, purityNoSystemClock } from '../../src/rules/purity';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const AGGREGATE = `${BILLING}/domain/aggregates/invoice.aggregate.ts`;
const HANDLER = `${BILLING}/application/commands/issue-invoice/issue-invoice.handler.ts`;
const ADAPTER = `${BILLING}/infrastructure/external/system.clock.ts`;

ruleTester.run('purity-no-system-clock', purityNoSystemClock, {
  valid: [
    at(AGGREGATE, 'const due = new Date(issuedAt.getTime() + 30 * DAY);'),
    at(AGGREGATE, "const epoch = new Date('2020-01-01T00:00:00Z');"),
    at(HANDLER, 'const now = this.clock.now();'),
    at(ADAPTER, 'export const systemClock = { now: () => new Date() };'),
    at(`${BILLING}/test/unit/invoice.aggregate.spec.ts`, 'const now = new Date();'),
    at(AGGREGATE, 'class Date {}\nconst mine = new Date();'),
    at(AGGREGATE, 'function elapsed(clock: { now(): number }) { return clock.now(); }'),
    at(AGGREGATE, 'const text = "Date.now()"; // new Date()'),
    at(AGGREGATE, 'const parsed = Date.parse(raw);'),
    at(AGGREGATE, 'const { parse } = Date;'),
    at(AGGREGATE, 'let clock = Date;\nclock = FixedDate;\nclock.now();'),
  ],
  invalid: [
    {
      ...at(AGGREGATE, 'const now = new Date();'),
      errors: [{ messageId: 'used', data: { what: 'new Date() without argument', layer: 'domain' } }],
    },
    { ...at(AGGREGATE, 'const now = new Date;'), errors: [{ messageId: 'used' }] },
    {
      ...at(HANDLER, 'const started = Date.now();'),
      errors: [{ messageId: 'used', data: { what: 'Date.now', layer: 'application' } }],
    },
    {
      ...at(HANDLER, 'const stamp = Date();'),
      errors: [{ messageId: 'used', data: { what: 'Date()', layer: 'application' } }],
    },
    { ...at(HANDLER, 'const started = performance.now();'), errors: [{ messageId: 'used' }] },
    { ...at(HANDLER, 'const started = globalThis.Date.now();'), errors: [{ messageId: 'used' }] },
    { ...at(HANDLER, "const read = Date['now'];"), errors: [{ messageId: 'used' }] },
    { ...at(HANDLER, 'const stamps = ids.map(() => new Date());'), errors: [{ messageId: 'used' }] },
    {
      ...at(AGGREGATE, 'const { now } = Date;'),
      errors: [{ messageId: 'used', data: { what: 'Date.now', layer: 'domain' } }],
    },
    {
      ...at(AGGREGATE, 'const clock = Date;\nconst started = clock.now();'),
      errors: [{ messageId: 'used', data: { what: 'Date.now', layer: 'domain' } }],
    },
  ],
});

ruleTester.run('purity-no-ambient-randomness', purityNoAmbientRandomness, {
  valid: [
    at(HANDLER, 'const id = this.ids.next();'),
    at(AGGREGATE, 'const rounded = Math.round(total);'),
    at(ADAPTER, "import { randomUUID } from 'node:crypto';\nexport const ids = { next: () => randomUUID() };"),
    at(AGGREGATE, 'function pick(random: () => number) { return random(); }'),
    at(AGGREGATE, 'const dice = { random: () => 4 };\ndice.random();'),
    at(AGGREGATE, 'const { [key]: picked, ...others } = Math;'),
  ],
  invalid: [
    {
      ...at(AGGREGATE, 'const draw = Math.random();'),
      errors: [{ messageId: 'used', data: { what: 'Math.random', layer: 'domain' } }],
    },
    { ...at(HANDLER, 'const id = crypto.randomUUID();'), errors: [{ messageId: 'used' }] },
    { ...at(HANDLER, 'const id = globalThis.crypto.randomUUID();'), errors: [{ messageId: 'used' }] },
    {
      ...at(HANDLER, "import { v4 } from 'uuid';"),
      errors: [{ messageId: 'imported', data: { name: 'uuid', layer: 'application' } }],
    },
    { ...at(HANDLER, "import { nanoid } from 'nanoid/non-secure';"), errors: [{ messageId: 'imported' }] },
    { ...at(HANDLER, "import { randomUUID as id } from 'node:crypto';"), errors: [{ messageId: 'used' }] },
    {
      ...at(HANDLER, "import crypto from 'node:crypto';\nconst bytes = crypto.randomBytes(8);"),
      errors: [{ messageId: 'used' }],
    },
    { ...at(HANDLER, "const { ulid } = require('ulid');"), errors: [{ messageId: 'imported' }] },
    {
      ...at(AGGREGATE, 'const { random } = Math;'),
      errors: [{ messageId: 'used', data: { what: 'Math.random', layer: 'domain' } }],
    },
    { ...at(AGGREGATE, 'const maths = Math;\nconst draw = maths.random();'), errors: [{ messageId: 'used' }] },
    {
      ...at(AGGREGATE, "const { 'random': draw } = Math;"),
      errors: [{ messageId: 'used', data: { what: 'Math.random', layer: 'domain' } }],
    },
  ],
});

ruleTester.run('purity-no-environment', purityNoEnvironment, {
  valid: [
    at(HANDLER, 'await this.gateway.charge(amount);'),
    at(ADAPTER, "import fs from 'node:fs';\nconsole.log(process.env['HOME']);"),
    at(AGGREGATE, 'function log(console: { info(text: string): void }) { console.info("x"); }'),
    at(AGGREGATE, 'const process = { env: {} };\nprocess.env;'),
    at(HANDLER, 'const rows = await this.reader.fetch(query);'),
    at('src/main.ts', 'console.log(process.env.PORT);'),
  ],
  invalid: [
    {
      ...at(HANDLER, "const url = process.env['DATABASE_URL'];"),
      errors: [{ messageId: 'used', data: { what: 'process.env', layer: 'application' } }],
    },
    {
      ...at(AGGREGATE, 'console.log(total);'),
      errors: [{ messageId: 'used', data: { what: 'console.log', layer: 'domain' } }],
    },
    {
      ...at(HANDLER, "const response = await fetch('https://example.org');"),
      errors: [{ messageId: 'used', data: { what: 'fetch()', layer: 'application' } }],
    },
    { ...at(HANDLER, "const socket = new WebSocket('wss://example.org');"), errors: [{ messageId: 'used' }] },
    {
      ...at(HANDLER, "import { readFile } from 'node:fs/promises';"),
      errors: [{ messageId: 'imported', data: { name: 'node:fs/promises', layer: 'application' } }],
    },
    { ...at(HANDLER, "import axios from 'axios';"), errors: [{ messageId: 'imported' }] },
    { ...at(HANDLER, "const { spawn } = await import('child_process');"), errors: [{ messageId: 'imported' }] },
    { ...at(HANDLER, 'const out = globalThis.process.stdout;'), errors: [{ messageId: 'used' }] },
    {
      ...at(HANDLER, 'const { env } = process;'),
      errors: [{ messageId: 'used', data: { what: 'process.env', layer: 'application' } }],
    },
    { ...at(HANDLER, "const { log: write } = console;\nwrite('x');"), errors: [{ messageId: 'used' }] },
    { ...at(HANDLER, 'const running = process;\nconst url = running.env.URL;'), errors: [{ messageId: 'used' }] },
  ],
});
