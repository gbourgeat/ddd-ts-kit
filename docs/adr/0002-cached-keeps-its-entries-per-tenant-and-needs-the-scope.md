**English** · [Français](0002-cached-keeps-its-entries-per-tenant-and-needs-the-scope.fr.md)

# ADR-0002: `cached` keeps its entries per tenant and needs the scope

## Decision

The `cached` aspect and the `Cached` decorator of `@ddd-ts-kit/aspects` file an entry under the tenant of the work in progress. The tenant is read from `scope`, the `ExecutionScope` that `installAspectRuntime` is given (`packages/aspects/src/cached/cached.ts`, `packages/aspects/src/runtime/tenant-scope-of-work.ts`):

- Work that names a tenant has its own entries, filed as `tenantCacheKey` does. Work under a scope that names no tenant keeps the key as written.
- A runtime without `scope` is refused: `scopeOr` throws an `AspectRuntimeError` that names `installAspectRuntime({ scope })` and `shared: true` (`packages/aspects/src/runtime/scope-or.ts`). The error comes at the call, not at the wiring.
- `shared: true` keeps one entry for every tenant, for an answer that depends on no tenant. It does not read the scope.
- Work under an elevation (`acrossTenants`) neither reads nor writes the cache and runs the call (`isElevatedWork` in `packages/aspects/src/runtime/is-elevated-work.ts`), since its answer may reach beyond one tenant.

A generated composition root gives the scope to `installAspectRuntime`. The entry of the change is `changes/cached-keeps-its-entries-per-tenant.md` (see `CHANGELOG.md`).

## Why

A cache key built from the arguments of a call does not hold the tenant, so two tenants asking for the same identifier would share one answer. The whole value of the cache is that it answers without asking the source again, which means nothing downstream checks that the answer belongs to the caller.

When the scope is missing, the aspect cannot tell the tenant of the work. Two ways out were open: fall back on the key as written, or refuse. A fall back looks like a working cache and is the leak itself, silent, found by a reader of another tenant's data. A refusal costs one error at the first call, which names its two ways out. Failing closed turns a data exposure into a configuration error that shows in the first test that runs the call.

An elevation is not cached at all because an answer written under it may hold what several tenants own, and no tenant key describes it.

## What it costs

- A project that built its composition root by hand adds `scope` to `installAspectRuntime`, or `cached` refuses at the call. A read meant for every tenant says `shared: true`.
- The entries of a cache already in place are read cold once, since the key changed.
- A shared read under an elevation is only seen as elevated when the runtime has the scope; without it the call is not told apart.

## What would reverse it

An answer that carries its tenant by construction (a key type that cannot be built without one) would make the scope check redundant, and the refusal could go. A need for cached answers across tenants as the default would be a reason to flip `shared`, not to drop the refusal.
