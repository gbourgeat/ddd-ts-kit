import { type LuaApi, LuaType } from 'wasmoon-lua5.1';

type State = number;

/**
 * The `cjson` Redis embeds in its scripts, as C functions on the Lua state: `decode` gives objects
 * and arrays as tables and `null` as the light userdata `NULL` (`cjson.null`), `encode` writes a
 * table whose keys run from 1 to n as an array and any other as an object.
 */
export class Cjson {
  constructor(private readonly api: LuaApi) {}

  encode(L: State): number {
    const json = jsonOf(this.valueOf(L, 1));

    this.api.lua_pushstring(L, json);

    return 1;
  }

  decode(L: State): number {
    const text = this.api.lua_tolstring(L, 1, null);
    let value: unknown;

    try {
      value = JSON.parse(text);
    } catch {
      return this.raiseText(L, `Expected value but found invalid token at character 1`);
    }

    this.pushJson(L, value);

    return 1;
  }

  private raiseText(L: State, text: string): number {
    this.api.lua_pushstring(L, text);

    return this.api.lua_error(L);
  }

  /** A Lua value read for `cjson.encode`: tables as arrays when their keys are 1 to n, objects otherwise. */
  private valueOf(L: State, position: number): Json {
    const { api } = this;

    switch (api.lua_type(L, position)) {
      case LuaType.String:
        return api.lua_tolstring(L, position, null);
      case LuaType.Number:
        return api.lua_tonumber(L, position);
      case LuaType.Boolean:
        return api.lua_toboolean(L, position) === 1;
      case LuaType.Table:
        return this.tableOf(L, position);
      default:
        return null;
    }
  }

  private tableOf(L: State, position: number): Json {
    const { api } = this;
    const entries: [string | number, Json][] = [];

    api.lua_pushnil(L);

    while (api.lua_next(L, position) !== 0) {
      const key = api.lua_type(L, -2) === LuaType.Number ? api.lua_tonumber(L, -2) : api.lua_tolstring(L, -2, null);

      entries.push([key, this.valueOf(L, api.lua_gettop(L))]);
      api.lua_settop(L, -2);
    }

    const isArray =
      entries.length > 0 &&
      entries.every(([key]) => typeof key === 'number' && Number.isInteger(key) && key >= 1 && key <= entries.length);

    if (isArray) {
      return [...entries].sort(([left], [right]) => Number(left) - Number(right)).map(([, value]) => value);
    }

    return Object.fromEntries(entries.map(([key, value]) => [String(key), value]));
  }

  private pushJson(L: State, value: unknown): void {
    const { api } = this;

    if (value === null) {
      api.lua_pushlightuserdata(L, 0);
    } else if (typeof value === 'string') {
      api.lua_pushstring(L, value);
    } else if (typeof value === 'number') {
      api.lua_pushnumber(L, value);
    } else if (typeof value === 'boolean') {
      api.lua_pushboolean(L, value ? 1 : 0);
    } else if (Array.isArray(value)) {
      api.lua_createtable(L, value.length, 0);

      for (const [index, item] of value.entries()) {
        this.pushJson(L, item);
        api.lua_rawseti(L, -2, index + 1);
      }
    } else if (typeof value === 'object') {
      const entries = Object.entries(value);

      api.lua_createtable(L, 0, entries.length);

      for (const [key, item] of entries) {
        this.pushJson(L, item);
        api.lua_setfield(L, -2, key);
      }
    }
  }
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** JSON as `cjson.encode` writes it: numbers in `%.14g`, `/` escaped, an empty table an object. */
function jsonOf(value: Json): string {
  if (value === null || typeof value === 'boolean') {
    return String(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? general14(value) : 'null';
  }

  if (typeof value === 'string') {
    return JSON.stringify(value).replaceAll('/', '\\/');
  }

  if (Array.isArray(value)) {
    return `[${value.map(jsonOf).join(',')}]`;
  }

  return `{${Object.entries(value)
    .map(([key, item]) => `${jsonOf(key)}:${jsonOf(item)}`)
    .join(',')}}`;
}

/** `%.14g`: fourteen significant digits, the exponent form beyond them, no trailing zero. */
function general14(value: number): string {
  if (value === 0) {
    return '0';
  }

  const exponent = Math.floor(Math.log10(Math.abs(value)));

  if (exponent < -4 || exponent >= 14) {
    const [mantissa = '', power = ''] = value.toExponential(13).split('e');
    const digits = mantissa.replace(/\.?0+$/, '');
    const sign = power.startsWith('-') ? '-' : '+';
    const magnitude = power.replace(/^[-+]/, '').padStart(2, '0');

    return `${digits}e${sign}${magnitude}`;
  }

  return String(Number(value.toPrecision(14)));
}
