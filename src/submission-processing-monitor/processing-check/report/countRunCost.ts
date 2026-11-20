import { RunCost } from './RunReport';
import { SubmissionLogReaderDiagnostics } from '../../submission-log-reader/SubmissionLogReaderTypes';

// CloudWatch Logs Insights, per GB scanned, eu-central-1. Source: https://aws.amazon.com/cloudwatch/pricing/ (Logs, Logs Insights queries),
// checked 2026-11-20.
const LOGS_INSIGHTS_USD_PER_GB_SCANNED = 0.0063;
const BYTES_PER_GB = 1024 * 1024 * 1024;

export interface RunCostInput {
  // The diagnostics of each log read that succeeded. A log read that threw has none, so its queries are not counted.
  diagnostics: SubmissionLogReaderDiagnostics[];
  logReadMs: number;
  objectReadMs: number;
  durationMs: number;
}

export function countRunCost(input: RunCostInput): RunCost {
  let queries = 0;
  let bytesScanned = 0;
  let recordsScanned = 0;
  for (const diagnostics of input.diagnostics) {
    for (const query of [diagnostics.receiverQuery, diagnostics.executionQuery]) {
      if (!query) {
        continue;
      }
      queries++;
      bytesScanned += query.statistics?.bytesScanned ?? 0;
      recordsScanned += query.statistics?.recordsScanned ?? 0;
    }
  }

  const gbScanned = Math.round((bytesScanned / BYTES_PER_GB) * 1000) / 1000;
  const estimatedCostUsd = Math.round(gbScanned * LOGS_INSIGHTS_USD_PER_GB_SCANNED * 10000) / 10000;

  return {
    queries,
    bytesScanned,
    gbScanned,
    estimatedCostUsd,
    recordsScanned,
    logReadMs: input.logReadMs,
    objectReadMs: input.objectReadMs,
    durationMs: input.durationMs,
  };
}
