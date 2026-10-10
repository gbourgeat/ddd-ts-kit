import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll } from 'vitest';
import { portsAbstractClass } from '../../src/rules/ports-abstract-class.js';
import { portsImplementsNeverExtends } from '../../src/rules/ports-implements-never-extends.js';
import { at, BILLING, ruleTester, SAMPLE_CONFIG } from '../support/rule-tester.js';

const DECLARATIONS = '@ddd-ts-kit/kernel/declarations';
const PORT = `${BILLING}/application/ports/payment-gateway.port.ts`;
const REPOSITORY_PORT = `${BILLING}/domain/repositories/invoice.repository.ts`;
const ADAPTER = `${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`;
const MODULE = `${BILLING}/billing.module.ts`;
const declaring = (names: string, code: string): string => `import { ${names} } from '${DECLARATIONS}';\n${code}`;
const fromPort = (code: string): string => `import { InvoiceRepository } from '../../domain/repositories/invoice.repository.js';\n${code}`;

ruleTester.run('ports-abstract-class', portsAbstractClass, {
  valid: [
    at(PORT, 'export abstract class PaymentGateway {\n  abstract charge(invoiceId: string): Promise<void>;\n  abstract readonly name: string;\n}'),
    at(PORT, "export abstract class PaymentGateway {\n  static readonly tokenKey = 'billing.PaymentGateway';\n  abstract charge(invoiceId: string): Promise<void>;\n}"),
    at(REPOSITORY_PORT, "import { Repository } from '@ddd-ts-kit/kernel';\nexport abstract class InvoiceRepository extends Repository<Invoice> {}"),
    at(PORT, 'export type Receipt = { readonly id: string };\ninterface Internal { readonly id: string }\nexport abstract class PaymentGateway { abstract charge(): Promise<Receipt>; }'),
    at(`${BILLING}/application/ports/payment-gateway.ts`, 'export interface PaymentGateway { charge(): void }'),
    at(`${BILLING}/infrastructure/persistence/knex-invoice.repository.ts`, 'export class KnexInvoiceRepository { find(): void {} }'),
    at(`${BILLING}/application/ports/payment-gateway.port.spec.ts`, 'export class Probe { run(): void {} }'),
    at(PORT, 'export class PaymentGateway {}', { ...SAMPLE_CONFIG, rules: { 'ports/abstract-class': 'off' } }),
  ],
  invalid: [
    { ...at(PORT, 'export class PaymentGateway {}'), errors: [{ messageId: 'concrete', data: { className: 'PaymentGateway' } }] },
    { ...at(PORT, 'export interface PaymentGateway { charge(): void }'), errors: [{ messageId: 'interface', data: { name: 'PaymentGateway' } }] },
    { ...at(REPOSITORY_PORT, 'export interface InvoiceRepository extends Repository<Invoice> {}'), errors: [{ messageId: 'interface' }] },
    { ...at(PORT, 'export abstract class PaymentGateway { constructor(readonly key: string) {} }'), errors: [{ messageId: 'member', data: { className: 'PaymentGateway', what: 'a constructor' } }] },
    { ...at(PORT, 'export abstract class PaymentGateway { charge(): void {} }'), errors: [{ messageId: 'member', data: { className: 'PaymentGateway', what: 'the method charge with a body' } }] },
    { ...at(PORT, 'export abstract class PaymentGateway { readonly retries = 3; }'), errors: [{ messageId: 'member', data: { className: 'PaymentGateway', what: 'the property retries with an initializer' } }] },
    { ...at(PORT, 'export abstract class PaymentGateway { readonly name: string; }'), errors: [{ messageId: 'member', data: { className: 'PaymentGateway', what: 'the member name that is not abstract' } }] },
    { ...at(PORT, 'export abstract class PaymentGateway { protected abstract sign(): string; }'), errors: [{ messageId: 'member', data: { className: 'PaymentGateway', what: 'the protected member sign' } }] },
    { ...at(PORT, 'export abstract class PaymentGateway { private key = ""; #secret = ""; }'), errors: [{ messageId: 'member', data: { className: 'PaymentGateway', what: 'the private member key' } }, { messageId: 'member', data: { className: 'PaymentGateway', what: 'the private member #secret' } }] },
    { ...at(PORT, 'export abstract class PaymentGateway { static readonly tokenKey = makeKey(); static readonly other = "x"; }'), errors: [{ messageId: 'member' }, { messageId: 'member' }] },
  ],
});

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ddd-ts-kit-ports-'));

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function inProject(file: string, code: string): { code: string; settings: Record<string, unknown> } {
  return { code, settings: { 'ddd-ts-kit': { config: SAMPLE_CONFIG, filename: file, rootDir: root } } };
}

