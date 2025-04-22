import { Logger } from '@aws-lambda-powertools/logger';
import { SNSEventRecord } from 'aws-lambda';
import { SubmissionSchema } from '../shared/Submission';
import { trace } from '../shared/trace';
import { ZgwClientFactory } from '../shared/ZgwClientFactory';
import { ESBFolderSubmissionZaak } from './ESBFolderSubmissionZaak/ESBFolderSubmissionZaak';

const HANDLER_ID = 'ZGW_REGISTRATION';
const logger = new Logger();

interface SubmissionForwarderHandlerOptions {
  zgwClientFactory: ZgwClientFactory;
  documentenBaseUrl: string;
  zakenBaseUrl: string;
  catalogiBaseUrl: string;
}

export class SubmissionForwarderHandler {

  /**
   * Handle incomming notifications from the objects api
   */
  constructor(private readonly options: SubmissionForwarderHandlerOptions) { }

  async handle(event: SNSEventRecord) {

    // Message is the submission
    const submission = SubmissionSchema.parse(JSON.parse(event.Sns.Message));
    logger.debug('Retreived submisison', { submission });

    // Make zaak to display in Mijn Nijmegen. Account for retries queue by always checking if some part already exists
    await ESBFolderSubmissionZaak.create({
      submission: submission,
      zgwClientFactory: this.options.zgwClientFactory,
      zakenApiBaseUrl: this.options.zakenBaseUrl,
      catalogiApiBaseUrl: this.options.catalogiBaseUrl,
    });

    await trace(submission.reference, HANDLER_ID, 'OK');
  }

}
