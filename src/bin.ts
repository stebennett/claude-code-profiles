#!/usr/bin/env node
import { runCli } from './cli.ts';
import { EXIT_FAILED } from './exit-codes.ts';
import { processDeps } from './process-deps.ts';

try {
  process.exit(await runCli(process.argv.slice(2), processDeps()));
} catch (error) {
  process.stderr.write(`ccprofile: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(EXIT_FAILED);
}