function onDisk(file: string, code: string): void {
  fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  fs.writeFileSync(path.join(root, file), code);
}

onDisk(ADAPTER, 'export class KnexInvoiceRepository implements InvoiceRepository {}');
onDisk(`${BILLING}/infrastructure/persistence/extending.repository.ts`, 'export class Extending extends InvoiceRepository {}');
onDisk(`${BILLING}/infrastructure/persistence/plain.repository.ts`, 'export class Plain {}');

const binding = (implementation: string, file: string, statement: string): string => `import { ${implementation} } from './infrastructure/persistence/${file}.js';\n${statement}`;

ruleTester.run('ports-implements-never-extends', portsImplementsNeverExtends, {
  valid: [
    at(ADAPTER, declaring('Repository', '@Repository(InvoiceRepository, [Database])\nexport class KnexInvoiceRepository implements InvoiceRepository {}')),
    at(ADAPTER, declaring('Gateway', '@Gateway(PriceCatalog, [])\nexport class HttpPriceCatalog extends HttpClient implements Closeable, PriceCatalog<Price> {}')),
    at(ADAPTER, "import { Repository } from './home-made.js';\n@Repository(InvoiceRepository)\nexport class KnexInvoiceRepository {}"),
    at(ADAPTER, fromPort('export class KnexInvoiceRepository implements InvoiceRepository {}')),
    at(`${BILLING}/test/fakes/invoice.repository.fake.ts`, fromPort('export class Recording extends InvoiceRepository {}')),
    at(MODULE, 'class KnexInvoiceRepository implements InvoiceRepository {}\nbuilder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database]);'),
    at(MODULE, 'class Registry {}\nbuilder.bind(Registry).toClass(Registry);'),
    at(MODULE, "import { Clock } from '@ddd-ts-kit/kernel';\nimport { SystemClock } from 'some-package';\nbuilder.bind(Clock).toClass(SystemClock);"),
    at(MODULE, 'builder.bind(InvoiceRepository).toValue(repository);\nbuilder.bind(InvoiceRepository).toFactory(() => new A());'),
    inProject(MODULE, binding('KnexInvoiceRepository', 'knex-invoice.repository', 'builder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, []);')),
    inProject(MODULE, binding('Missing', 'missing.repository', 'builder.bind(InvoiceRepository).toClass(Missing, []);')),
  ],
  invalid: [
    { ...at(ADAPTER, declaring('Repository', '@Repository(InvoiceRepository, [Database])\nexport class KnexInvoiceRepository {}')), errors: [{ messageId: 'notImplemented', data: { className: 'KnexInvoiceRepository', port: 'InvoiceRepository' } }] },
    { ...at(ADAPTER, declaring('Adapter', '@Adapter(Mailer, { kind: "external" }, [])\nexport class SmtpMailer implements Closeable {}')), errors: [{ messageId: 'notImplemented', data: { className: 'SmtpMailer', port: 'Mailer' } }] },
    { ...at(ADAPTER, declaring('Gateway', '@Gateway(PriceCatalog, [])\nexport class HttpPriceCatalog extends PriceCatalog {}')), errors: [{ messageId: 'extended', data: { className: 'HttpPriceCatalog', port: 'PriceCatalog' } }] },
    { ...at(ADAPTER, fromPort('export class KnexInvoiceRepository extends InvoiceRepository {}')), errors: [{ messageId: 'extended', data: { className: 'KnexInvoiceRepository', port: 'InvoiceRepository' } }] },
    { ...at(ADAPTER, `${declaring('Repository', fromPort('@Repository(InvoiceRepository, [])\nexport class KnexInvoiceRepository extends InvoiceRepository {}'))}`), errors: [{ messageId: 'extended' }] },
    { ...at(MODULE, 'class KnexInvoiceRepository {}\nbuilder.bind(InvoiceRepository).toClass(KnexInvoiceRepository, [Database]);'), errors: [{ messageId: 'notImplemented', line: 2 }] },
    { ...at(MODULE, 'class KnexInvoiceRepository extends InvoiceRepository {}\nrebind(InvoiceRepository).toClass(KnexInvoiceRepository);'), errors: [{ messageId: 'extended', line: 2 }] },
    { ...inProject(MODULE, binding('Extending', 'extending.repository', 'builder.bind(InvoiceRepository).toClass(Extending, []);')), errors: [{ messageId: 'extended', data: { className: 'Extending', port: 'InvoiceRepository' } }] },
    { ...inProject(MODULE, binding('Plain', 'plain.repository', 'builder.rebind(InvoiceRepository).toClass(Plain).as("repository");')), errors: [{ messageId: 'notImplemented', data: { className: 'Plain', port: 'InvoiceRepository' } }] },
  ],
});
