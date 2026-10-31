import {
  type AuditOutcome,
  type AuditRecord,
  type AuditTrail,
  type BusMiddleware,
  type Message,
  type MessageInfo,
  type MessageType,
  type UnitOfWork,
} from '@ddd-ts-kit/kernel';
import type { AuditMasker } from '../redaction/audit-masker';
import type { AuditedMessage } from '../redaction/audited-message';
import { changesOf } from '../redaction/changes-of';
import { MissingDataSubjectError } from '../redaction/missing-data-subject-error';
import { MissingMaskerError } from '../redaction/missing-masker-error';
import { auditRecordOf } from './audit-record-of';
import type { AuditSource } from './audit-source';
import { failureReason } from './failure-reason';

export interface AuditMiddlewareOptions extends AuditSource {
  /**
   * The unit of work of the commands. Given, the entry of a command that succeeded is written
   * in its transaction and exists only if it commits, and the entry of one that failed is
   * written after the rollback. Install this middleware before `unitOfWorkMiddleware`, which
   * then joins the transaction opened here.
   */
  readonly unitOfWork?: UnitOfWork;

  /** What may go into `changes`, per message. A message without a declaration carries none. */
  readonly fields?: readonly AuditedMessage[];

  /** The queries to record. Default `none`: commands only. */
  readonly queries?: 'none' | 'all' | readonly MessageType<Message>[];

  /** Required as soon as one declaration masks a field. */
  readonly masker?: AuditMasker;

  /**
   * The tenant whose chain receives the entry of a message that succeeded, when the message acts
   * on a tenant other than the one of the work: an identity command on an organisation the token
   * does not name, say. `undefined` keeps the tenant of the work, and so does every entry of a
   * failure: a caller who names a tenant it cannot act in never writes to its chain, nor opens
   * one, as a refusal is recorded in the tenant of the caller's credential.
   */
  readonly tenantOf?: (message: Message) => string | undefined;

  /**
   * Told when the entry of a failure could not be written. The failure of the use case is
   * what the caller receives, never the failure of its audit.
   */
  readonly onLostRecord?: (error: unknown, record: AuditRecord | undefined) => void;
}

/**
 * Records every command, and the queries asked for, with its outcome and the `code` of the
 * domain error as reason. No use case knows: the middleware reads the message, the scope and
 * the declarations of `auditedFields`.
 */
export function auditMiddleware(trail: AuditTrail, options: AuditMiddlewareOptions): BusMiddleware {
  const declarations = new Map<unknown, AuditedMessage>(
    (options.fields ?? []).map((declaration) => [declaration.type, declaration]),
  );

  assertMaskerGiven(options);

  return (message, next, info) => {
    if (!isRecorded(message, info, options)) {
      return next();
    }

    const audit = new MessageAudit(trail, options, {
      message,
      info,
      declaration: declarations.get(message.constructor),
    });

    return audit.around(next);
  };
}

/** A masked field needs a masker, and a masker keyed per data subject needs every masked field to name its subject. */
function assertMaskerGiven(options: AuditMiddlewareOptions): void {
  const masking = options.masker === undefined ? options.fields?.find((declaration) => declaration.masks) : undefined;

  if (masking !== undefined) {
    throw new MissingMaskerError(masking.type.name);
  }

  const subjectless =
    options.masker?.requiresDataSubject === true
      ? options.fields?.flatMap((declaration) => declaration.subjectless ?? [])
      : [];

  if (subjectless !== undefined && subjectless.length > 0) {
    throw new MissingDataSubjectError(subjectless[0] ?? '');
  }
}

function isRecorded(message: Message, info: MessageInfo, { queries = 'none' }: AuditMiddlewareOptions): boolean {
  if (info.kind === 'command') {
    return true;
  }

  return typeof queries === 'string' ? queries === 'all' : queries.some((type) => message instanceof type);
}

interface Sending {
  readonly message: Message;
  readonly info: MessageInfo;
  readonly declaration: AuditedMessage | undefined;
}

class MessageAudit {
  constructor(
    private readonly trail: AuditTrail,
    private readonly options: AuditMiddlewareOptions,
    private readonly sending: Sending,
  ) {}

  around(next: () => Promise<unknown>): Promise<unknown> {
    const { unitOfWork } = this.options;

    if (unitOfWork === undefined || this.sending.info.kind === 'query') {
      return this.afterwards(next);
    }

    return this.orRecordFailure(() => unitOfWork.run(() => this.thenRecordSuccess(next)));
  }

  private async afterwards(next: () => Promise<unknown>): Promise<unknown> {
    const result = await this.orRecordFailure(next);

    await this.record('succeeded');

    return result;
  }

  private async orRecordFailure(work: () => Promise<unknown>): Promise<unknown> {
    try {
      return await work();
    } catch (error) {
      await this.recordFailure(error);

      throw error;
    }
  }

  private async recordFailure(failure: unknown): Promise<void> {
    let record: AuditRecord | undefined;

    try {
      record = await this.recordOf('failed', failureReason(failure));
      await this.trail.record(record);
    } catch (error) {
      this.options.onLostRecord?.(error, record);
    }
  }

  private async thenRecordSuccess(next: () => Promise<unknown>): Promise<unknown> {
    const result = await next();

    await this.record('succeeded');

    return result;
  }

  private async record(outcome: AuditOutcome): Promise<void> {
    await this.trail.record(await this.recordOf(outcome));
  }

  private async recordOf(outcome: AuditOutcome, reason?: string): Promise<AuditRecord> {
    const { message, info, declaration } = this.sending;
    const projection = declaration?.project(message) ?? {};
    const { resource, context } = projection;
    const who = this.options.scope.require();

    const subject = {
      actorId: who.actor.id,
      ...(who.tenantId === undefined ? {} : { tenantId: who.tenantId }),
      ...(resource === undefined ? {} : { resource }),
    };

    const changes = await changesOf(projection, {
      subject,
      ...(this.options.masker === undefined ? {} : { masker: this.options.masker }),
    });

    return this.inTheTenantNamed(
      outcome,
      auditRecordOf(this.options, {
        category: info.kind,
        action: info.name,
        outcome,
        ...(reason === undefined ? {} : { reason }),
        ...(resource === undefined ? {} : { resource }),
        ...(context === undefined ? {} : { context }),
        ...(changes === undefined ? {} : { changes }),
      }),
    );
  }

  /** A message that succeeded is written in the tenant it acts on, when `tenantOf` names one. */
  private inTheTenantNamed(outcome: AuditOutcome, record: AuditRecord): AuditRecord {
    const named = outcome === 'succeeded' ? this.options.tenantOf?.(this.sending.message) : undefined;

    return named === undefined ? record : { ...record, tenantId: named };
  }
}
