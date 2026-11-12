import { parameterShape } from '../../declared/injection/parameter-shape';
import { rawClassName } from '../../declared/injection/raw-class-name';
import { adapterPolicies } from '../aspects/adapter-policies';
import type { AdapterPolicy } from '../aspects/adapter-policy';
import { statedTimeouts } from '../aspects/stated-timeouts';
import type { Finding } from '../model/finding';
import type { Rule } from '../model/rule';
import type { SourceFile } from '../model/source-file';
import type { ClassShape } from '../structure/class-shape';
import { importedFrom } from '../support/imported-from';
import { perFile } from '../support/per-file';

/** The kinds the default policy of the platform goes around (`resilience/default-policy.ts`). */
const DEFAULTED_KINDS = ['external', 'gateway'];
const DEFAULT_SETTINGS = '/resilience/default-resilience-settings.ts';
const DEFAULT_TIMEOUT = /(?<![\w$.])timeoutMs\s*:\s*(\d[\d_]*)\s*[,}]/;
/** The variable the configuration of the platform reads the default limit from, and the fallback written beside it. */
const DEFAULT_VARIABLE = 'OUTBOUND_TIMEOUT_MS';
const FALLBACK = /^\s*,\s*\{[^{}]*?(?<![\w$.])fallback\s*:\s*(\d[\d_]*)\s*[,}]/;

interface Adapter {
  readonly policy: AdapterPolicy;
  readonly file: SourceFile;
  readonly shape: ClassShape;
}

/** A time limit, and who states it. */
interface Limit {
  readonly ms: number;
  readonly statedBy: string;
}

/**
 * The limit of the default policy of the platform: its milliseconds, `none` in a project without
 * the default settings, `unreadable` when they are not written as one number.
 */
type DefaultLimit = number | 'none' | 'unreadable';

export const aspectsTimeoutCoversDelegate: Rule = {
  id: 'aspects/timeout-covers-delegate',
  description:
    'An adapter that is given a port (a constructor parameter typed by it) is not cut before the adapter bound to that port: the time limit around all its methods, the `timeout(<ms>)` of its declaration or binding and, for an `external` or `gateway` adapter that states no `ownPolicy(...)`, the default of the platform (the fallback of `OUTBOUND_TIMEOUT_MS` in its configuration, else `timeoutMs` of `resilience/default-resilience-settings.ts`), is at least the limit the adapter behind the port states for itself, its `@Timeout` included. Read from the declarations (`@Adapter`, `@Gateway`) and the bindings of the container of the kit, where the durations are written as numbers.',
  scope: 'project',
  run(project) {
    const sources = project.files.filter((file) => !file.isTest);
    const adapters = adapterPolicies(project).flatMap((policy) => located(policy, sources));
    const fallback = adapters.length === 0 ? 'none' : defaultLimit(sources);

    return perFile(project, this.id, (file) =>
      unique(
        adapters
          .filter((outer) => outer.file === file)
          .flatMap((outer) => cutShort(outer, servingOf(outer, adapters, sources), fallback)),
      ),
    );
  },
};

/**
 * A stated policy with the class it governs: the one of the file that states it, else of the
 * file that one imports the name from, else the only class of that name in the sources.
 */
function located(policy: AdapterPolicy, sources: readonly SourceFile[]): Adapter[] {
  const imported = importedFrom(policy.source, policy.className)?.target;
  const declaring = sources.filter((file) => classNamed(file, policy.className) !== undefined);

  const file =
    declaring.find((candidate) => candidate === policy.source) ??
    declaring.find((candidate) => imported?.kind === 'file' && candidate.path === imported.path) ??
    (declaring.length === 1 ? declaring[0] : undefined);

  const shape = file === undefined ? undefined : classNamed(file, policy.className);

  return file === undefined || shape === undefined ? [] : [{ policy, file, shape }];
}

function classNamed(file: SourceFile, name: string): ClassShape | undefined {
  return file.scan.code.includes(name)
    ? file.structure.classes.find((shape) => shape.depth === 0 && shape.name === name)
    : undefined;
}

/**
 * What the default policy cuts an attempt at. `main.ts` gives it the validated configuration, so
 * the fallback written beside `OUTBOUND_TIMEOUT_MS` in the platform counts first; a platform that
 * does not read that variable runs with `timeoutMs` of the default settings.
 */
function defaultLimit(sources: readonly SourceFile[]): DefaultLimit {
  const platform = sources.filter(({ location }) => location.area === 'platform');
  const settings = platform.find(({ path }) => path.endsWith(DEFAULT_SETTINGS));

  if (settings === undefined) {
    return 'none';
  }

  const configured = platform.flatMap(({ scan }) =>
    scan.strings
      .filter(({ value }) => value === DEFAULT_VARIABLE)
      .map(({ end }) => FALLBACK.exec(scan.code.slice(end))?.[1]),
  );

  const written = new Set(configured.length > 0 ? configured : [DEFAULT_TIMEOUT.exec(settings.scan.code)?.[1]]);
  const [only] = written;

  return written.size === 1 && only !== undefined ? Number(only.replaceAll('_', '')) : 'unreadable';
}

