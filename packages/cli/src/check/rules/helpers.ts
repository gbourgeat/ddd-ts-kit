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

export const KEBAB_SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
