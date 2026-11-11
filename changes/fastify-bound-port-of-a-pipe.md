**A project generated on Fastify compiles again with Fastify 5.12.8.** That version types `app.addresses()` as addresses or pipe paths, and `src/platform/http/start-http-server.ts` read `.port` of the first one, so `tsc` refused a new project (`Property 'port' does not exist on type 'string | AddressInfo'`). The file now reads the port through a function that answers 0 for a server bound to a pipe.

To move: in a project already generated on Fastify, replace the last lines of `startHttpServer` in `src/platform/http/start-http-server.ts` with `return { port: boundPort(app.addresses()), close: () => app.close() };` and add below it

```ts
function boundPort(addresses: readonly unknown[]): number {
  const [address] = addresses;
  const port: unknown = typeof address === 'object' && address !== null && 'port' in address ? address.port : 0;

  return typeof port === 'number' ? port : 0;
}
```
