import { toName } from '../../naming/index.js';
import type { CodeEntry } from '../errors/code-entry.js';
import type { CodeList } from '../errors/code-list.js';
import { codeListName } from '../errors/code-list-name.js';
import { isCodesFile } from '../errors/is-codes-file.js';
import { isErrorFile } from '../errors/is-error-file.js';
import { namesRefusals } from '../errors/names-refusals.js';
import { readCodeList } from '../errors/read-code-list.js';
import { refusalClasses } from '../errors/refusal-classes.js';
import type { Finding } from '../model/finding.js';
import type { Rule } from '../model/rule.js';
import type { SourceFile } from '../model/source-file.js';
import type { Violation } from '../model/violation.js';
import type { ClassShape } from '../structure/class-shape.js';
import { reporter } from '../support/reporter.js';
import { toViolations } from '../support/to-violations.js';

const CODE_FIELD = /\breadonly\s+code\s*(?::[^=;]+)?=\s*([^;\n]*)/;
const CONSTANT_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

const CONTRACT =
  'the list is the closed set of the codes the context answers with, which the error mapper, the OpenAPI document and the clients read.';

/** The error files of one context: its code list, when it has one, and its refusal classes. */
interface ContextErrors {
  readonly context: string;
  readonly listName: string;
  readonly codesFile: SourceFile | undefined;
  readonly list: CodeList | undefined;
  readonly refusals: readonly Refusal[];
}

interface Refusal {
  readonly file: SourceFile;
  readonly shape: ClassShape;
}

export const errorsCodeListed: Rule = {
  id: 'errors/code-listed',
  description:
    'Under "stack.refusals": "named", every refusal class of domain/errors/ (a class extending DomainRefusal) reads its code from the code list of its context, `readonly code = <Context>Codes.<Class>`, which domain/errors/codes.ts declares `as const`; every key of the list is a refusal class of the context and every value a string literal in constant case.',
  scope: 'project',
  run(project) {
    if (!namesRefusals(project)) {
      return [];
    }

    const report = reporter(project, this.id);

    return errorsByContext(project.files).flatMap((errors) => {
      const byFile = new Map<string, Finding[]>();

      const add = (file: SourceFile, finding: Finding | undefined): void => {
        if (finding !== undefined) {
          byFile.set(file.path, [...(byFile.get(file.path) ?? []), finding]);
        }
      };

      for (const refusal of errors.refusals) {
        add(refusal.file, unlistedCode(refusal, errors));
      }

      if (errors.codesFile !== undefined) {
        for (const finding of listFlaws(errors)) {
          add(errors.codesFile, finding);
        }
      }

      return [...byFile].flatMap(([file, findings]): Violation[] => toViolations(report, file, findings));
    });
  },
};

function errorsByContext(files: readonly SourceFile[]): ContextErrors[] {
  const contexts = new Map<string, SourceFile[]>();

  for (const file of files.filter(isErrorFile)) {
    const context = file.location.area === 'context' ? file.location.context : '';

    contexts.set(context, [...(contexts.get(context) ?? []), file]);
  }

  return [...contexts].map(([context, sources]) => {
    const listName = codeListName(context);
    const codesFile = sources.find(isCodesFile);

    return {
      context,
      listName,
      codesFile,
      list: codesFile === undefined ? undefined : readCodeList(codesFile.scan, listName),
      refusals: sources.flatMap((file) => refusalClasses(file.scan).map((shape) => ({ file, shape }))),
    };
  });
}

/** What keeps a refusal class from reading its own code from the list of its context; undefined when it does. */
function unlistedCode(refusal: Refusal, errors: ContextErrors): Finding | undefined {
  const { name } = refusal.shape;
  const expected = `${errors.listName}.${name}`;
  const listed = errors.list?.entries.some((candidate) => candidate.key === name) === true;
  const entry = `${name}: '${toName(name).constant}'`;

  const addEntry = listed
    ? ''
    : `, and add the entry \`${entry}\` to the domain/errors/codes.ts of "${errors.context}"`;

  const field = codeField(refusal);

  if (field === undefined) {
    return {
      line: refusal.shape.line,
      message: `${name} declares no code: a refusal reads its code from ${errors.listName}, under its own name.`,
      fix: `Add \`readonly code = ${expected};\` to the class${addEntry}: ${CONTRACT}`,
    };
  }

  if (field.written.replace(/\s+/g, '') !== expected) {
    return {
      line: field.line,
      message: `${name} sets its code to \`${field.written}\`, not to ${expected}.`,
      fix: `Write \`readonly code = ${expected};\`, the code of the class under its own name${addEntry}: ${CONTRACT}`,
    };
  }

  return errors.codesFile === undefined || (errors.list !== undefined && !listed)
    ? { line: field.line, ...missingFromList(name, errors, entry) }
    : undefined;
}

