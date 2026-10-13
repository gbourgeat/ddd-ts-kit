import type { Exported } from '../exports/exported.js';
import type { Finding } from '../model/finding.js';
import type { SourceFile } from '../model/source-file.js';
import type { ClassShape } from '../structure/class-shape.js';
import type { MethodShape } from '../structure/method-shape.js';
import { exportedFunctionBody } from './exported-function-body.js';
import { extendsValueObject } from './extends-value-object.js';
import { generateHint } from './generate-hint.js';
import { exportedValues } from './exported-values.js';
import { initializerOf } from './initializer-of.js';
import { literalAt } from './literal-at.js';

/** What a value object file says of itself: one class extending ValueObject, built by static factories, and nothing else that stands for a value. */
export function valueObjectFileFindings(file: SourceFile, sharedKernelDir: string): Finding[] {
  const exported = exportedValues(file);
  const classes = exported.filter(({ kind }) => kind === 'class');
  const [main, ...others] = classes;

  const shapeOf = (name: string): ClassShape | undefined =>
    file.structure.classes.find((shape) => shape.name === name && shape.depth === 0);

  const shape = main === undefined ? undefined : shapeOf(main.name);

  return [
    ...(main === undefined ? [noClass(file)] : []),
    ...others.map(({ name, line }) => ({
      line,
      message: `The value object file exports a second class, ${name}.`,
      fix: `Move ${name} to a *.vo.ts of its own: one value object per file, named after it.`,
    })),
    ...(shape === undefined ? [] : classFindings(file, shape, sharedKernelDir)),
    ...functionsAndLiterals(exported),
  ];
}

function noClass(file: SourceFile): Finding {
  return {
    line: 1,
    message: 'The value object file exports no class.',
    fix: `Write the value as a class: \`export class <Name> extends ValueObject<<Name>Props>\`, a private constructor and a static factory that checks its rules (${generateHint(file)}). A function or an object literal gives no equality by value, no single place for the invariants and nothing \`instanceof\` can recognise.`,
  };
}

function classFindings(file: SourceFile, shape: ClassShape, sharedKernelDir: string): Finding[] {
  return [
    ...(extendsValueObject(file, shape, sharedKernelDir) ? [] : [notValueObject(shape)]),
    ...publicConstructor(shape),
    ...(shape.isAbstract || shape.methods.some(isFactory) ? [] : [noFactory(shape)]),
  ];
}

function notValueObject({ name, line }: ClassShape): Finding {
  return {
    line,
    message: `${name} does not extend ValueObject.`,
    fix: 'Extend ValueObject of @ddd-ts-kit/kernel, or another value object of the project: it gives equality by value (`equals`), frozen props and `toJSON`.',
  };
}

function publicConstructor({ name, methods }: ClassShape): Finding[] {
  const constructor = methods.find(({ isConstructor }) => isConstructor);

  return constructor?.visibility === 'public'
    ? [
        {
          line: constructor.line,
          message: `The constructor of ${name} is public.`,
          fix: `Make it private (protected on a base other value objects extend) and build the value through a static factory, \`${name}.create(..)\`, that checks its rules: a ${name} that exists is a valid one.`,
        },
      ]
    : [];
}

function isFactory({ isStatic, visibility }: MethodShape): boolean {
  return isStatic && visibility !== 'private';
}

function noFactory({ name, line }: ClassShape): Finding {
  return {
    line,
    message: `${name} has no static factory.`,
    fix: `Add \`static create(..): ${name}\`, which checks the rules and returns \`new ${name}(..)\`; name the other ones after what they build (\`${name}.closed()\`, \`${name}.between(..)\`).`,
  };
}

function functionsAndLiterals(exported: readonly Exported[]): Finding[] {
  return exported
    .filter((entry, index) => exported.findIndex(({ name }) => name === entry.name) === index)
    .flatMap((entry) => {
      if (entry.kind === 'function' || exportedFunctionBody(entry) !== undefined) {
        return [
          {
            line: entry.line,
            message: `The value object file exports the function ${entry.name}.`,
            fix: 'Make it a static factory or a method of the value object class: what builds or reads the value lives next to its data.',
          },
        ];
      }

      return isObjectLiteral(entry)
        ? [
            {
              line: entry.line,
              message: `The value object file exports the object literal ${entry.name}.`,
              fix: `Make it a static factory of the class, \`static ${entry.name}()\`, which builds a checked instance; a closed list of values is a vocabulary (domain/vocabularies/*.vocabulary.ts).`,
            },
          ]
        : [];
    });
}

function isObjectLiteral({ kind, text }: Exported): boolean {
  const start = kind === 'const' ? initializerOf(text) : undefined;

  return start !== undefined && literalAt(text, start) !== undefined;
}
