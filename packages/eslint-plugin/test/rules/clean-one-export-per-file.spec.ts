import { cleanOneExportPerFile } from '../../src/rules/clean-one-export-per-file';
import { at, BILLING, ruleTester } from '../support/rule-tester';

const RETRY =
  'export interface RetryOptions { readonly attempts: number }\nexport function retry(options: RetryOptions): Aspect { return defineAspect(retryAdvice(options)); }\nexport function retryAdvice(options: RetryOptions): AdviceFactory { return make(options); }';

const REWRITE =
  'export interface FromRewrite { readonly from: string }\nexport interface SetRewrite { readonly of: readonly Rewrite[] }\nexport type Rewrite = FromRewrite | SetRewrite;\nexport function from(relation: string): FromRewrite { return { from: relation }; }\nexport function union(...of: Rewrite[]): SetRewrite { return { of }; }';

const SEQUENCE =
  'const counters = new Map<string, number>();\nexport function sequence(name: string): Resolvable<string>;\nexport function sequence<T>(name: string, format: (n: number) => T): Resolvable<T>;\nexport function sequence(name: string, format?: (n: number) => unknown): Resolvable<unknown> { return lazy(() => counters.get(name)); }\nexport function resetSequences(): void { counters.clear(); }';

const RUNTIME =
  'let installed: Runtime = {};\nconst scoped = new AsyncLocalStorage<Runtime>();\nexport function install(runtime: Runtime): void { installed = runtime; }\nexport function runWith<T>(runtime: Runtime, work: () => T): T { return scoped.run(runtime, work); }\nexport function current(): Runtime { return scoped.getStore() ?? installed; }';

const TWO =
  'export function loggerOr(given?: Logger): Logger { return given ?? fallback(); }\nexport function clockOr(given?: Clock): Clock { return given ?? fallback(); }';

ruleTester.run('clean-one-export-per-file: the count', cleanOneExportPerFile, {
  valid: [
    at('src/platform/retry.ts', 'export function retry(): void {}'),
    at(
      'src/platform/retry.ts',
      'export const DEFAULT_ATTEMPTS = 3;\nexport type Attempts = number;\nexport enum Mode { Fast }\nexport function retry(): void {}',
    ),
    at(
      'src/platform/retry.ts',
      'export interface RetryOptions { readonly backoff: Backoff }\nexport interface Backoff { readonly ms: number }\nexport function retry(options: RetryOptions): void {}',
    ),
    at(
      'src/platform/outbox-relay.ts',
      'export interface RelayOptions { readonly batch: number }\nexport interface TickResult { readonly sent: number }\nexport class OutboxRelay { constructor(private readonly options: RelayOptions) {} tick(): Promise<TickResult> { return run(this.options); } }',
    ),
    at(
      'src/platform/pino-logger.ts',
      'export interface PinoOptions { readonly level: string }\nexport class PinoLogger implements Logger<PinoOptions> {}',
    ),
    at(
      'src/shared-kernel/result.ts',
      'export interface Ok<T> { readonly value: T }\nexport interface Err { readonly error: string }\nexport type Result<T> = Ok<T> | Err;',
    ),
    at(
      'src/platform/wiring-description.ts',
      'export interface WiringDescription { readonly bindings: readonly BindingDescription[] }\nexport interface BindingDescription { readonly origin: OriginDescription }\nexport interface OriginDescription { readonly file: string }',
    ),
    at(
      'src/platform/command-handler.ts',
      'export interface CommandHandler<M> { execute(message: M): Promise<void> }\nexport function CommandHandler(message: unknown): ClassDecorator { return decorate(message); }',
    ),
    at('src/platform/retry.ts', RETRY),
    at('src/platform/rewrite.ts', REWRITE),
    at(
      'src/platform/selectors.ts',
      "import type { Selector } from './selector.js';\nexport function allOf(...selectors: Selector[]): Selector { return all(selectors); }\nexport function not(selector: Selector): Selector { return negate(selector); }",
    ),
    at(
      'src/platform/sql.ts',
      'export class Sql {}\nexport function sql(text: string): Sql { return new Sql(); }\nexport function joined(parts: Sql[]): Sql { return new Sql(); }',
    ),
    at('src/platform/sequence.ts', SEQUENCE),
    at('src/platform/installed-runtime.ts', RUNTIME),
    at(
      'src/platform/retry.ts',
      'function retry(): void {}\nfunction helper(): void {}\nclass Local {}\nexport { retry };',
    ),
    at('src/platform/retry.ts', 'export default function retry(): void {}'),
    at('src/main.ts', 'start();'),
    at(`${BILLING}/test/fakes/fakes.ts`, TWO),
    at('src/platform/helpers.spec.ts', TWO),
    at('scripts/helpers.ts', TWO),
    at('packages/kernel/src/a/logger-or.ts', 'export function loggerOr(): void {}', {}),
    at('packages/kernel/test/support/helpers.ts', TWO, {}),
  ],
  invalid: [
    {
      ...at('src/platform/collaborators.ts', TWO),
      errors: [{ messageId: 'several', line: 2, data: { count: 2, names: 'loggerOr, clockOr' } }],
    },
    { ...at('packages/kernel/src/collaborators.ts', TWO, {}), errors: [{ messageId: 'several' }] },
    {
      ...at('src/platform/retry.ts', 'export class Retry {}\nexport class RetryError extends Error {}'),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        'src/platform/retry.ts',
        'export interface RetryOptions { readonly attempts: number }\nexport interface Unrelated { readonly a: number }\nexport function retry(options: RetryOptions): void {}',
      ),
      errors: [{ messageId: 'several', data: { count: 3, names: 'RetryOptions, Unrelated, retry' } }],
    },
    {
      ...at('src/platform/retry.ts', 'export function retry(): void {}\nexport function retryAdvice(): void {}'),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        'src/platform/retry.ts',
        'export function retry(): void { backoff(); }\nexport function backoff(): void {}',
      ),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        'src/platform/make.ts',
        'export function a(): Promise<void> { return run(); }\nexport function b(): Promise<void> { return run(); }',
      ),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        'src/platform/state.ts',
        'const PATTERN = /a/;\nexport function a(): boolean { return PATTERN.test("a"); }\nexport function b(): boolean { return PATTERN.test("b"); }',
      ),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        'src/platform/state.ts',
        'let first = 0;\nlet second = 0;\nexport function a(): number { return first; }\nexport function b(): number { return second; }',
      ),
      errors: [{ messageId: 'several' }],
    },
    {
      ...at(
        'src/platform/retry.ts',
        'function retry(): void {}\nfunction backoff(): void {}\nexport { retry, backoff };',
      ),
      errors: [{ messageId: 'several' }],
    },
  ],
});