/** The adapters bound to a port the constructor of `outer` is given, each with that port. */
function servingOf(
  outer: Adapter,
  adapters: readonly Adapter[],
  sources: readonly SourceFile[],
): { port: string; inner: Adapter }[] {
  return injectedOf(outer.shape).flatMap((port) =>
    adapters
      .filter(
        (inner) =>
          inner.policy.port === port &&
          inner.policy.className !== outer.policy.className &&
          isSamePort(port, { given: outer.file, served: inner.policy.source }, sources),
      )
      .map((inner) => ({ port, inner })),
  );
}

/** The classes that type the constructor parameters of an adapter: what the container gives it. */
function injectedOf(shape: ClassShape): string[] {
  const parameters = shape.methods.find((method) => method.isConstructor)?.parameters ?? [];

  return parameters.flatMap((parameter) => rawClassName(parameterShape(parameter).type ?? '') ?? []);
}

/**
 * Two files that name a port name the same one unless each shows the file that declares it and
 * the two differ: two contexts may each have a port of one name.
 */
function isSamePort(
  port: string,
  { given, served }: { given: SourceFile; served: SourceFile },
  sources: readonly SourceFile[],
): boolean {
  const givenFrom = originOf(port, given, sources);
  const servedFrom = originOf(port, served, sources);

  return givenFrom === undefined || servedFrom === undefined || givenFrom === servedFrom;
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

function cutShort(
  outer: Adapter,
  serving: readonly { port: string; inner: Adapter }[],
  fallback: DefaultLimit,
): Finding[] {
  const ceiling = ceilingOf(outer, fallback);

  return serving.flatMap(({ port, inner }) => {
    const floor = floorOf(inner, fallback);

    return ceiling === undefined || floor === undefined || ceiling.ms >= floor.ms
      ? []
      : [finding({ outer, port, inner: inner.policy.className }, { ceiling, floor })];
  });
}

/**
 * The longest one attempt of the adapter may last: the shortest limit around all its methods.
 * Undefined when nothing goes around them all or when a duration is not a number the text shows.
 * A `@Timeout` on one of its methods is not counted: the text does not say which method calls the port.
 */
function ceilingOf({ policy }: Adapter, fallback: DefaultLimit): Limit | undefined {
  return shortest(aroundOf(policy, fallback) ?? []);
}

/**
 * The shortest limit the adapter behind a port states for itself, around its methods or on one of
 * them; undefined when it states none, or one the text does not show.
 */
function floorOf({ policy, file, shape }: Adapter, fallback: DefaultLimit): Limit | undefined {
  const methods = statedTimeouts(file.scan.code.slice(shape.bodyStart, shape.end), '@Timeout');
  const around = aroundOf(policy, fallback);

  if (around === undefined || !methods.readable || policy.timeouts.length + methods.timeouts.length === 0) {
    return undefined;
  }

  return shortest([...around, ...methods.timeouts.map((ms) => ({ ms, statedBy: 'its `@Timeout`' }))]);
}

/**
 * The limits around every method of an adapter: those its declaration or binding states, and the
 * default one of its kind when it states no policy of its own. Undefined when the text does not show them.
 */
function aroundOf(policy: AdapterPolicy, fallback: DefaultLimit): Limit[] | undefined {
  if (!policy.readable) {
    return undefined;
  }

  const own = policy.timeouts.map((ms) => ({ ms, statedBy: 'its own policy' }));
  const kind = policy.kind ?? '';

  if (policy.ownPolicy || fallback === 'none' || !DEFAULTED_KINDS.includes(kind)) {
    return own;
  }

  return fallback === 'unreadable'
    ? undefined
    : [...own, { ms: fallback, statedBy: `the default policy of the ${kind} adapters, which it never chose` }];
}

function shortest(limits: readonly Limit[]): Limit | undefined {
  return [...limits].sort((left, right) => left.ms - right.ms)[0];
}

function finding(
  { outer, port, inner }: { outer: Adapter; port: string; inner: string },
  { ceiling, floor }: { ceiling: Limit; floor: Limit },
): Finding {
  const name = outer.policy.className;

  return {
    line: outer.shape.line,
    message: `${name} is cut after ${ceiling.ms} ms (${ceiling.statedBy}) and is given ${port}, which ${inner} serves with a limit of ${floor.ms} ms: a call ${inner} would still answer fails in ${name} first, as a timeout of ${name}.`,
    fix: `State the policy of ${name} where it is declared or bound, at least as long as the adapter it calls: \`ownPolicy(timeout(${floor.ms}))\`; or \`ownPolicy()\` alone when it only hands the call over, ${inner} carrying the policy.`,
  };
}

function unique(findings: readonly Finding[]): Finding[] {
  return findings.filter(
    (candidate, index) => findings.findIndex((other) => other.message === candidate.message) === index,
  );
}
