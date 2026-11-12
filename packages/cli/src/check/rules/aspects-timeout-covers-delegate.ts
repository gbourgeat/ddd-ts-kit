import { parameterShape } from '../../declared/injection/parameter-shape';
import { rawClassName } from '../../declared/injection/raw-class-name';
import { adapterPolicies } from '../aspects/adapter-policies';
import type { AdapterPolicy } from '../aspects/adapter-policy';
import { bindingCalls } from '../declarations/binding-calls';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import type { ClassShape } from '../structure/class-shape';
import { importedFrom } from '../support/imported-from';
import { perFile } from '../support/per-file';
import { chainEnd } from '../text/chain-end';
import { escapeRegExp } from '../text/escape-reg-exp';

/** The kinds the default policy of the platform goes around (`resilience/default-policy.ts`). */
const DEFAULTED_KINDS = ['external', 'gateway'];
const DEFAULT_SETTINGS = '/resilience/default-resilience-settings.ts';
const DEFAULT_TIMEOUT = /(?<![\w$.])timeoutMs\s*:\s*(\d[\d_]*)\s*[,}]/;
/** The variable the configuration of the platform reads the default limit from, and the fallback written beside it. */
const DEFAULT_VARIABLE = 'OUTBOUND_TIMEOUT_MS';
const FALLBACK = /^\s*,\s*\{[^{}]*?(?<![\w$.])fallback\s*:\s*(\d[\d_]*)\s*[,}]/;
const FIRST_ARGUMENT = /\(\s*$/;

/** What the rule reads of a project, once. */
interface Reading {
  readonly sources: readonly SourceFile[];
  /** Everything that binds a port: declarations and `bind(...)` calls. */
  readonly policies: readonly AdapterPolicy[];
  /** The text of each `rebind(...)` chain: what it names is bound again somewhere. */
  readonly rebound: readonly string[];
  /** The limit of the default policy of the platform; undefined when the text does not show one number. */
  readonly defaultMs: number | undefined;
}

/** An adapter left to the default policy, with the class the text shows for it. */
interface Outer {
  readonly policy: AdapterPolicy;
  readonly className: string;
  readonly file: SourceFile;
  readonly shape: ClassShape;
}

export const aspectsTimeoutCoversDelegate: Rule = {
  id: 'aspects/timeout-covers-delegate',
  description:
    'An `external` or `gateway` adapter left to the default policy of the platform (no `ownPolicy(...)`, no `timeout(...)` of its own) is not given a port (a constructor parameter typed by it) whose adapter states a longer time limit for all its methods: the default limit, the fallback of `OUTBOUND_TIMEOUT_MS` in the configuration of the platform, else `timeoutMs` of `resilience/default-resilience-settings.ts`, would cut every call the slower adapter still answers. Read from the declarations (`@Adapter`, `@Gateway`) and the bindings of the container of the kit, where the port and the adapter are bound once, without condition, and the durations are written as numbers. An adapter that states its own limit, even a shorter one, chose it.',
  scope: 'project',
  run(project) {
    const sources = project.files.filter((file) => !file.isTest);
    const policies = adapterPolicies(project);

    const reading: Reading = {
      sources,
      policies,
      rebound: policies.length === 0 ? [] : reboundIn(sources),
      defaultMs: policies.length === 0 ? undefined : defaultLimit(sources),
    };

    const outers = policies.flatMap((policy) => outerOf(policy, reading));

    return perFile(project, this.id, (file) =>
      outers.filter((outer) => outer.file === file).flatMap((outer) => cutShort(outer, reading)),
    );
  },
};

function reboundIn(sources: readonly SourceFile[]): string[] {
  return sources.flatMap((file) =>
    bindingCalls(file)
      .filter(({ method }) => method === 'rebind')
      .map(({ open }) => file.scan.code.slice(open, chainEnd(file.scan.code, open + 1))),
  );
}

/**
 * What the default policy cuts an attempt at. `main.ts` gives it the validated configuration, so
 * the fallback written where the platform reads `OUTBOUND_TIMEOUT_MS` counts first; a platform
 * that does not name that variable runs with `timeoutMs` of the default settings. Named twice, or
 * elsewhere than as the first argument of the call that reads it, the limit is not one the text shows.
 */
function defaultLimit(sources: readonly SourceFile[]): number | undefined {
  const platform = sources.filter(({ location }) => location.area === 'platform');
  const settings = platform.find(({ path }) => path.endsWith(DEFAULT_SETTINGS));

  if (settings === undefined) {
    return undefined;
  }

  const named = platform.flatMap(({ scan }) =>
    scan.strings
      .filter(({ value }) => value === DEFAULT_VARIABLE)
      .map(({ start, end }) =>
        FIRST_ARGUMENT.test(scan.code.slice(0, start)) ? FALLBACK.exec(scan.code.slice(end))?.[1] : undefined,
      ),
  );

  const written = named.length === 0 ? DEFAULT_TIMEOUT.exec(settings.scan.code)?.[1] : named[0];

  return named.length > 1 || written === undefined ? undefined : Number(written.replaceAll('_', ''));
}

/**
 * The adapter of a policy when it runs under the default one and nothing else: a kind the default
 * goes around, written as a literal, no `ownPolicy(...)`, no limit of its own, bound once and
 * without condition, and a class the text shows.
 */
function outerOf(policy: AdapterPolicy, reading: Reading): Outer[] {
  const { className } = policy;

  if (className === undefined || !isLeftToTheDefault(policy) || !isBoundOnce(className, 'className', reading)) {
    return [];
  }

  const file = fileOf(className, policy.source, reading.sources);
  const shape = file === undefined ? undefined : classNamed(file, className);

  return file === undefined || shape === undefined ? [] : [{ policy, className, file, shape }];
}

function isLeftToTheDefault(policy: AdapterPolicy): boolean {
  const chosen = policy.ownPolicy || policy.timeouts.length > 0 || !policy.readable;

  return !chosen && policy.kindKnown && DEFAULTED_KINDS.includes(policy.kind ?? '');
}

/** Whether one binding, without condition, names the port or the class, and no `rebind(...)` names it. */
function isBoundOnce(name: string, by: 'port' | 'className', { policies, rebound }: Reading): boolean {
  const naming = policies.filter((policy) => policy[by] === name);
  const named = new RegExp(String.raw`(?<![\w$.])${escapeRegExp(name)}(?![\w$])`);

  return (
    naming.length === 1 &&
    naming.every(({ conditional }) => !conditional) &&
    !rebound.some((chain) => named.test(chain))
  );
}

/**
 * The file of the class a policy names: the one that states the policy, else the one that file
 * imports the name from, else the only file of the sources that declares a class of that name.
 */
function fileOf(className: string, source: SourceFile, sources: readonly SourceFile[]): SourceFile | undefined {
  const imported = importedFrom(source, className)?.target;
  const declaring = sources.filter((file) => classNamed(file, className) !== undefined);

  return (
    declaring.find((candidate) => candidate === source) ??
    declaring.find((candidate) => imported?.kind === 'file' && candidate.path === imported.path) ??
    (declaring.length === 1 ? declaring[0] : undefined)
  );
}

function classNamed(file: SourceFile, name: string): ClassShape | undefined {
  return file.scan.code.includes(name)
    ? file.structure.classes.find((shape) => shape.depth === 0 && shape.name === name)
    : undefined;
}

function cutShort(outer: Outer, reading: Reading): Finding[] {
  const { defaultMs } = reading;

  if (defaultMs === undefined) {
    return [];
  }

  return injectedOf(outer.shape).flatMap((port) => {
    const inner = servingOf(port, outer, reading);
    const stated = inner === undefined ? undefined : statedLimit(inner);

    return inner?.className === undefined || stated === undefined || stated <= defaultMs
      ? []
      : [finding(outer, { port, inner: inner.className }, { defaultMs, stated })];
  });
}

/** The classes that type the constructor parameters of an adapter: what the container gives it. */
function injectedOf(shape: ClassShape): string[] {
  const parameters = shape.methods.find((method) => method.isConstructor)?.parameters ?? [];

  return parameters.flatMap((parameter) => rawClassName(parameterShape(parameter).type ?? '') ?? []);
}

/** The one binding of a port the outer adapter is given, when the two files name the same port. */
function servingOf(port: string, outer: Outer, reading: Reading): AdapterPolicy | undefined {
  const inner = reading.policies.find((policy) => policy.port === port);

  return inner !== undefined &&
    inner.className !== outer.className &&
    isBoundOnce(port, 'port', reading) &&
    isSamePort(port, { given: outer.file, served: inner.source }, reading.sources)
    ? inner
    : undefined;
}

/**
 * Two files that name a port name the same one when a single class of the sources has that name
 * at most, or when each shows the file that declares it and it is one file. With several ports
 * of one name, a file that reaches its own through a barrel, a package or no import is not judged.
 */
function isSamePort(
  port: string,
  { given, served }: { given: SourceFile; served: SourceFile },
  sources: readonly SourceFile[],
): boolean {
  if (sources.filter((file) => classNamed(file, port) !== undefined).length <= 1) {
    return true;
  }

  const givenFrom = originOf(port, given, sources);

  return givenFrom !== undefined && givenFrom === originOf(port, served, sources);
}

/** The file that declares the class `name` as `file` reads it: itself or the one it imports it from; undefined through a barrel or a package. */
function originOf(name: string, file: SourceFile, sources: readonly SourceFile[]): string | undefined {
  if (classNamed(file, name) !== undefined) {
    return file.path;
  }

  const target = importedFrom(file, name)?.target;
  const declaring = target?.kind === 'file' ? sources.find(({ path }) => path === target.path) : undefined;

  return declaring !== undefined && classNamed(declaring, name) !== undefined ? declaring.path : undefined;
}

/**
 * The limit the adapter behind a port states around all its methods: the shortest `timeout(<ms>)`
 * of its declaration or binding, when the default policy does not go around it as well.
 * Undefined when it states none, or one the text does not show. A `@Timeout` on one of its
 * methods is not counted: the text does not say which method is called.
 */
function statedLimit(policy: AdapterPolicy): number | undefined {
  const besideTheDefault = !policy.ownPolicy && !(policy.kindKnown && !DEFAULTED_KINDS.includes(policy.kind ?? ''));

  return !policy.readable || besideTheDefault || policy.timeouts.length === 0
    ? undefined
    : Math.min(...policy.timeouts);
}

function finding(
  { className, shape }: Outer,
  { port, inner }: { port: string; inner: string },
  { defaultMs, stated }: { defaultMs: number; stated: number },
): Finding {
  return {
    line: shape.line,
    message: `${className} is left to the default policy of the platform, which cuts each attempt after ${defaultMs} ms, and is given ${port}, which ${inner} serves with a limit of ${stated} ms: a call ${inner} would still answer fails in ${className} first, as a timeout of ${className}.`,
    fix: `State the policy of ${className} where it is declared or bound: \`ownPolicy(timeout(${stated}))\`, or any limit it chooses; or \`ownPolicy()\` alone when it only hands the call over, ${inner} carrying the policy.`,
  };
}
