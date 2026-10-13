import { describe, expect, it } from 'vitest';
import { controllerSource } from '../src/generate/kinds/presentation/controller-source.js';

const CONTROLLER = [
  "import { Controller, type HttpRequest } from '@ddd-ts-kit/http';",
  "import { classSchema } from '@ddd-ts-kit/validation/class-validator';",
  '',
  'const body = classSchema(BookBody);',
  '',
  '@Controller({',
  "  method: 'POST',",
  "  summary: 'Book',",
  '  body,',
  '})',
  'export class BookController {}',
  '',
].join('\n');

describe('the edits of a controller the generators make', () => {
  it('add a value to an import, kept sorted before the types, once', () => {
    const once = controllerSource.withImport(CONTROLLER, 'defineForm', '@ddd-ts-kit/http');

    expect(once).toContain("import { Controller, defineForm, type HttpRequest } from '@ddd-ts-kit/http';");
    expect(controllerSource.withImport(once, 'defineForm', '@ddd-ts-kit/http')).toBe(once);
  });

  it('add a type-only import of a module the controller does not import yet, after the last import', () => {
    const added = controllerSource.withImport(CONTROLLER, 'type Infer', '@ddd-ts-kit/validation');

    expect(added).toContain(
      "import { classSchema } from '@ddd-ts-kit/validation/class-validator';\nimport type { Infer } from '@ddd-ts-kit/validation';\n",
    );
  });

  it('add a type to a type-only import', () => {
    const source = "import type { Infer } from '@ddd-ts-kit/validation';\nconst x = 1;\n";

    expect(controllerSource.withImport(source, 'type JsonSchema', '@ddd-ts-kit/validation')).toContain(
      "import type { Infer, JsonSchema } from '@ddd-ts-kit/validation';",
    );
  });

  it('add an option after the summary, and a declaration before the decorator', () => {
    const edited = controllerSource.beforeController(
      controllerSource.withOption(CONTROLLER, 'form,'),
      'const form = {};\n',
    );

    expect(edited).toContain("  summary: 'Book',\n  form,\n  body,");
    expect(edited).toContain('const form = {};\n\n@Controller({');
    expect(controllerSource.withOption('no decorator', 'form,')).toBe('no decorator');
  });
});
