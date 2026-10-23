import { LUA_GLOBALSINDEX, Lua, type LuaApi, LuaType } from 'wasmoon-lua5.1';
import { Cjson } from './cjson';
import type { Context } from './commands/command';
import { CommandError, NIL, type Reply, array, bulk, integer } from './reply';

type State = number;

/**
 * Redis protects the globals of its scripts: one a script creates, or reads without it existing,
 * is an error. `redis.call` raises the error of a refused command, `redis.pcall` answers it as a
 * table; `cjson` is the one Redis embeds, `cjson.null` the light userdata `NULL`.
 */
const PRELUDE = `
redis.error_reply = function(text) return { err = text } end
redis.status_reply = function(text) return { ok = text } end
setmetatable(_G, {
  __newindex = function(_, name) error("Script attempted to create global variable '" .. tostring(name) .. "'", 2) end,
  __index = function(_, name) error("Script attempted to access nonexistent global variable '" .. tostring(name) .. "'", 2) end,
})`;

/**
 * Runs the scripts of `EVAL` on a Lua 5.1 interpreter, the version Redis embeds, compiled to
 * WebAssembly (`wasmoon-lua5.1`). The conversions between the replies of the server and Lua are
 * the ones of Redis, written here against the C API as Redis writes them: an integer is a number,
 * a missing value `false`, a status `{ ok = ... }`, an error `{ err = ... }`, and back, a number
 * an integer (truncated), `true` the integer 1, `false` and `nil` a missing value, a table with
 * `err` or `ok` an error or a status, any other table an array up to its first `nil`. Inside a
 * script the replies are those of RESP2, as in Redis unless the script asks for RESP3.
 */
export class LuaScripts {
  private context: Context | undefined;

  private constructor(
    private readonly lua: Lua,
    private readonly api: LuaApi,
    private readonly state: State,
  ) {
    this.install();
  }

  static async create(): Promise<LuaScripts> {
    const lua = await Lua.create();

    return new LuaScripts(lua, lua.luaApi, lua.global.address);
  }

  /** `EVAL script numkeys key... arg...`, run whole before any other command, as in Redis. */
  eval(args: readonly string[], context: Context): Reply {
    const [body = '', count, ...rest] = args;
    const keyCount = Number(count);

    if (!Number.isInteger(keyCount) || keyCount < 0 || keyCount > rest.length) {
      throw new CommandError("ERR Number of keys can't be greater than number of args");
    }

    const { api, state } = this;

    if (api.luaL_loadstring(state, body) !== 0) {
      const message = this.text(-1);

      api.lua_settop(state, 0);
      throw new CommandError(`ERR Error compiling script (new function): ${message}`);
    }

    this.global('KEYS', rest.slice(0, keyCount));
    this.global('ARGV', rest.slice(keyCount));
    this.context = context;

    try {
      if (api.lua_pcall(state, 0, 1, 0) !== 0) {
        throw new CommandError(this.failureOf(-1));
      }

      return this.replyOf(-1);
    } finally {
      this.context = undefined;
      api.lua_settop(state, 0);
    }
  }

  close(): void {
    this.lua.global.close();
  }

  private install(): void {
    const { api, state } = this;

    api.lua_createtable(state, 0, 4);
    this.field('call', (L) => this.call(L, true));
    this.field('pcall', (L) => this.call(L, false));
    this.rawGlobal('redis');

    const cjson = new Cjson(api);

    api.lua_createtable(state, 0, 3);
    this.field('encode', (L) => cjson.encode(L));
    this.field('decode', (L) => cjson.decode(L));
    api.lua_pushlightuserdata(state, 0);
    api.lua_setfield(state, -2, 'null');
    this.rawGlobal('cjson');

    this.lua.doStringSync(PRELUDE);
  }

  /** `redis.call` and `redis.pcall`: the command runs at once, on the keys of the script. */
  private call(L: State, raising: boolean): number {
    const { api } = this;
    const command: string[] = [];

    for (let index = 1; index <= api.lua_gettop(L); index += 1) {
      const type = api.lua_type(L, index);

      if (type !== LuaType.String && type !== LuaType.Number) {
        return this.raise(L, 'ERR Lua redis lib command arguments must be strings or integers');
      }

      command.push(
        type === LuaType.Number ? numberText(api.lua_tonumber(L, index)) : api.lua_tolstring(L, index, null),
      );
    }

    const reply = this.context?.run(command) ?? { kind: 'error', text: 'ERR no script is running' };

    if (reply.kind === 'error' && raising) {
      return this.raise(L, reply.text);
    }

    this.push(L, reply);

    return 1;
  }

