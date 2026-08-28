import { MonitorRunRepository } from '../dynamodb/MonitorRunRepository';
import { ProcessingIssueRepository } from '../dynamodb/ProcessingIssueRepository';
import { MatchableExecutionScanResult, SubmissionExecutionReader } from '../executions/SubmissionExecutionReader';
import { ObjectRecord } from '../model/ObjectRecord';
import { MonitorHandler } from '../monitor-lambda/MonitorHandler';
import { ObjectRecordReader, ObjectRecordScanResult } from '../objects/ObjectRecordReader';
import { ProcessingReportSender } from '../reporting/ProcessingReportSender';

const NEVER_RUNS_OUT = () => 900_000; // 15 minutes, well above the safety margin

function objectRecord(overrides: Partial<ObjectRecord> & { objectUuid: string }): ObjectRecord {
  return {
    objectIndex: 1,
    objectType: 'https://example.com/objecttypes/api/v2/objecttypes/submission',
    registrationAt: '2026-08-27',
    expectedProcessing: true,
    dataValid: true,
    ...overrides,
  };
}

function fakeObjectRecordReader(result: ObjectRecordScanResult) {
  return { findRecordsInPeriod: jest.fn().mockResolvedValue(result) };
}

function fakeExecutionReader(result: MatchableExecutionScanResult) {
  return { listExecutionsWithMetadata: jest.fn().mockResolvedValue(result) };
}

function fakeMonitorRunRepository() {
  return { save: jest.fn().mockResolvedValue(undefined) };
}

function fakeProcessingIssueRepository() {
  return { recordProblem: jest.fn().mockResolvedValue(undefined), recordResolved: jest.fn().mockResolvedValue(undefined) };
}

function fakeReportSender() {
  return { send: jest.fn().mockResolvedValue(undefined), sendEsf: jest.fn().mockResolvedValue(undefined) };
}

function buildHandler(deps: {
  objectScan: ObjectRecordScanResult;
  executionScan: MatchableExecutionScanResult;
  runRepository?: ReturnType<typeof fakeMonitorRunRepository>;
  issueRepository?: ReturnType<typeof fakeProcessingIssueRepository>;
  reportSender?: ReturnType<typeof fakeReportSender>;
  reportEnabled?: boolean;
}) {
  const objectReader = fakeObjectRecordReader(deps.objectScan);
  const executionReader = fakeExecutionReader(deps.executionScan);
  const runRepository = deps.runRepository ?? fakeMonitorRunRepository();
  const issueRepository = deps.issueRepository ?? fakeProcessingIssueRepository();
  const reportSender = deps.reportSender ?? fakeReportSender();

  const handler = new MonitorHandler(
    objectReader as unknown as ObjectRecordReader,
    executionReader as unknown as SubmissionExecutionReader,
    runRepository as unknown as MonitorRunRepository,
    issueRepository as unknown as ProcessingIssueRepository,
    reportSender as unknown as ProcessingReportSender,
    ['ops@example.nl'],
    ['esf-ops@example.nl'],
    deps.reportEnabled ?? true,
  );

  return { handler, objectReader, executionReader, runRepository, issueRepository, reportSender };
}

