import { Logger } from '@aws-lambda-powertools/logger';
import { AWS } from '@gemeentenijmegen/utils';
import { ObjectsApiClient, ObjectsApiError, ObjectsApiPage } from './ObjectsApiClient';
import { Statics } from '../../Statics';
import { ObjectParser } from '../../submission-forwarder/receiver-lambda/ObjectParser';
import { previousAmsterdamCalendarDay } from '../time-range/AmsterdamTimeRange';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
// A list that changes while it is read is read again; after this many reads the reader gives up.
const MAX_LIST_READS = 3;

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

interface ObjectList {
  objects: FoundObject[];
  // Objects changed on or after firstDay, also the ones with a type that is not configured.
  objectsListed: number;
  objectsWithUnknownType: number;
  // registrationAt of the first Object in the list; should be the newest when the API sorts as asked.
  newestRegistrationAt?: string;
  // registrationAt of the Object the list stopped at, the first one from before the period.
  stoppedAtRegistrationAt?: string;
  count?: number;
  listReads: number;
}

// The Objects of one read of the list, until the first one from before the period, in the order of the API.
interface ListedObjects {
  objects: any[];
  uuids: Set<string>;
  pages: number;
  // The count of the first page; another count on a later page means Objects were added or deleted while reading.
  count?: number;
  newestRegistrationAt?: string;
  stoppedAtRegistrationAt?: string;
  // Set when the list changed while it was read, so this read cannot be trusted.
  change?: ListChange;
}

interface ListChange {
  reason: 'DUPLICATE_UUID' | 'COUNT_CHANGED';
  page: number;
  position?: number;
  objectUuid?: string;
  countOnFirstPage?: number;
  count?: number;
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
    this.logger.info('Object types configured', { names: objectTypes.split(';').map((objectType) => objectType.split('##')[0]) });
    const client = new ObjectsApiClient({ baseUrl, token, logger: this.logger });
    const parser = new ObjectParser(objectTypes);

    const objectList = await this.readObjectList(firstDay, client, parser);
    const objects = objectList.objects;

    const versions: ObjectVersion[] = [];
    for (const object of objects) {
      for await (const page of client.historyPages(object.uuid)) {
        for (const record of page.results) {
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
      objectsListed: objectList.objectsListed,
      objectsWithUnknownType: objectList.objectsWithUnknownType,
      newestRegistrationAt: objectList.newestRegistrationAt,
      stoppedAtRegistrationAt: objectList.stoppedAtRegistrationAt,
      listReads: objectList.listReads,
      count: objectList.count,
      objectsFound: objects.length,
      versionsFound: versions.length,
      durationMs: Date.now() - startedAt,
    });
    return versions;
  }

  // The API pages with an offset, so an Object that is added or changed while reading shifts every Object after it. Then read again.
  private async readObjectList(firstDay: string, client: ObjectsApiClient, parser: ObjectParser): Promise<ObjectList> {
    for (let listRead = 1; listRead <= MAX_LIST_READS; listRead++) {
      this.logger.trace('Object list read started', { listRead, maxListReads: MAX_LIST_READS, firstDay });
      const listedObjects = await this.findObjectsRegisteredSince(firstDay, client, listRead);
      if (!listedObjects.change) {
        return this.keepConfiguredTypes(listedObjects, parser, listRead);
      }
      this.logger.warn('Object list changed while reading', {
        listRead,
        maxListReads: MAX_LIST_READS,
        readAgain: listRead < MAX_LIST_READS,
        ...listedObjects.change,
      });
    }
    throw new ObjectsApiError(`Object list kept changing while reading, gave up after ${MAX_LIST_READS} reads`);
  }

