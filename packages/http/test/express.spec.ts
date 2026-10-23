import type { AddressInfo } from 'node:net';
import express, { type Request } from 'express';
import { mountExpress } from '../src/express';
import { describeAdapter } from './support/behaviour';

describeAdapter(
  'Express',
  async (routes, options) => {
    const app = express();

    app.use(express.json());
    // Mounted on a router to prove a router is as good a target as the application.
    const router = express.Router();

    mountExpress(router, routes, options);
    app.use(router);
    const server = app.listen(0);

    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address() as AddressInfo;

    return {
      url: `http://127.0.0.1:${port}`,
      close: () => new Promise<void>((resolve) => server.close(() => resolve())),
    };
  },
  (raw) => (raw as Request).headers.authorization,
);
