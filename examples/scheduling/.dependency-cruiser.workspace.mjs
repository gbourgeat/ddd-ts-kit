// The generated rules name packages by their place under `node_modules`. In this repository the
// example is a workspace next to the kit's packages, which the package manager links instead of
// copying: without `preserveSymlinks`, an import of `@ddd-ts-kit/auth` is seen as a file of
// `../../packages/auth` and every rule about allowed packages misfires. A project of its own,
// installed from the registry, uses `.dependency-cruiser.cjs` directly.
import generated from './.dependency-cruiser.cjs';

export default { ...generated, options: { ...generated.options, preserveSymlinks: true } };
