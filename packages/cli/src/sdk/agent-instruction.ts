/** What the CLAUDE.md of a project with clients tells its agents, at `init --sdk` and when `ddd-ts-kit sdk` asks for them later. */
export const AGENT_INSTRUCTION =
  'Never edit the clients under `clients/`, except the version and your own keys in their `package.json`: `npm run docs:generate` (`npx ddd-ts-kit sdk`) rewrites them from the contract, `docs:check` fails while they differ from it. A spec or a script calls the API through a client by its package name, which the command resolves to its sources under `paths` in `tsconfig.json`.';
