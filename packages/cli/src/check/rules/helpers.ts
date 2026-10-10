import type { ImportTarget, Layer, Location, Project, SourceFile, Violation } from '../types.js';

/** Where a violation is reported: a file of the project and a 1-based line. */
interface Place {
  readonly file: string;
  readonly line: number;
}

export type Report = (at: Place, message: string, fix: string) => Violation;

export function reporter(project: Project, ruleId: string): Report {
  const severity = project.severity(ruleId) === 'warn' ? 'warn' : 'error';
  return ({ file, line }, message, fix) => ({ ruleId, severity, file, line, message, fix });
}

/** What a rule found in one file, before it is given a rule id and a severity. */
export interface Finding {
  readonly line: number;
  readonly message: string;
  readonly fix: string;
}

export function toViolations(report: Report, file: string, findings: readonly Finding[]): Violation[] {
  return findings.map(({ line, message, fix }) => report({ file, line }, message, fix));
}

export type ContextLocation = Extract<Location, { area: 'context' }>;

export function inContext(location: Location): location is ContextLocation {
  return location.area === 'context';
}

export function inLayer(file: SourceFile, layer: Layer): ContextLocation | undefined {
  return inContext(file.location) && file.location.layer === layer && !file.isTest ? file.location : undefined;
}

export function describeTarget(target: ImportTarget): string {
  if (target.kind !== 'file') return `"${target.name}"`;
  const { location } = target;
  if (location.area === 'context') return `${location.context}/${location.layer === 'module' ? 'module file' : location.layer}`;
  return location.area === 'other' ? target.path : location.area;
}

/** 1-based line of the first occurrence of `needle` in `text`, or 1. */
export function lineOf(text: string, needle: string): number {
  const at = text.indexOf(needle);
  return at === -1 ? 1 : text.slice(0, at).split('\n').length;
}

/** 1-based line where the last of `needles` is found, each searched after the previous one; 1 when the first is absent. */
export function lineOfSequence(text: string, needles: readonly string[]): number {
  let at = 0;
  for (const needle of needles) {
    const found = text.indexOf(needle, at);
    if (found === -1) break;
    at = found;
  }
  return text.slice(0, at).split('\n').length;
}

/** A source of the production code of a context, in one of the given layers. */
export function inLayers(file: SourceFile, layers: readonly Layer[]): ContextLocation | undefined {
  return layers.map((layer) => inLayer(file, layer)).find((location) => location !== undefined);
}

/** True when the classes of the project say what they are with decorators, false when module files bind them. */
export function isDeclaredStyle(project: Project): boolean {
  return project.config.stack.style === 'declared';
}

/** The path of a source relative to its context, the way the role table names files; undefined outside a context. */
export function pathInContext(project: Project, file: SourceFile): string | undefined {
  if (!inContext(file.location)) return undefined;
  return file.path.slice(`${project.config.contextsDir}/${file.location.context}/`.length);
}

/** Where a binding is written, for a fix text: the declaration of the class, or the module file of the context. */
export function bindingPlace(project: Project, context: string): string {
  return isDeclaredStyle(project) ? 'its declaration (@Repository, @Gateway or @Adapter on the class)' : `${context}.module.ts`;
}

export const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
