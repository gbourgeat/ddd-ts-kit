import type { Json } from './json.js';
import type { Stream } from './stream.js';

const TYPE = 'io.nats.jetstream.api.v1';

/** An error of the JetStream API: `code` is the HTTP-like status, `err_code` what the client reads. */
export function apiError(kind: string, code: number, errCode: number, description: string): Json {
  return { type: `${TYPE}.${kind}_response`, error: { code, err_code: errCode, description } };
}

export const streamNotFound = (kind: string): Json => apiError(kind, 404, 10_059, 'stream not found');

export const consumerNotFound = (kind: string): Json => apiError(kind, 404, 10_014, 'consumer not found');

export function success(kind: string): Json {
  return { type: `${TYPE}.${kind}_response`, success: true };
}

export function accountInfo(streams: number, consumers: number): Json {
  return {
    type: `${TYPE}.account_info_response`,
    memory: 0,
    storage: 0,
    reserved_memory: 0,
    reserved_storage: 0,
    streams,
    consumers,
    limits: {
      max_memory: -1,
      max_storage: -1,
      max_streams: -1,
      max_consumers: -1,
      max_ack_pending: -1,
      memory_max_stream_bytes: -1,
      storage_max_stream_bytes: -1,
      max_bytes_required: false,
    },
    api: { level: 5, total: 0, errors: 0 },
  };
}

export function streamInfo(kind: string, stream: Stream): Json {
  return {
    type: `${TYPE}.${kind}_response`,
    config: stream.config,
    created: stream.created.toISOString(),
    state: stream.state(),
    ts: new Date().toISOString(),
  };
}

/** The configuration of a stream as the server keeps it: what was asked over its defaults. */
export function streamConfigOf(requested: Json): Json {
  return {
    retention: 'limits',
    max_consumers: -1,
    max_msgs: -1,
    max_bytes: -1,
    max_age: 0,
    max_msgs_per_subject: -1,
    max_msg_size: -1,
    discard: 'old',
    storage: 'file',
    num_replicas: 1,
    duplicate_window: 120_000_000_000,
    compression: 'none',
    allow_direct: false,
    mirror_direct: false,
    sealed: false,
    deny_delete: false,
    deny_purge: false,
    allow_rollup_hdrs: false,
    consumer_limits: {},
    allow_msg_ttl: false,
    ...requested,
  };
}

/** The configuration of a consumer as the server keeps it: what was asked over its defaults. */
export function consumerConfigOf(name: string, requested: Json): Json {
  return {
    name,
    deliver_policy: 'all',
    ack_policy: 'explicit',
    ack_wait: 30_000_000_000,
    max_deliver: -1,
    replay_policy: 'instant',
    max_waiting: 512,
    max_ack_pending: 1000,
    num_replicas: 0,
    ...requested,
  };
}
