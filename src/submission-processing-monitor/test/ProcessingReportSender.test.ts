import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { mockClient } from 'aws-sdk-client-mock';
import { EsfProcessingReport, ProcessingReport } from '../model/ProcessingReport';
import { ProcessingReportSender } from '../reporting/ProcessingReportSender';

const FROM_ADDRESS = 'monitor@example.nl';

function completedReport(overrides: Partial<ProcessingReport> = {}): ProcessingReport {
  return {
    status: 'COMPLETED',
    periodFrom: '2026-08-27',
    periodTo: '2026-08-28',
    objectsScanComplete: true,
    executionsScanComplete: true,
    regularCounters: { total: 3, succeeded: 2, problem: 1 },
    problems: [{ objectUuid: 'uuid-2', objectIndex: 1, reference: 'OF-2', status: 'FAILED' }],
    ...overrides,
  };
}

function completedEsfReport(overrides: Partial<EsfProcessingReport> = {}): EsfProcessingReport {
  return {
    status: 'COMPLETED',
    periodFrom: '2026-08-27',
    periodTo: '2026-08-28',
    objectsScanComplete: true,
    executionsScanComplete: true,
    esfCounters: { open: 1, verwerkt: 1, gesloten: 1, afgerond: 1, afgerondSucceeded: 0, afgerondProblem: 1, invalid: 0 },
    problems: [{ reference: 'ESF-1', clientNumber: '12345', status: 'FAILED' }],
    ...overrides,
  };
}

describe('ProcessingReportSender', () => {
  const sesMock = mockClient(SESClient);

  beforeEach(() => {
    sesMock.reset();
  });

  test('sends a COMPLETED report with counters and the problem list in the body', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const sender = new ProcessingReportSender(FROM_ADDRESS);

    await sender.send(completedReport(), ['ops@example.nl', 'team@example.nl']);

    const call = sesMock.commandCalls(SendEmailCommand)[0].args[0].input;
    expect(call.Source).toBe(FROM_ADDRESS);
    expect(call.Destination?.ToAddresses).toEqual(['ops@example.nl', 'team@example.nl']);
    expect(call.Message?.Body?.Text?.Data).toContain('FAILED: uuid uuid-2, index 1, reference OF-2');
    expect(call.Message?.Body?.Text?.Data).not.toContain('ESF:');
  });

  test('sends a clear INCOMPLETE report without functional totals', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const sender = new ProcessingReportSender(FROM_ADDRESS);
    const report: ProcessingReport = {
      status: 'INCOMPLETE',
      periodFrom: '2026-08-27',
      periodTo: '2026-08-28',
      objectsScanComplete: true,
      executionsScanComplete: false,
      failureReason: 'TIME_LIMIT_REACHED',
      problems: [],
    };

    await sender.send(report, ['ops@example.nl']);

    const body = sesMock.commandCalls(SendEmailCommand)[0].args[0].input.Message?.Body?.Text?.Data;
    expect(body).toContain('Objects scan compleet: ja');
    expect(body).toContain('Execution scan compleet: nee');
    expect(body).toContain('TIME_LIMIT_REACHED');
    expect(body).not.toContain('Regulier:');
  });

  test('does not send when there are no configured recipients', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const sender = new ProcessingReportSender(FROM_ADDRESS);

    await sender.send(completedReport(), []);

    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(0);
  });

  test('sends a COMPLETED report with zero problems, not silently skipping it', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const sender = new ProcessingReportSender(FROM_ADDRESS);

    await sender.send(completedReport({ problems: [] }), ['ops@example.nl']);

    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(1);
    expect(sesMock.commandCalls(SendEmailCommand)[0].args[0].input.Message?.Body?.Text?.Data).toContain('Geen problemen gevonden.');
  });

  test('sends a COMPLETED ESF report with ESF counters and only reference/clientnummer/status per problem', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const sender = new ProcessingReportSender(FROM_ADDRESS);

    await sender.sendEsf(completedEsfReport(), ['ops@example.nl']);

    const call = sesMock.commandCalls(SendEmailCommand)[0].args[0].input;
    expect(call.Message?.Subject?.Data).toContain('ESF');
    expect(call.Message?.Body?.Text?.Data).toContain('ESF: open 1, afgerond 1');
    expect(call.Message?.Body?.Text?.Data).toContain('FAILED: ESF-1, clientnummer 12345');
    expect(call.Message?.Body?.Text?.Data).not.toContain('Regulier:');
  });

  test('sends a clear INCOMPLETE ESF report without functional totals', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const sender = new ProcessingReportSender(FROM_ADDRESS);
    const report: EsfProcessingReport = {
      status: 'INCOMPLETE',
      periodFrom: '2026-08-27',
      periodTo: '2026-08-28',
      objectsScanComplete: true,
      executionsScanComplete: false,
      failureReason: 'TIME_LIMIT_REACHED',
      problems: [],
    };

    await sender.sendEsf(report, ['ops@example.nl']);

    const body = sesMock.commandCalls(SendEmailCommand)[0].args[0].input.Message?.Body?.Text?.Data;
    expect(body).toContain('Objects scan compleet: ja');
    expect(body).not.toContain('ESF:');
  });

  test('does not send the ESF report when there are no configured recipients', async () => {
    sesMock.on(SendEmailCommand).resolves({});
    const sender = new ProcessingReportSender(FROM_ADDRESS);

    await sender.sendEsf(completedEsfReport(), []);

    expect(sesMock.commandCalls(SendEmailCommand)).toHaveLength(0);
  });
});
