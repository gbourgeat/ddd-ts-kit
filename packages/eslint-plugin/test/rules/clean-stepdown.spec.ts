import { cleanStepdown } from '../../src/rules/clean-stepdown';
import { ruleTester } from '../support/rule-tester';

ruleTester.run('clean-stepdown', cleanStepdown, {
  valid: [
    `class Invoice {
      private constructor(private state: State) {}
      static create(): Invoice { return new Invoice(Invoice.#initial()); }
      issue(): void { this.#guard(); this.record(); }
      get total(): number { return this.sum(); }
      #guard(): void {}
      private record(): void { this.sum(); }
      private sum(): number { return 0; }
      static #initial(): State { return {}; }
    }`,
    `export function total(lines: Line[]): number { return lines.map(price).reduce(add, 0); }
     function price(line: Line): number { return line.unit * line.quantity; }
     function add(left: number, right: number): number { return left + right; }`,
    `export const total = (lines: Line[]): number => lines.map(price).length;
     const price = (line: Line): number => line.unit;`,
    `const price = (line: Line): number => line.unit;
     export const prices = lines.map(price);`,
    `export const parity = (n: number): boolean => isEven(n);
     function isEven(n: number): boolean { return n === 0 ? true : isOdd(n - 1); }
     function isOdd(n: number): boolean { return n === 0 ? false : isEven(n - 1); }`,
    `function isOdd(n: number): boolean { return n === 0 ? false : isEven(n - 1); }
     function isEven(n: number): boolean { return n === 0 ? true : isOdd(n - 1); }`,
    `export const size = (node: Node): number => walk(node);
     function walk(node: Node): number { return node.children.map(walk).length; }`,
    `class Tree {
      size(): number { return this.#count(); }
      #count(): number { return this.#descend(); }
      #descend(): number { return this.#count(); }
    }`,
    `class Walker {
      #visit(node: Node): void { node.children.forEach((child) => this.#visit(child)); }
    }`,
    `function unused(): void {}
     export function main(): void {}`,
    `function helper(): void {}
     export { helper };`,
    `function helper(): void {}
     export default helper;`,
    `class Shape {
      area(): number { return 0; }
      protected abstract perimeter(): number;
    }`,
    `class Counter {
      private count = 0;
      increment(): void { this.count += 1; }
    }`,
    `class Outer {
      run(): void { new (class Inner { go(): void { this.step(); } private step(): void {} })().go(); this.finish(); }
      private finish(): void {}
    }`,
    `// ddd-ts-kit-disable-next-line clean/stepdown -- kept next to the table it reads
     function lookup(): void {}
     export function main(): void { lookup(); }`,
  ],
  invalid: [
    {
      code: `class Invoice {
        private guard(): void {}
        issue(): void { this.guard(); }
      }`,
      errors: [
        {
          messageId: 'nonPublicBeforePublic',
          data: { visibility: 'private', name: 'guard', className: 'Invoice', publicName: 'issue' },
        },
      ],
    },
    {
      code: `class Invoice {
        #guard(): void {}
        protected hook(): void {}
        issue(): void { this.#guard(); }
      }`,
      errors: [
        {
          messageId: 'nonPublicBeforePublic',
          data: { visibility: 'private', name: '#guard', className: 'Invoice', publicName: 'issue' },
        },
        {
          messageId: 'nonPublicBeforePublic',
          data: { visibility: 'protected', name: 'hook', className: 'Invoice', publicName: 'issue' },
        },
      ],
    },
    {
      code: `class Invoice {
        issue(): void { this.record(); }
        static create(): Invoice { return new Invoice(); }
        private record(): void {}
      }`,
      errors: [
        { messageId: 'staticAfterInstance', data: { name: 'create', className: 'Invoice', instanceName: 'issue' } },
      ],
    },
    {
      code: `class Invoice {
        issue(): void { this.record(); }
        private sum(): number { return 0; }
        private record(): void { this.sum(); }
      }`,
      errors: [{ messageId: 'memberAboveCaller', data: { name: 'sum', className: 'Invoice', line: 4 } }],
    },
    {
      code: `class Invoice {
        issue = (): void => { this.#record(); };
        #sum = (): number => 0;
        #record(): void { this.#sum(); }
      }`,
      errors: [{ messageId: 'memberAboveCaller', data: { name: '#sum', className: 'Invoice', line: 4 } }],
    },
    {
      code: `class Registry {
        static open(): Registry { return Registry.build(); }
        private static defaults(): object { return {}; }
        private static build(): Registry { Registry.defaults(); return new Registry(); }
      }`,
      errors: [{ messageId: 'memberAboveCaller', data: { name: 'defaults', className: 'Registry', line: 4 } }],
    },
    {
      code: `function price(line: Line): number { return line.unit; }
        export function total(lines: Line[]): number { return lines.map(price).length; }`,
      errors: [{ messageId: 'functionAboveCaller', data: { name: 'price', line: 2 } }],
    },
    {
      code: `const price = (line: Line): number => line.unit;
        export const total = (lines: Line[]): number => lines.map((line) => price(line)).length;`,
      errors: [{ messageId: 'functionAboveCaller', data: { name: 'price', line: 2 } }],
    },
    {
      code: `export function main(): void { second(); }
        function third(): void {}
        function second(): void { third(); }`,
      errors: [{ messageId: 'functionAboveCaller', data: { name: 'third', line: 3 } }],
    },
    {
      code: `function buildTable(): Table { return {}; }
        export const TABLE = buildTable();`,
      errors: [{ messageId: 'functionAboveCaller', data: { name: 'buildTable', line: 2 } }],
    },
    {
      code: `function isEven(n: number): boolean { return n === 0 ? true : isOdd(n - 1); }
        function isOdd(n: number): boolean { return n === 0 ? false : isEven(n - 1); }
        export function parity(n: number): boolean { return isEven(n); }`,
      errors: [{ messageId: 'functionAboveCaller', data: { name: 'isEven', line: 3 } }],
    },
  ],
});