  private raise(L: State, text: string): number {
    this.api.lua_createtable(L, 0, 1);
    this.api.lua_pushstring(L, text);
    this.api.lua_setfield(L, -2, 'err');

    return this.api.lua_error(L);
  }

  /** A reply of the server as Lua sees it, RESP2 conversions. */
  private push(L: State, reply: Reply): void {
    const { api } = this;

    switch (reply.kind) {
      case 'status':
      case 'error':
        api.lua_createtable(L, 0, 1);
        api.lua_pushstring(L, reply.text);
        api.lua_setfield(L, -2, reply.kind === 'status' ? 'ok' : 'err');

        return;
      case 'integer':
        api.lua_pushnumber(L, reply.value);

        return;
      case 'bulk':
      case 'text':
        if (reply.value === null) {
          api.lua_pushboolean(L, 0);
        } else {
          api.lua_pushstring(L, reply.value);
        }

        return;
      case 'array':
      case 'push':
        this.pushList(L, reply.items);

        return;
      case 'map':
        this.pushList(
          L,
          reply.entries.flatMap(([key, value]) => [bulk(key), value]),
        );
    }
  }

  private pushList(L: State, items: readonly Reply[] | null): void {
    if (items === null) {
      this.api.lua_pushboolean(L, 0);

      return;
    }

    this.api.lua_createtable(L, items.length, 0);

    for (const [index, item] of items.entries()) {
      this.push(L, item);
      this.api.lua_rawseti(L, -2, index + 1);
    }
  }

  /** The value a script returned, as the server answers it. */
  private replyOf(index: number): Reply {
    const { api, state } = this;
    const position = index < 0 ? api.lua_gettop(state) + index + 1 : index;

    switch (api.lua_type(state, position)) {
      case LuaType.String:
        return bulk(api.lua_tolstring(state, position, null));
      case LuaType.Number:
        return integer(Math.trunc(api.lua_tonumber(state, position)));
      case LuaType.Boolean:
        return api.lua_toboolean(state, position) === 1 ? integer(1) : NIL;
      case LuaType.Table:
        return this.tableReply(position);
      default:
        return NIL;
    }
  }

  private tableReply(position: number): Reply {
    const { api, state } = this;

    for (const kind of ['err', 'ok'] as const) {
      api.lua_getfield(state, position, kind);
      const found = api.lua_type(state, -1) === LuaType.String ? api.lua_tolstring(state, -1, null) : undefined;

      api.lua_settop(state, -2);

      if (found !== undefined) {
        return kind === 'err' ? { kind: 'error', text: found } : { kind: 'status', text: found };
      }
    }

    const items: Reply[] = [];

    for (let index = 1; ; index += 1) {
      api.lua_rawgeti(state, position, index);

      if (api.lua_type(state, -1) === LuaType.Nil) {
        api.lua_settop(state, -2);

        return array(items);
      }

      items.push(this.replyOf(-1));
      api.lua_settop(state, -2);
    }
  }

  /** The error a script raised: the text of a `{ err = ... }`, else the message of Lua. */
  private failureOf(index: number): string {
    const { api, state } = this;

    if (api.lua_type(state, index) === LuaType.Table) {
      const reply = this.tableReply(api.lua_gettop(state) + index + 1);

      if (reply.kind === 'error') {
        return reply.text;
      }
    }

    return `ERR user_script:${this.text(index)}`;
  }

  private field(name: string, fn: (L: State) => number): void {
    const pointer = this.api.module.addFunction(fn, 'ii');

    this.api.lua_pushcclosure(this.state, pointer, 0);
    this.api.lua_setfield(this.state, -2, name);
  }

  /** Sets a global past the protection of the prelude, as Redis sets KEYS and ARGV. */
  private rawGlobal(name: string): void {
    this.api.lua_pushstring(this.state, name);
    this.api.lua_insert(this.state, -2);
    this.api.lua_rawset(this.state, LUA_GLOBALSINDEX);
  }

  private global(name: string, values: readonly string[]): void {
    this.api.lua_createtable(this.state, values.length, 0);

    for (const [index, value] of values.entries()) {
      this.api.lua_pushstring(this.state, value);
      this.api.lua_rawseti(this.state, -2, index + 1);
    }

    this.rawGlobal(name);
  }

  private text(index: number): string {
    return this.api.lua_tolstring(this.state, index, null);
  }
}

/** A number argument of `redis.call`, as Redis writes it: `%.17g`. */
function numberText(value: number): string {
  return Number.isInteger(value) && Math.abs(value) < 1e17 ? String(value) : String(Number(value.toPrecision(17)));
}
