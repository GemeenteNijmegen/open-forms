import { InvalidStateError, UnknownObjectError } from './ErrorTypes';
import { EnrichedZgwObjectData } from '../shared/EnrichedZgwObjectData';
import { EsfTaak, EsfTaakSchema } from '../shared/EsfTaak';
import { Submission, SubmissionSchema } from '../shared/Submission';
import { ZgwObject } from '../shared/ZgwObject';

interface objectType {
  objectTypeUrl: string;
  parser: any;
};

/**
 * The Object parser takes an object from the Objects API,
 * validates its one of the accepted types, and if necessary
 * parses it int a standard format, keeping data but making sure
 * a reference, pdf (if relevant) and attachments (if relevant)
 * are available at the top level.
 */
export class ObjectParser {
  private objectTypes: objectType[];

  private supportedObjectTypes = {
    esfTaak: EsfTaakSchema,
    submission: SubmissionSchema,
  };

  constructor(objectTypes: objectType[] | string) {
    if (Array.isArray(objectTypes)) {
      this.objectTypes = objectTypes;
    } else {
      this.objectTypes = this.parseObjectTypestring(objectTypes);
    }
  }

  parse(object: ZgwObject): EnrichedZgwObjectData {
    const type = this.objectTypes.find(objectType => objectType.objectTypeUrl == object.type);
    if (!type) {
      throw new UnknownObjectError(`Unknown object type, unable to parse, object type: ${object.type}`);
    }
    const parsed = type.parser.parse(object.record.data);
    if (type.parser == SubmissionSchema) {
      let submission = parsed as Submission;
      return {
        objectUrl: object.url,
        objectUUID: object.uuid,
        ...submission,
      };
    } else if (type.parser == EsfTaakSchema) {
      let taak = parsed as EsfTaak;
      this.guardForwardableTask(taak);
      return {
        pdf: taak.formtaak.verzonden_data.pdf,
        attachments: taak.formtaak.verzonden_data.attachments,
        reference: `ESF-${taak.formtaak.verzonden_data.formulierreferentie}-${taak.formtaak.data.dossiernummer}-${taak.formtaak.data.periodenummer}`,
        objectUrl: object.url,
        objectUUID: object.uuid,
        taak,
      };
    }
    throw new UnknownObjectError('Unexpectedly reached end of parser');
  }

  /**
   * Only pass on EsfTaken which have the status 'open'. We listen to updates
   * to the object, but don't want to reprocess other statusses, since this
   * would lead to an infinite loop: The next step in this process will update
   * the object as well.
   */
  private guardForwardableTask(taak: EsfTaak) {
    if (taak.status != 'afgerond') {
      throw new InvalidStateError('Esf Taak found, only status afgerond should be processed');
    }
  }

  /**
   *  Parses string to objecttypes (for passing in .env)
   *
   *  String are expected to be of format: <name>##<objecttypeurl> and ; separated
   *  Names can only be those specified in `this.supportedParsers`
   *
   *  example: `esftaak##https://example.com/someuuid;submission##https://example.com/somethingelse`
   */
  parseObjectTypestring(objectTypes: string) {
    const types = Object.keys(this.supportedObjectTypes);
    const partsStrings = objectTypes
      .split(';')
      .map(part => part.split('##'));
    return partsStrings.map(part => {
      if (types.includes(part[0])) {
        const myType = part[0] as keyof typeof this.supportedObjectTypes;
        return {
          objectTypeUrl: part[1],
          parser: this.supportedObjectTypes[myType],
        };
      } else {
        return null;
      }
    }).filter(value => value != null);
  }
}
