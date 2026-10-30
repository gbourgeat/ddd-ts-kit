import { describe, expect, it } from 'vitest';
import { applyWiring } from '../src/generate/apply-wiring';
import { addCode } from '../src/generate/errors/add-code';
import { codesList } from '../src/generate/errors/codes-list';
import { editJson } from '../src/generate/kinds/extraction/edit-json';
import { factoryOf } from '../src/generate/kinds/factory-of';
import { parameterCount } from '../src/generate/kinds/parameter-count';
import { refreshDocs } from '../src/generate/refresh-docs';
import { Workspace } from '../src/workspace';
import { tempDir, write } from './helpers';

const MAIN = 'src/main.ts';
const WIRING = "@@imports\nimport { billingModule } from '@/contexts/billing/billing.module';\n";

describe('the wiring of a generated element, where the file to wire it in is not as init wrote it', () => {
  it('is left by hand when the file does not exist', () => {
    const ws = new Workspace(tempDir('wiring-absent'), false);

    applyWiring(ws, MAIN, WIRING);

    expect(ws.notes).toEqual([`${MAIN} does not exist: wire the new element by hand.`]);
  });

  it('is left by hand, with its block, when the file has no region for it', () => {
    const root = tempDir('wiring-region');
    const ws = new Workspace(root, false);

    write(root, MAIN, 'export const app = 1;\n');
    applyWiring(ws, MAIN, WIRING);

    expect(ws.notes).toEqual([
      `${MAIN} has no "ddd-ts-kit:imports" region: add this by hand:\nimport { billingModule } from '@/contexts/billing/billing.module';`,
    ]);
  });
});

describe('a JSON file of the project a generator edits', () => {
  it('is said missing when it is not there', () => {
    const ws = new Workspace(tempDir('json-absent'), false);

    editJson(ws, 'knip.json', () => undefined);

    expect(ws.notes).toEqual(['knip.json does not exist: nothing was added to it.']);
  });
});

describe('what the generators read of an aggregate and a code list', () => {
  it('adds the first entry of an empty code list', () => {
    const source = 'export const BillingCodes = {} as const;\n';
    const list = codesList(source, 'BillingCodes');

    if (list === undefined) {
      throw new Error('no code list');
    }

    expect(addCode(source, list, { key: 'InvoiceIssued', code: 'INVOICE_ISSUED' })).toBe(
      "export const BillingCodes = {\n  InvoiceIssued: 'INVOICE_ISSUED',\n} as const;\n",
    );
  });

  it('counts the parameters of create past the type arguments of one of them', () => {
    expect(parameterCount('static create(id: Map<string, number>, now: Date) {')).toBe(2);
  });

  it('finds no factory in an aggregate without static create', () => {
    expect(factoryOf('export class Invoice {}\n')).toBeUndefined();
  });
});

describe('the derived files of a project', () => {
  it('are not refreshed where there is no config to derive them from', () => {
    const ws = new Workspace(tempDir('refresh-nothing'), false);

    refreshDocs(ws, 'move');

    expect(ws.commit(false)).toMatchObject({ created: [], updated: [], deleted: [] });
  });
});
