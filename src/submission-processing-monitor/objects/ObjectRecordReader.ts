import { Logger } from '@aws-lambda-powertools/logger';
import type { ObjectProcessingRules } from './ObjectProcessingRules';
import { ObjectListItem, ObjectListRecord, ObjectsApiClient } from './ObjectsApiClient';
import { ObjectRecord } from '../model/ObjectRecord';
import { ProcessingPeriod } from '../model/ProcessingPeriod';
import { RuntimeBudget } from '../RuntimeBudget';

const DEFAULT_PAGE_SIZE = 100;

export interface CandidateObjectRecord {
  objectUuid: string;
  objectType: string;
  record: ObjectListRecord;
}

export interface ObjectRecordReaderOptions {
  /** @default 100 */
  pageSize?: number;
  logger?: Logger;
}

export interface ObjectRecordScanResult {
  records: ObjectRecord[];
  /** Distinct candidate objects whose history was examined, for the MonitorRun summary. */
  objectsScanned: number;
  /** False when the runtime budget ran out before every relevant page/history was read. */
  complete: boolean;
}

/**
 * Finds every Object record registered within a period, including records that are no longer
 * an object's current record (e.g. yesterday's index 3 when today's current record is index 4).
 */
export class ObjectRecordReader {
  private readonly logger: Logger;
  private readonly pageSize: number;

  constructor(
    private readonly client: ObjectsApiClient,
    private readonly processingRules: ObjectProcessingRules,
    options: ObjectRecordReaderOptions = {},
  ) {
    this.logger = options.logger ?? new Logger({ serviceName: 'ObjectRecordReader' });
    this.pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  }

  /**
   * Stops making further Objects API calls the moment runtimeBudget runs out, rather than
   * finishing the current candidate - a controlled stop should preserve as much of the remaining
   * time as possible for persistence/reporting, not spend it on a scan that's already incomplete.
   */
  async findRecordsInPeriod(period: ProcessingPeriod, runtimeBudget?: RuntimeBudget): Promise<ObjectRecordScanResult> {
    const startedAt = Date.now();
    const discovery = await this.discoverCandidates(period, runtimeBudget);

    const records: ObjectRecord[] = [];
    let complete = discovery.complete;

    for (const candidate of discovery.candidates) {
      if (!complete) {
        break;
      }
      const history = await this.fetchFullHistory(candidate.uuid, runtimeBudget);
      complete = history.complete;
      for (const record of history.records) {
        if (period.from <= record.registrationAt && record.registrationAt < period.to) {
          const normalized = this.processingRules.normalize({ objectUuid: candidate.uuid, objectType: candidate.type, record });
          if (normalized) {
            records.push(normalized);
          }
        }
      }
    }

    this.logger.info('Object record discovery finished', {
      period,
      candidateObjects: discovery.candidates.length,
      recordsFound: records.length,
      complete,
      durationMs: Date.now() - startedAt,
    });
    return { records, objectsScanned: discovery.candidates.length, complete };
  }

  /**
   * Objects are listed newest-current-registration-first, so once a page's object is provably
   * older than period.from every object after it is too and discovery can stop. Never stops on
   * period.to: an object registered after the period can still have an older record inside it.
   *
   * The Objects API also holds objects unrelated to open-forms entirely, so candidates are
   * filtered down to configured object types here, before any history is fetched for them.
   */
  private async discoverCandidates(
    period: ProcessingPeriod,
    runtimeBudget?: RuntimeBudget,
  ): Promise<{ candidates: ObjectListItem[]; complete: boolean }> {
    const candidates: ObjectListItem[] = [];
    let page = 1;
    let pagesFetched = 0;
    let complete = true;

    while (true) {
      if (runtimeBudget && !runtimeBudget.hasTimeRemaining()) {
        complete = false;
        this.logger.debug('Object discovery stopped: runtime budget exhausted', { page, candidateObjectsSoFar: candidates.length, remainingMs: runtimeBudget.remainingMs() });
        break;
      }
      const result = await this.client.listObjectsPage({ page, pageSize: this.pageSize });
      pagesFetched += 1;

      let reachedOlderThanPeriod = false;
      for (const item of result.results) {
        if (item.record.registrationAt < period.from) {
          reachedOlderThanPeriod = true;
          break;
        }
        if (this.processingRules.resolve(item.type)) {
          candidates.push(item);
        }
      }

      this.logger.debug('Object discovery page fetched', { page, itemsOnPage: result.results.length, candidateObjectsSoFar: candidates.length });

      if (reachedOlderThanPeriod || !result.next) {
        break;
      }
      page += 1;
    }

    this.logger.debug('Object discovery scan finished', { pagesFetched, candidateObjects: candidates.length, complete });
    return { candidates, complete };
  }

  private async fetchFullHistory(uuid: string, runtimeBudget?: RuntimeBudget): Promise<{ records: ObjectListRecord[]; complete: boolean }> {
    const records: ObjectListRecord[] = [];
    let page = 1;

    while (true) {
      if (runtimeBudget && !runtimeBudget.hasTimeRemaining()) {
        this.logger.debug('History scan stopped: runtime budget exhausted', { uuid, page, recordsSoFar: records.length, remainingMs: runtimeBudget.remainingMs() });
        return { records, complete: false };
      }
      const result = await this.client.listObjectHistory(uuid, { page, pageSize: this.pageSize });
      records.push(...result.results);
      this.logger.debug('Object history page fetched', { uuid, page, recordsOnPage: result.results.length, recordsSoFar: records.length });
      if (!result.next) {
        break;
      }
      page += 1;
    }

    return { records, complete: true };
  }
}
