import { Logger } from '@aws-lambda-powertools/logger';
import type { ObjectProcessingRules } from './ObjectProcessingRules';
import { ObjectListItem, ObjectListRecord, ObjectsApiClient } from './ObjectsApiClient';
import { ObjectRecord } from '../model/ObjectRecord';
import { ProcessingPeriod } from '../model/ProcessingPeriod';

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

  async findRecordsInPeriod(period: ProcessingPeriod): Promise<ObjectRecord[]> {
    const startedAt = Date.now();
    const candidates = await this.discoverCandidates(period);

    const records: ObjectRecord[] = [];
    for (const candidate of candidates) {
      const history = await this.fetchFullHistory(candidate.uuid);
      for (const record of history) {
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
      candidateObjects: candidates.length,
      recordsFound: records.length,
      durationMs: Date.now() - startedAt,
    });
    return records;
  }

  /**
   * Objects are listed newest-current-registration-first, so once a page's object is provably
   * older than period.from every object after it is too and discovery can stop. Never stops on
   * period.to: an object registered after the period can still have an older record inside it.
   *
   * The Objects API also holds objects unrelated to open-forms entirely, so candidates are
   * filtered down to configured object types here, before any history is fetched for them.
   */
  private async discoverCandidates(period: ProcessingPeriod): Promise<ObjectListItem[]> {
    const candidates: ObjectListItem[] = [];
    let page = 1;
    let pagesFetched = 0;

    while (true) {
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

      if (reachedOlderThanPeriod || !result.next) {
        break;
      }
      page += 1;
    }

    this.logger.debug('Object discovery scan finished', { pagesFetched, candidateObjects: candidates.length });
    return candidates;
  }

  private async fetchFullHistory(uuid: string): Promise<ObjectListRecord[]> {
    const records: ObjectListRecord[] = [];
    let page = 1;

    while (true) {
      const result = await this.client.listObjectHistory(uuid, { page, pageSize: this.pageSize });
      records.push(...result.results);
      if (!result.next) {
        break;
      }
      page += 1;
    }

    return records;
  }
}
