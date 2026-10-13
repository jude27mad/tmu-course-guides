import { CHECKS } from './checks.mjs';
import { instrument } from './instrument.mjs';
import { runHarness } from './runtime.mjs';

try {
  const result = await runHarness({ checks: CHECKS, instrument });
  process.exitCode = result.exitCode;
} catch (error) {
  // A report write failure cannot itself be written to the report directory.
  console.error(`QA could not write its reports: ${error.stack || error}`);
  process.exitCode = 2;
}
