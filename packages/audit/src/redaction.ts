import { createHmac } from 'node:crypto';
import type { Message, MessageType } from '@ddd-ts-kit/kernel';
import { canonicalize } from './canonical.js';
import type { AuditChange, AuditChanges, AuditResource, AuditScalar } from './entry.js';

/** A declared field whose value is stored as a keyed hash: for personal data. */
export interface MaskedField<Name extends string = string> {
  readonly field: Name;
  readonly masked: true;
}

export function masked<Name extends string>(field: Name): MaskedField<Name> {
  return { field, masked: true };
}

export type AuditedField<Name extends string = string> = Name | MaskedField<Name>;

/**
 * What a projector chooses to keep of its subject: values in the clear, values to mask, and
 * nothing else. A value that is not a string, a number, a boolean, `null`, a bigint or a date
 * is left out: an object is never stored whole.
 */
export interface AuditProjection {
  readonly plain?: Readonly<Record<string, unknown>>;
  readonly masked?: Readonly<Record<string, unknown>>;
  readonly resource?: AuditResource;
  readonly context?: string;
}

export interface AuditedFieldsOptions<M> {
  /** The element the message is about. */
  readonly resource?: (message: M) => AuditResource;
  /** Name of the bounded context the message belongs to. */
  readonly context?: string;
}

/** The declaration of one command or query, read by `auditMiddleware`. */
export interface AuditedMessage {
  readonly type: MessageType<Message>;
  readonly masks: boolean;
  project(message: Message): AuditProjection;
}

/**
 * Declares, next to the use case and without touching it, which fields of a command or query
 * go into its audit entry: `auditedFields(RescheduleCommand, ['status', masked('patientEmail')])`.
 * A field that is not listed is never recorded.
 */
export function auditedFields<M extends Message>(
  type: MessageType<M>,
  fields: readonly AuditedField<keyof M & string>[],
  options: AuditedFieldsOptions<M> = {},
): AuditedMessage {
  const plain = fields.filter((field) => typeof field === 'string');
  const toMask = fields.filter((field) => typeof field !== 'string').map(({ field }) => field);
  return {
    type,
    masks: toMask.length > 0,
    project: (message) => (message instanceof type ? projectionOf(message, { plain, toMask }, options) : {}),
  };
}

/**
 * The same declaration for a message whose audited values are not its own fields: the
 * projector picks them, and names the ones to mask.
 * `auditedProjection(ExportCommand, (command) => ({ plain: { format: command.options.format } }))`.
 */
export function auditedProjection<M extends Message>(
  type: MessageType<M>,
  project: (message: M) => AuditProjection,
): AuditedMessage {
  return { type, masks: false, project: (message) => (message instanceof type ? project(message) : {}) };
}

interface DeclaredFields<M> {
  readonly plain: readonly (keyof M & string)[];
  readonly toMask: readonly (keyof M & string)[];
}

function projectionOf<M>(message: M, fields: DeclaredFields<M>, options: AuditedFieldsOptions<M>): AuditProjection {
  const resource = options.resource?.(message);
  return {
    plain: Object.fromEntries(fields.plain.map((field) => [field, message[field]])),
    masked: Object.fromEntries(fields.toMask.map((field) => [field, message[field]])),
    ...(resource === undefined ? {} : { resource }),
    ...(options.context === undefined ? {} : { context: options.context }),
  };
}

/** What a masker may read to choose its key: identifiers of the entry being written. */
export interface MaskingSubject {
  readonly field: string;
  readonly actorId: string;
  readonly tenantId?: string;
  readonly resource?: AuditResource;
}

/** Turns a value into a token that is equal for equal values and says nothing else. */
export interface AuditMasker {
  mask(value: AuditScalar, subject: MaskingSubject): string | Promise<string>;
}

export interface HmacMaskerOptions {
  /** Written before the hash (`<keyId>:<hex>`), so that a rotated key can be told apart. */
  readonly keyId?: string;
}

/**
 * HMAC-SHA-256 of the canonical form of the value, under one secret. Without the secret a
 * mask cannot be computed again, so a guess cannot be checked: destroying the secret makes
 * every mask it produced meaningless.
 */
export function hmacMasker(secret: string | Uint8Array, options: HmacMaskerOptions = {}): AuditMasker {
  const prefix = options.keyId === undefined ? '' : `${options.keyId}:`;
  return {
    mask: (value) => `${prefix}${createHmac('sha256', secret).update(canonicalize(value), 'utf8').digest('hex')}`,
  };
}

/** A projection asks for a mask and no masker was given: a wiring mistake. */
export class MissingMaskerError extends Error {
  constructor(field: string) {
    super(`The audited field "${field}" is declared masked and no masker was given`);
    this.name = 'MissingMaskerError';
  }
}

export interface Redaction {
  readonly masker?: AuditMasker;
  readonly subject: Omit<MaskingSubject, 'field'>;
}

/** The `changes` of an entry, or `undefined` when the projection kept nothing. */
export async function changesOf(projection: AuditProjection, redaction: Redaction): Promise<AuditChanges | undefined> {
  const changes: Record<string, AuditChange> = {};
  for (const [field, value] of Object.entries(projection.plain ?? {})) {
    const scalar = scalarOf(value);
    if (scalar !== undefined) changes[field] = scalar;
  }
  for (const [field, value] of Object.entries(projection.masked ?? {})) {
    const scalar = scalarOf(value);
    if (scalar !== undefined) changes[field] = await maskOf(scalar, field, redaction);
  }
  return Object.keys(changes).length === 0 ? undefined : changes;
}

function scalarOf(value: unknown): AuditScalar | undefined {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'bigint') return value.toString();
  return value instanceof Date ? value.toISOString() : undefined;
}

async function maskOf(value: AuditScalar, field: string, { masker, subject }: Redaction): Promise<AuditChange> {
  if (masker === undefined) throw new MissingMaskerError(field);
  return { masked: await masker.mask(value, { ...subject, field }) };
}