  /**
   * The list is sorted on the registration of the current record, newest first, and records are only ever added. Once an Object's current
   * record is from before firstDay, that Object and every Object after it has no version in the period. The list never stops on lastDay:
   * an Object changed after the period can still have an older version in it.
   */
  private async findObjectsRegisteredSince(firstDay: string, client: ObjectsApiClient, listRead: number): Promise<ListedObjects> {
    const listedObjects: ListedObjects = { objects: [], uuids: new Set(), pages: 0 };
    for await (const page of client.objectPagesNewestFirst()) {
      listedObjects.pages++;
      this.logger.trace('Object list page read', {
        listRead,
        page: listedObjects.pages,
        count: page.count,
        objects: page.results.length,
        first: listedObjectForLog(page.results[0]),
        last: listedObjectForLog(page.results.at(-1)),
      });
      listedObjects.count ??= page.count;
      listedObjects.newestRegistrationAt ??= page.results[0]?.record.registrationAt;
      listedObjects.change = findListChange(listedObjects, page);
      if (listedObjects.change) {
        return listedObjects;
      }
      for (const object of page.results) {
        if (object.record.registrationAt < firstDay) {
          listedObjects.stoppedAtRegistrationAt = object.record.registrationAt;
          this.logger.trace('Object list stopped before the period', { listRead, page: listedObjects.pages, ...listedObjectForLog(object) });
          return listedObjects;
        }
        listedObjects.objects.push(object);
        listedObjects.uuids.add(object.uuid);
      }
    }
    this.logger.trace('Object list read to the last page', { listRead, pages: listedObjects.pages });
    return listedObjects;
  }

  private keepConfiguredTypes(listedObjects: ListedObjects, parser: ObjectParser, listRead: number): ObjectList {
    const objectList: ObjectList = {
      objects: [],
      objectsListed: listedObjects.objects.length,
      objectsWithUnknownType: 0,
      newestRegistrationAt: listedObjects.newestRegistrationAt,
      stoppedAtRegistrationAt: listedObjects.stoppedAtRegistrationAt,
      count: listedObjects.count,
      listReads: listRead,
    };
    const unknownTypes = new Set<string>();
    for (const object of listedObjects.objects) {
      const typeName = parser.findObjectTypeName(object.type);
      if (typeName) {
        objectList.objects.push({ uuid: object.uuid, type: object.type, typeName });
      } else {
        objectList.objectsWithUnknownType++;
        if (!unknownTypes.has(object.type)) {
          unknownTypes.add(object.type);
          this.logger.warn('Object type not configured', { objectType: object.type });
        }
      }
    }
    return objectList;
  }
}

/**
 * Checks one page against the Objects listed before it. A uuid that comes again or another count means the list changed while reading.
 * @returns The change, or undefined when the page fits.
 * @throws ObjectsApiError when the API did not sort on registrationAt and uuid, for example because it ignored an unknown ordering field.
 */
function findListChange(listedObjects: ListedObjects, page: ObjectsApiPage): ListChange | undefined {
  const pageNumber = listedObjects.pages;
  if (page.count !== listedObjects.count) {
    return { reason: 'COUNT_CHANGED', page: pageNumber, countOnFirstPage: listedObjects.count, count: page.count };
  }
  const uuidsOnPage = new Set<string>();
  let previousObject = listedObjects.objects.at(-1);
  for (const [index, object] of page.results.entries()) {
    const position = index + 1;
    // Before the order check: after a shift the last Object of a page comes again as the first of the next.
    if (listedObjects.uuids.has(object.uuid) || uuidsOnPage.has(object.uuid)) {
      return { reason: 'DUPLICATE_UUID', page: pageNumber, position, objectUuid: object.uuid };
    }
    if (previousObject && !isListedAfter(previousObject, object)) {
      throw new ObjectsApiError(`Objects API did not sort the list on registrationAt and uuid, page ${pageNumber} position ${position}`);
    }
    uuidsOnPage.add(object.uuid);
    previousObject = object;
  }
  return undefined;
}

// Newest registration first; within one day the uuid in ascending order, as Postgres sorts a uuid.
function isListedAfter(previousObject: any, object: any): boolean {
  if (previousObject.record.registrationAt !== object.record.registrationAt) {
    return previousObject.record.registrationAt > object.record.registrationAt;
  }
  return previousObject.uuid < object.uuid;
}

// Only what the trace log needs of an Object in the list, never its data.
function listedObjectForLog(object: any) {
  return object && { uuid: object.uuid, registrationAt: object.record.registrationAt };
}
