import { Logger } from '@aws-lambda-powertools/logger';
import { AWS } from '@gemeentenijmegen/utils';
import { ObjectsApiClient } from './ObjectsApiClient';
import { Statics } from '../../Statics';
import { ObjectParser } from '../../submission-forwarder/receiver-lambda/ObjectParser';
import { previousAmsterdamCalendarDay } from '../time-range/AmsterdamTimeRange';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ObjectReaderOptions {
  logger?: Logger;
}

export interface ObjectVersionPeriod {
  // 'YYYY-MM-DD' in Amsterdam time, as the Objects API writes registrationAt. Both days are included.
  firstDay: string;
  lastDay: string;
}

export interface ObjectVersion {
  objectUuid: string;
  // The object type URL from the Object.
  objectType: string;
  // The name before ## in ssmObjectTypes, like esfTaak.
  objectTypeName: string;
  index: number;
  registrationAt: string;
  // Only set for esfTaak: other object types can have an unrelated status field in their data.
  esfStatus?: string;
}

interface FoundObject {
  uuid: string;
  type: string;
  typeName: string;
}

export class ObjectReader {
  private readonly logger: Logger;

  constructor(options: ObjectReaderOptions = {}) {
    this.logger = options.logger ? options.logger.createChild() : new Logger({ serviceName: 'ObjectReader' });
  }

  /**
   * Finds every version of an Object that was registered in the period, also when an Object got several versions on one day.
   * Only object types the receiver processes (ssmObjectTypes) count. The reader collects facts and draws no conclusions.
   *
   * @param period The first and last day, both included. Without a period it is the previous day in Amsterdam.
   * @returns The versions found. An empty array means no Object of a configured type was registered in the period.
   * @throws Error when the period is not written as 'YYYY-MM-DD' or lastDay is before firstDay.
   * @throws ObjectsApiError when a page of the Objects API fails. There is never a partial result.
   * @example
   * import { ObjectReader } from './object-reader/ObjectReader';
   * const reader = new ObjectReader();
   * const versions = await reader.findVersions({ firstDay: '2026-11-01', lastDay: '2026-11-03' });
   */
  async findVersions(period?: ObjectVersionPeriod): Promise<ObjectVersion[]> {
    const startedAt = Date.now();
    const yesterday = previousAmsterdamCalendarDay();
    const firstDay = period ? period.firstDay : yesterday;
    const lastDay = period ? period.lastDay : yesterday;
    if (!DAY_PATTERN.test(firstDay) || !DAY_PATTERN.test(lastDay) || lastDay < firstDay) {
      throw new Error(`Invalid period, expected YYYY-MM-DD with firstDay <= lastDay, got ${firstDay} to ${lastDay}`);
    }

    this.logger.trace('Reading Objects API configuration from SSM and Secrets Manager');
    const baseUrl = await AWS.getParameter(Statics.ssmSubmissionProcessingMonitorObjectsApiBaseUrl);
    const token = await AWS.getSecret(Statics.secretSubmissionProcessingMonitorObjectsApiToken);
    const objectTypes = await AWS.getParameter(Statics.ssmObjectTypes);
    const client = new ObjectsApiClient({ baseUrl, token, logger: this.logger });
    const parser = new ObjectParser(objectTypes);

    const objects = await this.findObjectsRegisteredSince(firstDay, client, parser);

    const versions: ObjectVersion[] = [];
    for (const object of objects) {
      for await (const records of client.historyPages(object.uuid)) {
        for (const record of records) {
          if (record.registrationAt < firstDay || record.registrationAt > lastDay) {
            continue;
          }
          const version: ObjectVersion = {
            objectUuid: object.uuid,
            objectType: object.type,
            objectTypeName: object.typeName,
            index: record.index,
            registrationAt: record.registrationAt,
          };
          if (object.typeName === 'esfTaak') {
            version.esfStatus = record.data.status;
          }
          this.logger.debug('Object version found', { ...version });
          versions.push(version);
        }
      }
    }

    this.logger.info('Object versions found', {
      firstDay,
      lastDay,
      objectsFound: objects.length,
      versionsFound: versions.length,
      durationMs: Date.now() - startedAt,
    });
    return versions;
  }

  /**
   * The list is sorted on the registration of the current record, newest first, and records are only ever added. Once an Object's current
   * record is from before firstDay, that Object and every Object after it has no version in the period. The list never stops on lastDay:
   * an Object changed after the period can still have an older version in it.
   */
  private async findObjectsRegisteredSince(firstDay: string, client: ObjectsApiClient, parser: ObjectParser): Promise<FoundObject[]> {
    const objects: FoundObject[] = [];
    for await (const page of client.objectPagesNewestFirst()) {
      for (const object of page) {
        if (object.record.registrationAt < firstDay) {
          this.logger.trace('Reached an Object registered before the period, stop reading the list', { objectUuid: object.uuid });
          return objects;
        }
        const typeName = parser.findObjectTypeName(object.type);
        if (typeName) {
          objects.push({ uuid: object.uuid, type: object.type, typeName });
        }
      }
    }
    return objects;
  }
}
