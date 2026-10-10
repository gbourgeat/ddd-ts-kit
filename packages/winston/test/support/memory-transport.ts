import winston from 'winston';
import { MemorySink } from './memory-sink.js';

/** A winston stream transport over a sink kept in memory. */
export function memoryTransport(sink: MemorySink): winston.transport {
  return new winston.transports.Stream({ stream: sink.stream });
}
