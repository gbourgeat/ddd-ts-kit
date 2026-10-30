import { describe, expect, it } from 'vitest';
import { loadSourceFile } from '../src/check/project/load-source-file';
import { parseConfig } from '../src/config';
import { constructorOf } from '../src/declared/injection/constructor-of';
import { parameterShape } from '../src/declared/injection/parameter-shape';
import { rawClassName } from '../src/declared/injection/raw-class-name';
import { renderFolderDeclarations } from '../src/declared/render-folder-declarations';

const CONFIG = parseConfig({ contexts: { billing: { classification: 'core' } } });
const HANDLER = 'src/contexts/billing/application/commands/issue-invoice/issue-invoice.handler.ts';
const nothing = (): undefined => undefined;

describe('the constructor a declared class is built by', () => {
  it('is unknown for a class the file does not declare', () => {
    const file = loadSourceFile(CONFIG, HANDLER, 'export class IssueInvoiceHandler {}\n');

    expect(constructorOf({ sources: nothing, file, className: 'Nope' })).toBeUndefined();
  });

  it('is the one of a base class declared in the same file', () => {
    const file = loadSourceFile(CONFIG, HANDLER, 'class Base {}\nexport class IssueInvoiceHandler extends Base {}\n');

    expect(constructorOf({ sources: nothing, file, className: 'IssueInvoiceHandler' })).toEqual({
      file,
      line: 1,
      parameters: [],
    });
  });
});

describe('a constructor parameter read as text', () => {
  it('finds the default value after a function type, whose brackets and arrow are not one', () => {
    expect(parameterShape('handler: (a: string) => void = () => {}')).toEqual({
      name: 'handler',
      type: '(a: string) => void',
      oddity: 'has a default value',
    });
  });

  it('names no class for type arguments that never close', () => {
    expect(rawClassName('Cache<T')).toBeUndefined();
  });
});

describe('the declarations of a folder', () => {
  it('export nothing when no file of the folder plays a declared role', () => {
    expect(renderFolderDeclarations(['README.md'], { specifierOf: (file) => file, modules: [] })).toBe('export {};\n');
  });
});
