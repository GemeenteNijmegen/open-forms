import { classifyEsfTaak } from './EsfProcessingRules';
import type { CandidateObjectRecord } from './ObjectRecordReader';
import { extractEsfClientNumber, extractReference } from './ReferenceExtractor';
import { ObjectRecord } from '../model/ObjectRecord';

export const ESF_OBJECT_TYPE_NAME = 'esftaak';

export interface ConfiguredObjectType {
  name: string;
  uuid: string;
}

const OBJECT_TYPES_ENTRY_PATTERN = /^(.+)##(.+)$/;

/**
 * Parses the name##objecttype-uuid format (semicolon-separated), same format as the receiver's
 * old objectTypes parameter and our own Statics.ssmObjectTypes.
 */
export function parseObjectTypesConfig(value: string): ConfiguredObjectType[] {
  return value
    .split(';')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map(entry => {
      const match = OBJECT_TYPES_ENTRY_PATTERN.exec(entry);
      if (!match) {
        throw new Error(`Invalid object-types configuration entry: "${entry}"`);
      }
      return { name: match[1], uuid: match[2] };
    });
}

/**
 * Resolves which configured object type (if any) applies to an object, and normalizes its
 * records into the monitor's own model. Matches on the trailing objecttype uuid, same approach
 * as the receiver's matchesObjectType in ObjectParser.ts, since the Objecttypes API is a
 * separate service we don't have a base URL configured for.
 */
export class ObjectProcessingRules {
  constructor(private readonly configuredTypes: ConfiguredObjectType[]) {}

  /** Undefined means this object type is not configured for monitoring at all. */
  resolve(objectTypeUrl: string): ConfiguredObjectType | undefined {
    return this.configuredTypes.find(type => objectTypeUrl.toLowerCase().endsWith(`/${type.uuid.toLowerCase()}`));
  }

  /**
   * Normalizes a candidate into the monitor's own model. Only the specific fields needed
   * (reference, ESF status) are read from data, never the whole thing.
   */
  normalize(candidate: CandidateObjectRecord): ObjectRecord | undefined {
    const configuredType = this.resolve(candidate.objectType);
    if (!configuredType) {
      return undefined;
    }

    const base = {
      objectUuid: candidate.objectUuid,
      objectIndex: candidate.record.index,
      objectType: candidate.objectType,
      registrationAt: candidate.record.registrationAt,
      reference: extractReference(configuredType.name, candidate.record.data),
    };

    if (configuredType.name === ESF_OBJECT_TYPE_NAME) {
      const esf = classifyEsfTaak(candidate.record.data);
      return {
        ...base,
        clientNumber: extractEsfClientNumber(candidate.record.data),
        esfStatus: esf?.esfStatus,
        expectedProcessing: esf?.expectedProcessing ?? false,
      };
    }

    return { ...base, expectedProcessing: true };
  }
}