/** The `readonly code` field of a refusal class: its line and its value as written; undefined when it has none. */
function codeField({ file, shape }: Refusal): { readonly line: number; readonly written: string } | undefined {
  const field = CODE_FIELD.exec(file.scan.code.slice(shape.bodyStart, shape.end));

  if (field === null) {
    return undefined;
  }

  const value = field[1] ?? '';
  const valueStart = shape.bodyStart + field.index + field[0].length - value.length;

  return {
    line: file.scan.lineAt(shape.bodyStart + field.index),
    written: file.text.slice(valueStart, valueStart + value.length).trim(),
  };
}

/** A class that reads its own entry, from a list missing or without that entry. */
function missingFromList(name: string, errors: ContextErrors, entry: string): Omit<Finding, 'line'> {
  const expected = `${errors.listName}.${name}`;

  if (errors.codesFile === undefined) {
    return {
      message: `${name} reads ${expected}, but the context "${errors.context}" has no domain/errors/codes.ts.`,
      fix: `Create domain/errors/codes.ts with \`export const ${errors.listName} = { ${entry} } as const;\` and its type, or run \`ddd-ts-kit generate error ${errors.context} ${name} <factory>\`, which writes both.`,
    };
  }

  return {
    message: `${errors.listName} has no entry ${name}: the code of the refusal is not listed.`,
    fix: `Add \`${entry}\` to ${errors.listName} in the domain/errors/codes.ts of "${errors.context}": ${CONTRACT}`,
  };
}

/** What is wrong with the code list itself: missing, not `as const`, an entry of no refusal, a code not in constant case. */
function listFlaws({ context, listName, list, refusals }: ContextErrors): Finding[] {
  if (list === undefined) {
    return [
      {
        line: 1,
        message: `domain/errors/codes.ts of "${context}" declares no ${listName}.`,
        fix: `Declare \`export const ${listName} = { <Refusal>: '<CODE>' } as const;\`, one entry per refusal class of "${context}", and \`export type ${listName.replace(/s$/, '')} = (typeof ${listName})[keyof typeof ${listName}];\`.`,
      },
    ];
  }

  const classes = new Set(refusals.map(({ shape }) => shape.name));

  const notConstant: Finding[] = list.constant
    ? []
    : [
        {
          line: list.line,
          message: `${listName} is not declared \`as const\`: every code is typed string, and a refusal loses the type of its own code.`,
          fix: 'End the declaration with `} as const;`.',
        },
      ];

  return [...notConstant, ...list.entries.flatMap((entry) => entryFlaws(entry, classes, { context, listName }))];
}

/** An entry that names no refusal class of the context, or whose code is not a string literal in constant case. */
function entryFlaws(
  { key, code, line }: CodeEntry,
  classes: ReadonlySet<string>,
  { context, listName }: Pick<ContextErrors, 'context' | 'listName'>,
): Finding[] {
  if (!classes.has(key)) {
    return [
      {
        line,
        message: `${listName} lists ${key}, which no refusal class of the domain/errors/ of "${context}" is.`,
        fix: `Remove the entry, or write the refusal: \`ddd-ts-kit generate error ${context} ${key} <factory>\`. A code no refusal sets is a promise the contract makes for nothing.`,
      },
    ];
  }

  return code !== undefined && CONSTANT_CASE.test(code) ? [] : [badCode(key, code, line)];
}

function badCode(key: string, code: string | undefined, line: number): Finding {
  const example = `'${toName(key).constant}'`;

  return {
    line,
    message:
      code === undefined
        ? `The code of ${key} is not a string literal.`
        : `The code of ${key}, "${code}", is not in constant case.`,
    fix: `Write it as a string literal in upper-case words separated by underscores, for example ${example}: the list holds the codes themselves, as the contract writes them. A project that already answers with a code in constant case keeps it, even when it differs from the name of the class.`,
  };
}
