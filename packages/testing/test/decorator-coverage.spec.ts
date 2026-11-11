import { describe, expect, it } from 'vitest';
import { decoratorCoverage } from '../src/vitest';

const HINT = '/* v8 ignore next */';

const TRANSFORMED = [
  'let IssueInvoiceHandler = class IssueInvoiceHandler {',
  '\tconstructor(invoices) {}',
  '};',
  '_decorate([IsString(), _decorateMetadata("design:type", String)], IssueInvoiceBody.prototype, "customerId", void 0);',
  'IssueInvoiceHandler = _decorate([CommandHandler(IssueInvoice), _decorateMetadata("design:paramtypes", [typeof InvoiceRepository === "undefined" ? Object : InvoiceRepository])], IssueInvoiceHandler);',
  'export { IssueInvoiceHandler };',
].join('\n');

const STANDARD = [
  '        static {',
  '            _issued_decorators = [On(invoiceIssued)];',
  '            __esDecorate(this, null, _issued_decorators, { kind: "method", name: "issued", static: false, private: false, access: { has: obj => "issued" in obj, get: obj => obj.issued }, metadata: _metadata }, null, _instanceExtraInitializers);',
  '            __esDecorate(null, _classDescriptor = { value: _classThis }, _classDecorators, { kind: "class", name: _classThis.name, metadata: _metadata }, null, _classExtraInitializers);',
  '            InvoicesToShip = _classThis = _classDescriptor.value;',
  '        }',
].join('\n');

describe('decoratorCoverage(), on standard decorators', () => {
  it('marks every statement that applies one, whose access closures no spec calls', () => {
    const marked =
      decoratorCoverage().transform(STANDARD, '/project/src/invoices-to-ship.projection.ts')?.code.split('\n') ?? [];

    const source = STANDARD.split('\n');

    expect(marked[0]).toBe(source[0]);
    expect(marked[1]).toBe(`${source[1] ?? ''} ${HINT}`);
    expect(marked[2]).toBe(`${source[2] ?? ''} ${HINT}`);
    expect(marked[3]).toBe(source[3]);
    expect(marked[4]).toBe(source[4]);
  });
});

describe('decoratorCoverage(), the Vitest plugin', () => {
  const plugin = decoratorCoverage();

  it('marks every statement that applies legacy decorators, at the end of the line above it', () => {
    const marked = plugin.transform(TRANSFORMED, '/project/src/issue-invoice.handler.ts')?.code.split('\n') ?? [];
    const source = TRANSFORMED.split('\n');

    expect(marked[2]).toBe(`}; ${HINT}`);
    expect(marked[3]).toBe(`${source[3] ?? ''} ${HINT}`);
    expect(marked[4]).toBe(source[4]);
    expect(marked[5]).toBe(source[5]);
  });

  it('moves no column of the source map: the code of every line still starts where it did', () => {
    const result = plugin.transform(TRANSFORMED, '/project/src/issue-invoice.handler.ts');
    const marked = result?.code.split('\n') ?? [];

    expect(result?.map).toBeNull();

    expect(marked.map((line, index) => line.startsWith(TRANSFORMED.split('\n')[index] ?? 'absent'))).not.toContain(
      false,
    );
  });

  it('leaves alone a file without decorators, a dependency, and a line whose comment would swallow the hint', () => {
    const commented = TRANSFORMED.replace('};\n', '}; // the class\n');

    expect(plugin.transform('export const answer = 42;\n', '/project/src/answer.ts')).toBeUndefined();
    expect(plugin.transform(TRANSFORMED, '/project/node_modules/library/index.js')).toBeUndefined();
    expect(plugin.transform(commented, '/project/src/issue-invoice.handler.ts')?.code).toContain('}; // the class\n');
  });

  it('leaves alone a file that names _decorate without applying a decorator', () => {
    const named = 'import { __decorate as _decorate } from "tslib";\nexport const helper = _decorate;\n';

    expect(plugin.transform(named, '/project/src/helper.ts')).toBeUndefined();
  });
});