describe('MonitorHandler', () => {
  test('a full Objects and execution scan checks processing and persists ProcessingIssues (scenario 1)', async () => {
    const records: ObjectRecord[] = [
      objectRecord({ objectUuid: 'uuid-1', reference: 'OF-1' }),
      objectRecord({ objectUuid: 'uuid-2', reference: 'OF-2' }),
    ];
    const { handler, runRepository, issueRepository, reportSender } = buildHandler({
      objectScan: { records, objectsScanned: 2, complete: true },
      executionScan: {
        executions: [
          { executionArn: 'arn:exec:1', name: 'arn:exec:1', status: 'SUCCEEDED', startDate: new Date('2026-08-27T10:00:00Z'), objectUuid: 'uuid-1' },
          { executionArn: 'arn:exec:2', name: 'arn:exec:2', status: 'FAILED', startDate: new Date('2026-08-27T10:05:00Z'), objectUuid: 'uuid-2' },
        ],
        complete: true,
      },
    });

    const monitorRun = await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-1', now: new Date('2026-08-28T04:00:00Z') });

    expect(monitorRun.status).toBe('COMPLETED');
    expect(runRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'COMPLETED', runId: 'run-1' }));
    expect(issueRepository.recordResolved).toHaveBeenCalledTimes(1);
    expect(issueRepository.recordProblem).toHaveBeenCalledTimes(1);
    expect(reportSender.send).toHaveBeenCalledTimes(1);
    expect(reportSender.sendEsf).toHaveBeenCalledTimes(1);
  });

  test('sends the regular and ESF mail to their own, independently configured recipient lists', async () => {
    const { handler, reportSender } = buildHandler({
      objectScan: { records: [], objectsScanned: 0, complete: true },
      executionScan: { executions: [], complete: true },
    });

    await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-1b' });

    expect(reportSender.send).toHaveBeenCalledWith(expect.anything(), ['ops@example.nl']);
    expect(reportSender.sendEsf).toHaveBeenCalledWith(expect.anything(), ['esf-ops@example.nl']);
  });

  test('passes monitorRunStartedAt (not period.to) as the execution scan\'s upper bound (scenario 2)', async () => {
    const monitorRunStartedAt = new Date('2026-08-28T04:00:00Z');
    const { handler, executionReader } = buildHandler({
      objectScan: { records: [], objectsScanned: 0, complete: true },
      executionScan: { executions: [], complete: true },
    });

    await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-2', now: monitorRunStartedAt });

    expect(executionReader.listExecutionsWithMetadata).toHaveBeenCalledWith(
      { from: '2026-08-27', to: '2026-08-28' },
      monitorRunStartedAt,
      expect.anything(),
    );
  });

  test('a runtime limit during the Objects scan produces an INCOMPLETE run with no ProcessingIssue updates (scenario 3)', async () => {
    const { handler, runRepository, issueRepository, reportSender } = buildHandler({
      objectScan: { records: [objectRecord({ objectUuid: 'uuid-1' })], objectsScanned: 1, complete: false },
      executionScan: { executions: [], complete: true },
    });

    const monitorRun = await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-3' });

    expect(monitorRun.status).toBe('INCOMPLETE');
    expect(monitorRun.failureReason).toBe('TIME_LIMIT_REACHED');
    expect(runRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'INCOMPLETE' }));
    expect(issueRepository.recordProblem).not.toHaveBeenCalled();
    expect(issueRepository.recordResolved).not.toHaveBeenCalled();
    expect(reportSender.send).toHaveBeenCalledWith(expect.objectContaining({ status: 'INCOMPLETE' }), expect.anything());
    expect(reportSender.sendEsf).toHaveBeenCalledWith(expect.objectContaining({ status: 'INCOMPLETE' }), expect.anything());
  });

  test('a runtime limit during the execution scan produces an INCOMPLETE run with no ProcessingIssue updates (scenario 4)', async () => {
    const { handler, runRepository, issueRepository } = buildHandler({
      objectScan: { records: [objectRecord({ objectUuid: 'uuid-1' })], objectsScanned: 1, complete: true },
      executionScan: { executions: [], complete: false },
    });

    const monitorRun = await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-4' });

    expect(monitorRun.status).toBe('INCOMPLETE');
    expect(runRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'INCOMPLETE' }));
    expect(issueRepository.recordProblem).not.toHaveBeenCalled();
    expect(issueRepository.recordResolved).not.toHaveBeenCalled();
  });

  test('a complete scan with functional problems stays COMPLETED - a found FAILED execution is not a monitor failure (scenario 5)', async () => {
    const { handler } = buildHandler({
      objectScan: { records: [objectRecord({ objectUuid: 'uuid-1' })], objectsScanned: 1, complete: true },
      executionScan: {
        executions: [{ executionArn: 'arn:exec:1', name: 'arn:exec:1', status: 'FAILED', startDate: new Date('2026-08-27T10:00:00Z'), objectUuid: 'uuid-1' }],
        complete: true,
      },
    });

    const monitorRun = await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-5' });

    expect(monitorRun.status).toBe('COMPLETED');
    expect(monitorRun.problemCount).toBe(1);
  });

  test('a COMPLETED run whose report fails to send is persisted again as REPORT_FAILED', async () => {
    const reportSender = { send: jest.fn().mockRejectedValue(new Error('SES is down')), sendEsf: jest.fn().mockResolvedValue(undefined) };
    const { handler, runRepository } = buildHandler({
      objectScan: { records: [], objectsScanned: 0, complete: true },
      executionScan: { executions: [], complete: true },
      reportSender,
    });

    const monitorRun = await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-6' });

    expect(monitorRun.status).toBe('REPORT_FAILED');
    expect(runRepository.save).toHaveBeenCalledTimes(2);
    expect(runRepository.save).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'REPORT_FAILED', runId: 'run-6' }));
  });

  test('the regular and ESF mail are sent independently - the ESF mail still goes out when the regular one fails', async () => {
    const reportSender = { send: jest.fn().mockRejectedValue(new Error('SES is down')), sendEsf: jest.fn().mockResolvedValue(undefined) };
    const { handler } = buildHandler({
      objectScan: { records: [], objectsScanned: 0, complete: true },
      executionScan: { executions: [], complete: true },
      reportSender,
    });

    await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-6b' });

    expect(reportSender.send).toHaveBeenCalledTimes(1);
    expect(reportSender.sendEsf).toHaveBeenCalledTimes(1);
  });

  test('an INCOMPLETE run whose report fails to send keeps its own status, not REPORT_FAILED', async () => {
    const reportSender = { send: jest.fn().mockRejectedValue(new Error('SES is down')), sendEsf: jest.fn().mockResolvedValue(undefined) };
    const { handler, runRepository } = buildHandler({
      objectScan: { records: [], objectsScanned: 0, complete: false },
      executionScan: { executions: [], complete: true },
      reportSender,
    });

    const monitorRun = await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-7' });

    expect(monitorRun.status).toBe('INCOMPLETE');
    expect(runRepository.save).toHaveBeenCalledTimes(1);
  });

  test('an unexpected error during scanning produces a FAILED run instead of crashing', async () => {
    const objectReader = { findRecordsInPeriod: jest.fn().mockRejectedValue(new Error('Objects API is unreachable')) };
    const executionReader = fakeExecutionReader({ executions: [], complete: true });
    const runRepository = fakeMonitorRunRepository();
    const issueRepository = fakeProcessingIssueRepository();
    const reportSender = fakeReportSender();

    const handler = new MonitorHandler(
      objectReader as unknown as ObjectRecordReader,
      executionReader as unknown as SubmissionExecutionReader,
      runRepository as unknown as MonitorRunRepository,
      issueRepository as unknown as ProcessingIssueRepository,
      reportSender as unknown as ProcessingReportSender,
      ['ops@example.nl'],
      ['esf-ops@example.nl'],
      true,
    );

    const monitorRun = await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-8' });

    expect(monitorRun.status).toBe('FAILED');
    expect(monitorRun.failureReason).toBe('Objects API is unreachable');
    expect(runRepository.save).toHaveBeenCalledWith(expect.objectContaining({ status: 'FAILED' }));
    expect(issueRepository.recordProblem).not.toHaveBeenCalled();
  });

  test('does not send a report when reporting is disabled by configuration', async () => {
    const { handler, reportSender } = buildHandler({
      objectScan: { records: [], objectsScanned: 0, complete: true },
      executionScan: { executions: [], complete: true },
      reportEnabled: false,
    });

    await handler.run({ mode: 'PERIOD', from: '2026-08-27', to: '2026-08-28' }, NEVER_RUNS_OUT, { runId: 'run-9' });

    expect(reportSender.send).not.toHaveBeenCalled();
    expect(reportSender.sendEsf).not.toHaveBeenCalled();
  });
});
