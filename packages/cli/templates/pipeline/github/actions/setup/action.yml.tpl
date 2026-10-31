name: Setup
description: Node, then the dependencies of the lockfile, restored from the cache when a run already installed them.

inputs:
  node-version:
    description: The Node.js release line the pipeline runs on.
    default: '24'

runs:
  using: composite
  steps:
    - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
      with:
        node-version: ${{ inputs.node-version }}
        # The newest patch of the release line, not the one the image of the runner holds: a security
        # release of Node reaches the next run.
        check-latest: true
{{#if pm.pinned}}
    - name: The package manager package.json pins
      shell: bash
      run: |
        npm install --global "$(node -p "require('./package.json').packageManager")"
{{/if}}
    # One install per lockfile, shared by every job and every run. The key holds the lockfile and
    # package.json: a hit is what a fresh install of that lockfile gives, and a manifest that left
    # its lockfile behind is installed again, which refuses it.
    - name: Dependencies, as a run already installed them for this lockfile
      id: modules
      uses: actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9 # v6.1.0
      with:
        path: node_modules
        key: modules-${{ runner.os }}-${{ runner.arch }}-node${{ inputs.node-version }}-${{ hashFiles('package-lock.json', 'package.json') }}
    - name: Install (no run installed this lockfile yet, or the cache was evicted)
      if: steps.modules.outputs.cache-hit != 'true'
      shell: bash
      run: npm ci
{{#if orm.prisma}}
    - name: The Prisma client and the schema of the tests, build products of prisma/schema/
      shell: bash
      run: npm run db:client
{{/if}}
