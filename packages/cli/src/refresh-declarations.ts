#!/usr/bin/env node
import { refreshDeclarations } from './dev/refresh-declarations';

refreshDeclarations(process.cwd(), (line) => void process.stderr.write(`${line}\n`));
